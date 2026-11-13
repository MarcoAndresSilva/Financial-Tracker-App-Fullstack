import { expect, test } from '@playwright/test';
import {
  countTransactions,
  createCategory,
  createUser,
  openDashboardAs,
  pickOption,
  slowDown,
} from './helpers';

/**
 * Crear transacciones (Paso 73): con el backend lento, apretar Guardar varias
 * veces duplicaba la transacción. Es el bug que motivó bloquear el botón.
 */
test.describe('Nueva transacción', () => {
  test('apretar Guardar varias veces con el backend lento crea una sola transacción', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Valentina Rojas');
    await createCategory(request, user, user.personalWalletId, 'Comida', 'Supermercado');
    const creates = await slowDown(
      page,
      (url, method) => method === 'POST' && url.pathname === '/transactions',
      1500,
    );

    await openDashboardAs(page, user);
    await page.getByRole('button', { name: 'Añadir transacción' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Monto').fill('15990');
    await dialog.getByLabel('Descripción').fill('Compra semanal');
    await pickOption(dialog, 'Categoría', 'Comida');
    await pickOption(dialog, 'Subcategoría', 'Supermercado');

    await dialog.getByRole('button', { name: 'Guardar' }).click();
    const saving = dialog.getByRole('button', { name: 'Guardando…' });
    await expect(saving).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    for (let i = 0; i < 4; i++) {
      await saving.click({ force: true }).catch(() => {});
    }

    await expect(dialog).toHaveCount(0);
    expect(creates.count()).toBe(1);
    expect(await countTransactions(request, user, user.personalWalletId)).toBe(1);
  });
});

