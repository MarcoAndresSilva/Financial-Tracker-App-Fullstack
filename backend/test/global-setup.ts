import { execSync } from 'child_process';
import './setup-env';

/**
 * Corre UNA vez antes de toda la suite e2e (jest `globalSetup`): deja la base
 * de pruebas con el mismo esquema que producción aplicando las migraciones.
 * Si alguien agrega una migración nueva, los tests la toman solos.
 */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: process.env,
  });
}
