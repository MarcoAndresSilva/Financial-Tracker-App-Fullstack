import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Usa el ValidationPipe globalmente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina cualquier propiedad no definida en el DTO
    }),
  );

  await app.listen(3000);
}

// Usamos 'void' para indicarle a ESLint que estamos manejando
// la promesa de forma intencionada en el nivel raíz.
void bootstrap();
