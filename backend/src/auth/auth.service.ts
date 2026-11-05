import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    const link = `${frontendUrl}/auth/reset-password?token=${token}`;
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
      html: `
        <div style="font-family: Arial, sans-serif; color: #243b53; max-width: 480px;">
          <h2 style="margin: 0 0 16px;">Restablece tu contraseña</h2>
          <p>${escapeHtml(greeting)},</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de FinTrack.</p>
          <p style="margin: 24px 0;">
            <a href="${link}" style="background: #243b53; color: #fff; padding: 12px 20px;
               border-radius: 8px; text-decoration: none; display: inline-block;">
              Elegir nueva contraseña
            </a>
          </p>
          <p style="font-size: 13px; color: #627d98;">
            El link vence en 30 minutos. Si no fuiste tú, ignora este correo: tu contraseña no cambia.
          </p>
        </div>`,
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
