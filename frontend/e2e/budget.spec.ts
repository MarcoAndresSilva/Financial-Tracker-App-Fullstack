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
): Promise<string> {
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
  return cat.id;
}

/** Define el presupuesto de una categoría "desde diciembre". */
async function setBudget(
  request: APIRequestContext,
  user: E2EUser,
  categoryId: string,
  amount: number,
): Promise<void> {
  const res = await request.put(`${API_URL}/budget/entries`, {
    headers: { Authorization: `Bearer ${user.token}` },
    data: { categoryId, year: 2026, month: 12, scope: 'FROM_MONTH', amount },
  });
  expect(res.status()).toBe(200);
}

test.describe('Presupuesto', () => {
  let user: E2EUser;
  let supermercadoId: string;

  test.beforeEach(async ({ page, request }) => {
    await page.clock.setFixedTime(TODAY);
    user = await createUser(request, 'Marco');
    await categoryWithMovement(request, user, 'Ingresos', 'Sueldo', 'INCOME', 2_440_000);
    supermercadoId = await categoryWithMovement(
      request,
      user,
      'Supermercado',
      'Compras',
      'EXPENSE',
      240_000,
    );
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
    await page.getByRole('link', { name: 'Presupuesto', exact: true }).click();
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

  // ---------------------------------------------------------------------
  // Card del presupuesto en el Home (Paso 84)
  // ---------------------------------------------------------------------

  test('Home: sin presupuesto este mes, la card invita a armarlo', async ({ page }) => {
    const card = page.getByTestId('home-budget');
    await expect(card).toContainText('Aún no armas el presupuesto de diciembre');

    await card.getByRole('link', { name: 'Armar presupuesto' }).click();
    await expect(page).toHaveURL(/\/dashboard\/budget/);
  });

  test('Home: muestra lo sin asignar y solo las categorías que necesitan atención', async ({
    page,
    request,
  }) => {
    const salidasId = await categoryWithMovement(
      request,
      user,
      'Salidas',
      'Bar',
      'EXPENSE',
      95_000,
    );
    const mascotasId = await categoryWithMovement(
      request,
      user,
      'Mascotas',
      'Comida',
      'EXPENSE',
      10_000,
    );
    await setBudget(request, user, supermercadoId, 300_000); // 80% → cerca del tope
    await setBudget(request, user, salidasId, 50_000); // 190% → te pasaste
    await setBudget(request, user, mascotasId, 100_000); // 10% → va bien
    await page.reload();

    const card = page.getByTestId('home-budget');
    // 2.440.000 − 348.778 (hipotecario) − 450.000 planificado
    await expect(card).toContainText('$1.641.222');

    // Lo que se pasó va primero; lo que va bien no aparece.
    const items = card.getByTestId('home-budget-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Salidas');
    await expect(items.nth(0)).toContainText('Te pasaste por $45.000');
    await expect(items.nth(1)).toContainText('Supermercado');
    await expect(items.nth(1)).toContainText('Te quedan $60.000');
    await expect(card).not.toContainText('Mascotas');

    await expect(card).toContainText('0 de 1 deudas pagadas');
    await card.getByRole('link', { name: /Ver presupuesto/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/budget/);
  });
});
