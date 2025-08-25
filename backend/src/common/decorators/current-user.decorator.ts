import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';
import { Request } from 'express';

// Definimos una interfaz para que TypeScript sepa que 'user' existe en Request
interface RequestWithUser extends Request {
  user: User;
}

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    // Le decimos a TypeScript que el objeto request es de nuestro tipo personalizado
    const request: RequestWithUser = ctx.switchToHttp().getRequest();

    const user = request.user;

    return data ? user?.[data] : user;
  },
);
