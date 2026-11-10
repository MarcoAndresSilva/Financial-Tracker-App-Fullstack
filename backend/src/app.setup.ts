import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuración global de la app. Vive aparte de main.ts para que los tests
 * e2e la apliquen igual: si cada uno armara la suya, los tests podrían pasar
 * contra una app distinta de la que corre en producción.
 */
export function configureApp(app: INestApplication): void {
  // En producción, FRONTEND_URL apunta al dominio real del frontend desplegado.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    methods: ['GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina cualquier propiedad no definida en el DTO
    }),
  );
}
