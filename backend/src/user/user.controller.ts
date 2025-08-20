import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

// Usamos el guardián de autenticación para proteger este controlador
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UserController {
  @Get('me')
  getMe(@Req() req: Request) {
    // req.user es adjuntado por nuestra JwtStrategy
    return req.user;
  }
}
