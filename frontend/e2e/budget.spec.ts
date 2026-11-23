import { APIRequestContext, expect, test } from '@playwright/test';
import { API_URL } from '../playwright.config';
import { E2EUser, createDebt, createUser, openDashboardAs } from './helpers';

/**
 * CONTRATO VISUAL DEL PRESUPUESTO (Paso 82)
 *
 * Solo el flujo principal: las reglas (qué monto aplica, colores, compromisos,
 * sin asignar) ya están probadas en el backend (Pasos 80–81).
 *
 * Reloj del navegador: 15 de diciembre de 2026 → la página abre en diciembre.
 * UF fija del backend de pruebas: $41.324,4 → dividendo ≈ $348.778.
 */
const TODAY = new Date('2026-12-15T12:00:00-03:00');

/** Crea una categoría con una subcategoría y un movimiento en diciembre. */
async function categoryWithMovement(
  request: APIRequestContext,
  user: E2EUser,
  category: string,
  subcategory: string,
  type: 'INCOME' | 'EXPENSE',
  amount: number,
): Promise<void> {
  const headers = { Authorization: `Bearer ${user.token}` };
  const cat = await (
    await request.post(`${API_URL}/categories`, {
      headers,
      data: { name: category, walletId: user.personalWalletId },
    })
  ).json();
  const sub = await (
    await request.post(`${API_URL}/subcategories`, {
      headers,
      data: { name: subcategory, categoryId: cat.id },
    })
  ).json();
  const tx = await request.post(`${API_URL}/transactions`, {
    headers,
    data: {
      amount,
      type,
      date: '2026-12-05',
      description: subcategory,
      walletId: user.personalWalletId,
      subcategoryId: sub.id,
    },
  });
  expect(tx.status()).toBe(201);
}

test.describe('Presupuesto', () => {
  let user: E2EUser;

  test.beforeEach(async ({ page, request }) => {
    await page.clock.setFixedTime(TODAY);
    user = await createUser(request, 'Marco');
    await categoryWithMovement(request, user, 'Ingresos', 'Sueldo', 'INCOME', 2_440_000);
    await categoryWithMovement(request, user, 'Supermercado', 'Compras', 'EXPENSE', 240_000);
    await createDebt(request, user, {
      name: 'Hipotecario',
      kind: 'INSTALLMENTS',
      totalInstallments: 300,
      installmentValue: 8.44,
      unit: 'UF',
      initialPaidInstallments: 41,
      nextDueDate: '2026-12-01',
    });
    await openDashboardAs(page, user);
  });

  test('el plan del mes: ingresos, compromisos de deudas y lo que queda sin asignar', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Presupuesto' }).click();
    await expect(page).toHaveURL(/\/dashboard\/budget/);
    await expect(page.getByText('Diciembre 2026').first()).toBeVisible();

    const summary = page.getByTestId('plan-summary');
    await expect(summary).toContainText('$2.440.000'); // ingresos
    await expect(summary).toContainText('$348.778'); // compromisos de deudas
    await expect(summary).toContainText('$2.091.222'); // sin asignar

    const commitments = page.getByTestId('debt-commitments');
    await expect(commitments).toContainText('Hipotecario');
    await expect(commitments).toContainText('Cuota 42 de 300');
    await expect(commitments.getByRole('link', { name: /Ver en Deudas/ })).toBeVisible();
  });

  test('definir el presupuesto de una categoría y ver su barra con su color', async ({
    page,
  }) => {
    await page.goto('/dashboard/budget');

    // Supermercado parte sin presupuesto.
    const unbudgeted = page.getByTestId('unbudgeted');
    await unbudgeted.getByRole('button', { name: 'Definir presupuesto de Supermercado' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Supermercado');
    // Por defecto: este mes y los siguientes (el monto habitual).
    await expect(
      dialog.getByRole('radio', { name: 'Diciembre y los siguientes', checked: true }),
    ).toBeVisible();
    await dialog.getByLabel('Monto mensual').fill('300000');
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toHaveCount(0);

    // $240.000 de $300.000 = 80% → amarillo ("cerca del tope").
    const line = page.getByTestId('budget-line').filter({ hasText: 'Supermercado' });
    await expect(line).toContainText('$240.000 de $300.000');
    await expect(line).toContainText('Te quedan $60.000');
    await expect(line).toHaveAttribute('data-status', 'WARNING');

    // Sin asignar = 2.440.000 − 348.778 − 300.000
    await expect(page.getByTestId('plan-summary')).toContainText('$1.791.222');
  });
});
