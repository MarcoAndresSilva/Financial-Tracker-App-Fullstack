import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UfService } from '../../src/common/indicators/uf.service';

/** Valor de UF fijo para los tests (nunca se consulta la API real). */
export const TEST_UF_VALUE = 41324.4;

/**
 * Levanta la app completa (todos los módulos, base de datos real de pruebas),
 * con la misma configuración global que main.ts. No abre un puerto: supertest
 * le habla directo al servidor HTTP en memoria.
 */
export async function createTestApp(
  options: { ufValue?: number | null } = {},
): Promise<INestApplication<App>> {
  // La UF real viene de una API externa: en los tests se reemplaza por un valor
  // fijo (o null, para probar qué pasa si la API no responde).
  const ufValue =
    options.ufValue === undefined ? TEST_UF_VALUE : options.ufValue;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(UfService)
    .useValue({ getUfValue: () => Promise.resolve(ufValue) })
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Deja la base vacía (todas las tablas menos el historial de migraciones).
 * Cada archivo de test parte de cero: así un test nunca depende de datos que
 * dejó otro.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
