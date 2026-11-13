import { APIRequestContext, expect, test } from '@playwright/test';
import { API_URL } from '../playwright.config';
import {
  E2EUser,
  createCategory,
  createUser,
  openDashboardAs,
  pickOption,
} from './helpers';

/**
 * FECHAS TIPEADAS A MANO (Paso 79)
 *
 * En Chile las fechas se escriben día-mes-año. El adaptador nativo de Material
 * usaba el parser del navegador, que lee "01-12-2026" como mes-día-año: 12 de
 * enero. Estos tests tipean la fecha (sin usar el calendario) y verifican en
 * la API qué día quedó guardado de verdad.
 */
async function savedDates(
  request: APIRequestContext,
  user: E2EUser,
): Promise<string[]> {
  const res = await request.get(
    `${API_URL}/transactions?walletId=${user.personalWalletId}`,
    { headers: { Authorization: `Bearer ${user.token}` } },
  );
  const body = await res.json();
  const items = Array.isArray(body) ? body : body.data;
  return items.map((t: { date: string }) => t.date.slice(0, 10));
}

test.describe('Fechas escritas a mano', () => {
  let user: E2EUser;

  test.beforeEach(async ({ page, request }) => {
    user = await createUser(request, 'Marco');
    await createCategory(request, user, user.personalWalletId, 'Hogar', 'Luz');
    await openDashboardAs(page, user);
    await page.getByRole('button', { name: 'Añadir transacción' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Monto').fill('25000');
    await dialog.getByLabel('Descripción').fill('Cuenta de luz');
    await pickOption(dialog, 'Categoría', 'Hogar');
    await pickOption(dialog, 'Subcategoría', 'Luz');
  });

  for (const [typed, expected] of [
    ['01-12-2026', '2026-12-01'], // día-mes-año con guiones
    ['1/12/2026', '2026-12-01'], // con barras y sin cero
    ['15.3.2027', '2027-03-15'], // con puntos
    ['5-1-27', '2027-01-05'], // año de dos dígitos
  ]) {
    test(`"${typed}" se guarda como ${expected}`, async ({ page, request }) => {
      const dialog = page.getByRole('dialog');
      const date = dialog.getByLabel('Fecha de la Transacción');
      await date.fill(typed);
      await date.blur();

      await dialog.getByRole('button', { name: 'Guardar' }).click();
      await expect(dialog).toHaveCount(0);

      expect(await savedDates(request, user)).toEqual([expected]);
    });
  }

  test('una fecha que no existe (31-02-2026) no deja guardar', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    const date = dialog.getByLabel('Fecha de la Transacción');
    await date.fill('31-02-2026');
    await date.blur();

    await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  test('la fecha elegida se muestra como día-mes-año', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    const date = dialog.getByLabel('Fecha de la Transacción');
    await date.fill('1/12/2026');
    await date.blur();

    // Al salir del campo se reescribe en el formato de siempre.
    await expect(date).toHaveValue('01-12-2026');
  });
});
