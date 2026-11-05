import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; iat: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Un token emitido antes del último cambio de contraseña ya no vale: así
    // cambiarla o restablecerla cierra las sesiones abiertas en otros
    // dispositivos. `iat` viene en segundos; se compara contra el segundo del
    // cambio para que el token nuevo que devuelve el propio cambio siga válido.
    if (
      user.passwordChangedAt &&
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException();
    }

    // Lo que retornemos aquí se adjuntará al objeto `request`
    // como `request.user`
    delete user.password;
    return user;
  }
}
