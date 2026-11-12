// Solo para los tests de Playwright (`npm run e2e`): apunta al backend de
// pruebas que levanta playwright.config.ts en el puerto 3100, conectado a la
// base fintrack_test. Así los tests nunca tocan el backend ni la base de
// desarrollo.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3100',
};
