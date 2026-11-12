import { expect, test } from '@playwright/test';
import { PASSWORD, createUser, slowDown } from './helpers';

/**
 * Inicio de sesión (Pasos 72 y 73): errores dentro del formulario, bienvenida
 * sin modal y botón bloqueado mientras responde el backend.
 */
test.describe('Inicio de sesión', () => {
  test('credenciales incorrectas se muestran en el formulario, sin modal', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Valentina Rojas');

    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Contraseña').fill('contraseña-equivocada');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      /Email o contraseña incorrectos/,
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login correcto entra al dashboard con bienvenida por el primer nombre', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Valentina Rojas');

    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Contraseña').fill(PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/dashboard\/home/);
    await expect(page.getByText('¡Hola, Valentina! Qué bueno verte de nuevo.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('apretar Ingresar varias veces con el backend lento manda un solo login', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Valentina Rojas');
    const signins = await slowDown(
      page,
      (url, method) => method === 'POST' && url.pathname === '/auth/signin',
      1500,
    );

    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Contraseña').fill(PASSWORD);
    const button = page.getByRole('button', { name: /Ingresar|Ingresando/ });
    await button.click();

    await expect(button).toHaveText('Ingresando…');
    await expect(button).toBeDisabled();
    for (let i = 0; i < 4; i++) {
      await button.click({ force: true }).catch(() => {});
    }

    await expect(page).toHaveURL(/\/dashboard\/home/);
    expect(signins.count()).toBe(1);
  });
});
