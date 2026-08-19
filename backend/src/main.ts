import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // En producción, FRONTEND_URL apunta al dominio real del frontend desplegado.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    methods: ['GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Usa el ValidationPipe globalmente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina cualquier propiedad no definida en el DTO
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

// Usamos 'void' para indicarle a ESLint que estamos manejando
// la promesa de forma intencionada en el nivel raíz.
void bootstrap();
