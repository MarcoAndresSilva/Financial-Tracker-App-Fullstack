import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}

// Usamos 'void' para indicarle a ESLint que estamos manejando
// la promesa de forma intencionada en el nivel raíz.
void bootstrap();
