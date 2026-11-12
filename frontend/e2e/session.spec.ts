import { expect, test } from '@playwright/test';
import { createSharedWallet, createUser, openDashboardAs } from './helpers';

/**
 * Sesión y contexto de la app al recargar (Pasos 70, 71 y 72).
 */
test.describe('Sesión y recarga', () => {
  test('recargar (F5) dentro del dashboard mantiene usuario y wallet', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Valentina');
    await openDashboardAs(page, user);

    await page.reload();

    await expect(page.getByText('¡Hola, Valentina!')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cartera: Personal/ })).toBeVisible();
    await expect(page.getByText(/Cargando/)).toHaveCount(0);
  });

  test('la wallet elegida se recuerda al recargar', async ({ page, request }) => {
    const owner = await createUser(request, 'Valentina');
    const partner = await createUser(request, 'Tomás');
    await createSharedWallet(request, owner, 'Casa', partner.email);
    await openDashboardAs(page, owner);

    await page.getByRole('button', { name: /Cartera: Personal/ }).click();
    await page.getByRole('menuitem', { name: /Casa/ }).click();
    await expect(page.getByRole('button', { name: /Cartera: Casa/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /Cartera: Casa/ })).toBeVisible();
  });

  test('una sesión vencida muestra UN solo aviso y vuelve al login', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await page.evaluate(() =>
      localStorage.setItem('access_token', 'token-vencido-o-invalido'),
    );

    // El Home dispara varias peticiones a la vez y todas vuelven con 401.
    await page.goto('/dashboard/home');

    await expect(page).toHaveURL(/\/auth\/login/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Tu sesión expiró');
    // Margen para que lleguen las demás respuestas 401 antes de contar.
    await page.waitForTimeout(1000);
    await expect(dialog).toHaveCount(1);
  });
});
