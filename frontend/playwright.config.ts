import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de flujos críticos en un navegador real (`npm run e2e`).
 *
 * Levantan su PROPIO stack, aislado del de desarrollo:
 *   - backend en :3100 conectado a la base `fintrack_test`
 *   - frontend en :4300 con la configuración `e2e` (environment.e2e.ts → :3100)
 * Así se pueden correr con los servidores de desarrollo (3000/4200) abiertos y
 * sin ensuciar la base de desarrollo.
 */
const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://user:password@localhost:5432/fintrack_test?schema=public';

// Mismo seguro que la suite e2e del backend: nunca contra una base que no sea
// de pruebas.
if (!new URL(TEST_DATABASE_URL).pathname.includes('test')) {
  throw new Error('TEST_DATABASE_URL no apunta a una base de pruebas.');
}

export const API_URL = 'http://localhost:3100';
const APP_URL = 'http://localhost:4300';

export default defineConfig({
  testDir: './e2e',
  // Cada test crea sus propios usuarios con email único: pueden correr en
  // paralelo sin pisarse.
  fullyParallel: true,
  // El `ng serve` de desarrollo no aguanta muchos navegadores a la vez en la
  // primera carga (compila bajo demanda): con 2 workers es estable.
  workers: 2,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: APP_URL,
    // Si un test falla, queda la traza completa (DOM, red, consola) para
    // revisarla con `npx playwright show-trace`.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // ts-node corre el backend directo desde src/, sin compilar a dist/:
      // así no choca con el `nest start --watch` de desarrollo, que usa dist/.
      command:
        'npx prisma migrate deploy && npx ts-node --transpile-only src/main.ts',
      cwd: '../backend',
      url: `${API_URL}/`,
      env: {
        DATABASE_URL: TEST_DATABASE_URL,
        PORT: '3100',
        FRONTEND_URL: APP_URL,
        JWT_SECRET: 'jwt-secret-solo-para-tests',
      },
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: 'npx ng serve --configuration e2e --port 4300',
      url: APP_URL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
