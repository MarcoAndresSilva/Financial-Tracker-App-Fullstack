import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Solo el nombre: el email tiene su propio flujo verificado (AuthService) y
  // la contraseña el suyo (PATCH /auth/password).
  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      // El ValidationPipe global no usa `transform`, así que el recorte del DTO
      // solo aplica al validar: se repite acá para guardar el valor limpio.
      data: { name: dto.name.trim() },
      select: { id: true, email: true, name: true },
    });
  }
}
