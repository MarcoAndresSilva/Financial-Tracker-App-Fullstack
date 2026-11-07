import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  SignUpDto,
  SignInDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RequestEmailChangeDto,
  ConfirmEmailChangeDto,
} from './dto';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';

// Vigencia del link de "¿Olvidaste tu contraseña?".
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
// Espera mínima entre dos emails de restablecimiento para el mismo usuario, para
// que el endpoint público no se pueda usar para llenarle la bandeja a alguien.
const RESET_COOLDOWN_MS = 60 * 1000;
// Vigencia del link de confirmación de un email nuevo. Más larga que la del
// restablecimiento: el cambio ya exigió la contraseña, y el link llega a un
// correo que quizás no se revisa al tiro.
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

// El nombre lo elige el usuario: se escapa antes de meterlo en el HTML del email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignUpDto) {
    // Hashear la contraseña (esto no cambia)
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    try {
      // Crear el usuario Y su cartera personal en una sola transacción
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          password: hashedPassword,
          // ¡Magia de Prisma! Creación anidada
          memberships: {
            create: {
              role: 'OWNER',
              wallet: {
                create: {
                  name: 'Personal',
                  type: 'PERSONAL',
                },
              },
            },
          },
        },
        // Incluir la información de la membresía y la cartera en la respuesta
        include: {
          memberships: {
            include: {
              wallet: true,
            },
          },
        },
      });

      //  Devolver el usuario sin la contraseña
      delete user.password;
      return user;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ForbiddenException('Credentials taken');
      }
      throw error;
    }
  }

  async signin(dto: SignInDto) {
    const user = await this.prisma.user.findUnique({
      // Busca un usuario en la base de datos
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      // Si no lo encuentra lanza un error
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password); // Compara la contraseña ingresada con la de la base de datos
    if (!passwordMatches) {
      // Si no son iguales lanza un error
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.signToken(user.id, user.email); // si todo es correcto devuelve el token
  }

  // Respuesta idéntica exista o no el email, para no revelar quién tiene cuenta.
  // El envío corre en segundo plano por la misma razón: si se esperara al email,
  // el tiempo de respuesta delataría qué emails están registrados.
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      this.sendResetEmail(user).catch((error: unknown) =>
        this.logger.error(
          `No se pudo enviar el email de restablecimiento a ${user.email}`,
          error instanceof Error ? error.stack : undefined,
        ),
      );
    }

    return {
      message:
        'Si el email está registrado, te enviamos un link para restablecer la contraseña.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      await bcrypt.genSalt(),
    );

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Marcar como usado con la condición `usedAt: null` evita que dos envíos
      // simultáneos del mismo link restablezcan la contraseña dos veces.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: record.userId, id: { not: record.id } },
      });
    });

    return { message: 'Password updated' };
  }

  // Devuelve un token nuevo: el cambio actualiza `passwordChangedAt`, lo que
  // invalida el token con que se hizo esta misma petición (ver JwtStrategy).
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // 400 y no 401: el interceptor del frontend trata cualquier 401 como sesión
    // vencida y cierra la sesión, y acá la sesión es válida.
    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!currentMatches) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      await bcrypt.genSalt(),
    );
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
    ]);

    return this.signToken(user.id, user.email);
  }

  // Paso 1 del cambio de email: no toca la cuenta, solo manda un link al email
  // nuevo. El cambio se aplica recién en confirmEmailChange.
  async requestEmailChange(userId: string, dto: RequestEmailChangeDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // 400 y no 401, por el mismo motivo que en changePassword.
    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newEmail = dto.newEmail.trim();
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException(
        'New email must be different from the current one',
      );
    }
    // Revelar que un email ya tiene cuenta acá es aceptable: hace falta sesión
    // y contraseña para preguntar, y el registro ya lo revela igual.
    if (await this.isEmailTaken(newEmail, userId)) {
      throw new ConflictException('Email already in use');
    }

    // Pedir de nuevo invalida el link anterior: vale solo el último email.
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.emailChangeToken.deleteMany({ where: { userId } }),
      this.prisma.emailChangeToken.create({
        data: {
          userId,
          newEmail,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
        },
      }),
    ]);

    const link = `${this.frontendUrl()}/auth/confirm-email?token=${token}`;
    const greeting = user.name ? `Hola ${user.name}` : 'Hola';
    // A diferencia de forgot-password, acá se espera el envío: el usuario está
    // en la pantalla esperando el link, y si Brevo falla tiene que saberlo.
    try {
      await this.mail.send({
        to: newEmail,
        toName: user.name ?? undefined,
        subject: 'Confirma tu nuevo email de FinTrack',
        text:
          `${greeting},\n\n` +
          `Pediste usar este email (${newEmail}) en tu cuenta de FinTrack. ` +
          `Abre este link para confirmarlo (vence en 24 horas):\n\n${link}\n\n` +
          `Hasta que lo confirmes, tu cuenta sigue con el email anterior. ` +
          `Si no fuiste tú, ignora este correo.`,
        html: this.emailLayout(
          'Confirma tu nuevo email',
          `<p>${escapeHtml(greeting)},</p>
           <p>Pediste usar <strong>${escapeHtml(newEmail)}</strong> en tu cuenta de FinTrack.</p>`,
          link,
          'Confirmar email',
          'El link vence en 24 horas. Hasta que lo confirmes, tu cuenta sigue con el email anterior. Si no fuiste tú, ignora este correo.',
        ),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la confirmación de email a ${newEmail}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Could not send confirmation email',
      );
    }

    return { message: 'Confirmation email sent', pendingEmail: newEmail };
  }

  // Paso 2: público (el link puede abrirse en un navegador sin sesión). El
  // token prueba a la vez quién pidió el cambio y que el email nuevo existe.
  async confirmEmailChange(dto: ConfirmEmailChangeDto) {
    const tokenHash = this.hashToken(dto.token);

    const { user, newEmail } = await this.prisma.$transaction(async (tx) => {
      const record = await tx.emailChangeToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired token');
      }
      // Mismo canje atómico que resetPassword: un link, un solo uso.
      const { count } = await tx.emailChangeToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Invalid or expired token');
      }
      // Otra cuenta pudo registrarse con ese email entre el pedido y la
      // confirmación: se vuelve a revisar antes de aplicar.
      if (await this.isEmailTaken(record.newEmail, record.userId, tx)) {
        throw new ConflictException('Email already in use');
      }
      try {
        await tx.user.update({
          where: { id: record.userId },
          data: { email: record.newEmail },
        });
      } catch (error) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Email already in use');
        }
        throw error;
      }
      return { user: record.user, newEmail: record.newEmail };
    });

    // Aviso al email anterior: si el cambio no lo hizo el dueño de la cuenta,
    // es la única pista que le queda. En segundo plano: el cambio ya se aplicó.
    const greeting = user.name ? `Hola ${user.name}` : 'Hola';
    this.mail
      .send({
        to: user.email,
        toName: user.name ?? undefined,
        subject: 'El email de tu cuenta de FinTrack cambió',
        text:
          `${greeting},\n\n` +
          `El email de tu cuenta de FinTrack ahora es ${newEmail}. Desde ahora ` +
          `entras con ese email y ahí llegan los avisos.\n\n` +
          `Si no fuiste tú, responde a este correo para que revisemos tu cuenta.`,
        html: this.emailLayout(
          'Tu email cambió',
          `<p>${escapeHtml(greeting)},</p>
           <p>El email de tu cuenta de FinTrack ahora es <strong>${escapeHtml(newEmail)}</strong>.
           Desde ahora entras con ese email y ahí llegan los avisos.</p>`,
          null,
          null,
          'Si no fuiste tú, responde a este correo para que revisemos tu cuenta.',
        ),
      })
      .catch((error: unknown) =>
        this.logger.error(
          `No se pudo avisar el cambio de email a ${user.email}`,
          error instanceof Error ? error.stack : undefined,
        ),
      );

    return { message: 'Email updated', email: newEmail };
  }

  // Comparación sin distinguir mayúsculas: "Marco@x.cl" y "marco@x.cl" son el
  // mismo buzón aunque el índice único de la BD los vea distintos.
  private async isEmailTaken(
    email: string,
    exceptUserId: string,
    client: Pick<PrismaService, 'user'> = this.prisma,
  ): Promise<boolean> {
    const existing = await client.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        id: { not: exceptUserId },
      },
      select: { id: true },
    });
    return existing !== null;
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
  }

  // Mismo diseño para todos los emails de cuenta (restablecer, confirmar email,
  // aviso de cambio). `contentHtml` y `hint` ya vienen escapados o son fijos.
  private emailLayout(
    title: string,
    contentHtml: string,
    link: string | null,
    buttonLabel: string | null,
    hint: string,
  ): string {
    const button =
      link && buttonLabel
        ? `<p style="margin: 24px 0;">
            <a href="${link}" style="background: #243b53; color: #fff; padding: 12px 20px;
               border-radius: 8px; text-decoration: none; display: inline-block;">
              ${buttonLabel}
            </a>
          </p>`
        : '';
    return `
        <div style="font-family: Arial, sans-serif; color: #243b53; max-width: 480px;">
          <h2 style="margin: 0 0 16px;">${title}</h2>
          ${contentHtml}
          ${button}
          <p style="font-size: 13px; color: #627d98;">${hint}</p>
        </div>`;
  }

  private async sendResetEmail(user: User) {
    const recent = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - RESET_COOLDOWN_MS) },
      },
    });
    if (recent) return;

    // El token en claro solo existe en el link; en la BD queda su hash. Pedir un
    // link nuevo invalida los anteriores: siempre vale solo el último email.
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const link = `${this.frontendUrl()}/auth/reset-password?token=${token}`;
    const greeting = user.name ? `Hola ${user.name}` : 'Hola';

    await this.mail.send({
      to: user.email,
      toName: user.name ?? undefined,
      subject: 'Restablece tu contraseña de FinTrack',
      text:
        `${greeting},\n\n` +
        `Recibimos una solicitud para restablecer la contraseña de tu cuenta de FinTrack. ` +
        `Abre este link para elegir una nueva (vence en 30 minutos):\n\n${link}\n\n` +
        `Si no fuiste tú, ignora este correo: tu contraseña no cambia.`,
      html: this.emailLayout(
        'Restablece tu contraseña',
        `<p>${escapeHtml(greeting)},</p>
         <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de FinTrack.</p>`,
        link,
        'Elegir nueva contraseña',
        'El link vence en 30 minutos. Si no fuiste tú, ignora este correo: tu contraseña no cambia.',
      ),
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // funcion auxiliar para firmar el token
  async signToken(
    userId: string,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };

    const token = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
    });

    return {
      access_token: token,
    };
  }
}
