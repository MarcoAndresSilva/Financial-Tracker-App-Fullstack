import { Page, expect, test } from '@playwright/test';
import {
  createDebt,
  createExpense,
  createUser,
  openDashboardAs,
  pickOption,
} from './helpers';

/**
 * CONTRATO VISUAL DE DEUDAS (Paso 78)
 *
 * El reloj del navegador se fija en el 12 de noviembre de 2026 y la UF del
 * backend de pruebas en $41.324,4 (playwright.config.ts): los textos esperados
 * no dependen del día en que se corra el test.
 */
const TODAY = new Date('2026-11-12T12:00:00-03:00');

const hipotecario = {
  name: 'Hipotecario',
  kind: 'INSTALLMENTS',
  totalInstallments: 300,
  installmentValue: 8.44,
  unit: 'UF',
  initialPaidInstallments: 41,
  nextDueDate: '2026-12-01',
};

const debtCard = (page: Page, name: string) =>
  page.locator('mat-card').filter({ hasText: name });

test.describe('Deudas', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
  });

  test('registrar el hipotecario en lenguaje de cuotas y verlo como en el banco', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Marco');
    await openDashboardAs(page, user);
    await page.goto('/dashboard/debts');

    await page.getByRole('button', { name: 'Nueva deuda' }).click();
    const dialog = page.getByRole('dialog');

    // En cuotas es el tipo por defecto.
    await expect(
      dialog.getByRole('radio', { name: 'En cuotas', checked: true }),
    ).toBeVisible();
    await dialog.getByLabel('Nombre', { exact: true }).fill('Hipotecario');
    await dialog.getByRole('radio', { name: 'UF', exact: true }).click();
    await dialog.getByLabel('Valor de la cuota', { exact: true }).fill('8.44');
    await dialog.getByLabel('Total de cuotas', { exact: true }).fill('300');
    await dialog.getByLabel('Cuotas ya pagadas', { exact: true }).fill('41');
    await dialog.getByLabel('Día de vencimiento', { exact: true }).fill('1');

    // El 1 de noviembre ya pasó: sugiere el 1 de diciembre como la próxima.
    await expect(
      dialog.getByRole('radio', { name: /^1 dic\.? 2026$/, checked: true }),
    ).toBeVisible();
    // Resumen en vivo antes de guardar.
    await expect(dialog).toContainText('Próxima: cuota 42 de 300');
    await expect(dialog).toContainText('Te quedan 259 cuotas');
    await expect(dialog).toContainText('terminas en junio 2048');

    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toHaveCount(0);

    const card = debtCard(page, 'Hipotecario');
    await expect(card).toContainText('Cuota 42 de 300');
    await expect(card).toContainText('UF 8,44');
    await expect(card).toContainText('≈ $348.778');
    await expect(card).toContainText('Vence el 1 dic 2026');
    await expect(card).toContainText('Te quedan 259 cuotas');
    await expect(card).toContainText('Terminas en jun 2048');
  });

  test('"Registrar pago" abre la transacción ya lista y suma la cuota', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Marco');
    await createDebt(request, user, hipotecario);
    await openDashboardAs(page, user);
    await page.goto('/dashboard/debts');

    const card = debtCard(page, 'Hipotecario');
    await card.getByRole('button', { name: 'Registrar pago' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Deudas');
    await expect(dialog).toContainText('Hipotecario');
    await expect(dialog.getByLabel('Monto')).toHaveValue('348778');
    await expect(dialog).toContainText(
      'Cuota 42 de 300 · se suma a tu deuda Hipotecario',
    );

    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(card).toContainText('Cuota 43 de 300');
    await expect(card).toContainText('Vence el 1 ene 2027');
  });

  test('el formulario de transacción reconoce la subcategoría de una deuda', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Marco');
    await createDebt(request, user, {
      name: 'Tarjeta Falabella',
      kind: 'INSTALLMENTS',
      totalInstallments: 12,
      installmentValue: 45000,
      unit: 'CLP',
      initialPaidInstallments: 4,
      nextDueDate: '2026-12-15',
    });
    await openDashboardAs(page, user);

    await page.getByRole('button', { name: 'Añadir transacción' }).click();
    const dialog = page.getByRole('dialog');
    await pickOption(dialog, 'Categoría', 'Deudas');
    await pickOption(dialog, 'Subcategoría', 'Tarjeta Falabella');

    await expect(dialog).toContainText(
      'Cuota 5 de 12 · se suma a tu deuda Tarjeta Falabella',
    );
    // Monto vacío → propone el valor de la cuota.
    await expect(dialog.getByLabel('Monto')).toHaveValue('45000');
  });

  test('una deuda de monto libre muestra lo pagado y una estimación honesta', async ({
    page,
    request,
  }) => {
    const user = await createUser(request, 'Marco');
    const prestamo = await createDebt(request, user, {
      name: 'Préstamo familiar',
      kind: 'FREE_AMOUNT',
      totalAmount: 3_000_000,
    });
    await createExpense(request, user, prestamo.subcategoryId, 300_000, '2026-10-05');
    await createExpense(request, user, prestamo.subcategoryId, 150_000, '2026-11-05');
    await openDashboardAs(page, user);
    await page.goto('/dashboard/debts');

    const card = debtCard(page, 'Préstamo familiar');
    await expect(card).toContainText('Monto libre');
    await expect(card).toContainText('Pagado $450.000 de $3.000.000');
    await expect(card).toContainText('Quedan $2.550.000');
    // Promedio $225.000 → 12 meses desde el último pago (5 nov 2026).
    await expect(card).toContainText('Al ritmo actual, terminas ~nov 2027');
  });
});
