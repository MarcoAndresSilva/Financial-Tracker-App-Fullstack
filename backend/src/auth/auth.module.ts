import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule], //Le decimos que este módulo depende de ConfigModule
      useFactory: (configService: ConfigService) => ({
        //  useFactory es una función que se ejecutará para crear la configuración
        secret: configService.get<string>('JWT_SECRET'), // Leemos el secreto usando el servicio
        signOptions: {
          expiresIn: '60m', // Puedes ajustar el tiempo de expiración
        },
      }),
      inject: [ConfigService], // Inyectamos ConfigService en nuestra factory
      global: true, // Mantenemos el módulo como global
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
