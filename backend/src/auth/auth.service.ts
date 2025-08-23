import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignUpDto, SignInDto } from './dto';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
