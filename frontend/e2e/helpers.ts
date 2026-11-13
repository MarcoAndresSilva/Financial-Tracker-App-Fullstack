import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { API_URL } from '../playwright.config';

/**
 * Preparación de datos para los tests de navegador. Todo se crea por la API
 * del backend de pruebas (rápido y sin depender de la UI); la UI se usa solo
 * para lo que cada test quiere verificar.
 */

export const PASSWORD = 'clave-de-prueba-123';

export interface E2EUser {
  name: string;
  email: string;
  token: string;
  personalWalletId: string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Email único por test: así los tests corren en paralelo sin chocar. */
function uniqueEmail(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z]/g, '');
  return `${slug}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@e2e.cl`;
}

export async function createUser(
  request: APIRequestContext,
  name: string,
): Promise<E2EUser> {
  const email = uniqueEmail(name);
  const signup = await request.post(`${API_URL}/auth/signup`, {
    data: { name, email, password: PASSWORD },
  });
  expect(signup.status()).toBe(201);

  const signin = await request.post(`${API_URL}/auth/signin`, {
    data: { email, password: PASSWORD },
  });
  const { access_token: token } = await signin.json();

  const me = await request.get(`${API_URL}/users/me`, { headers: auth(token) });
  const user = await me.json();

  return {
    name,
    email,
    token,
    personalWalletId: user.memberships[0].wallet.id,
  };
}

/** Crea una categoría con una subcategoría (lo mínimo para una transacción). */
export async function createCategory(
  request: APIRequestContext,
  user: E2EUser,
  walletId: string,
  name: string,
  subcategoryName: string,
): Promise<void> {
  const category = await request.post(`${API_URL}/categories`, {
    headers: auth(user.token),
    data: { name, walletId },
  });
  const { id: categoryId } = await category.json();
  await request.post(`${API_URL}/subcategories`, {
    headers: auth(user.token),
    data: { name: subcategoryName, categoryId },
  });
}

export async function createSharedWallet(
  request: APIRequestContext,
  owner: E2EUser,
  name: string,
  inviteEmail: string,
): Promise<string> {
  const res = await request.post(`${API_URL}/wallets/shared`, {
    headers: auth(owner.token),
    data: { name, inviteEmail },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

export async function countTransactions(
  request: APIRequestContext,
  user: E2EUser,
  walletId: string,
): Promise<number> {
  const res = await request.get(
    `${API_URL}/transactions?walletId=${walletId}`,
    { headers: auth(user.token) },
  );
  const body = await res.json();
  return (Array.isArray(body) ? body : body.data).length;
}

/**
 * Entra a la app con una sesión ya iniciada (token en localStorage), sin pasar
 * por el formulario de login. Equivale a volver a abrir la app con sesión.
 */
export async function openDashboardAs(page: Page, user: E2EUser): Promise<void> {
  await page.goto('/auth/login');
  await page.evaluate(
    (token) => localStorage.setItem('access_token', token),
    user.token,
  );
  await page.goto('/dashboard/home');
  await expect(page.getByText(`¡Hola, ${user.name}!`)).toBeVisible();
}

/** Demora artificial en las respuestas que cumplan `matches` (backend lento). */
export async function slowDown(
  page: Page,
  matches: (url: URL, method: string) => boolean,
  ms: number,
): Promise<{ count: () => number }> {
  let count = 0;
  await page.route(
    `${API_URL}/**`,
    async (route) => {
      const req = route.request();
      if (matches(new URL(req.url()), req.method())) {
        count++;
        await new Promise((r) => setTimeout(r, ms));
      }
      await route.continue();
    },
  );
  return { count: () => count };
}

/** Crea una deuda por la API y devuelve su respuesta (incluye subcategoryId). */
export async function createDebt(
  request: APIRequestContext,
  user: E2EUser,
  body: Record<string, unknown>,
): Promise<{ id: string; subcategoryId: string; categoryId: string }> {
  const res = await request.post(`${API_URL}/debts`, {
    headers: auth(user.token),
    data: { walletId: user.personalWalletId, ...body },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

/** Registra un gasto (por la API) en una subcategoría: si es de una deuda, es un pago. */
export async function createExpense(
  request: APIRequestContext,
  user: E2EUser,
  subcategoryId: string,
  amount: number,
  date: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/transactions`, {
    headers: auth(user.token),
    data: {
      amount,
      type: 'EXPENSE',
      date,
      description: 'Pago',
      walletId: user.personalWalletId,
      subcategoryId,
    },
  });
  expect(res.status()).toBe(201);
}

/**
 * Elige una opción de un mat-select. Se hace clic en el campo completo (como
 * un usuario) y no en el combobox: con el select vacío, Material deja la
 * etiqueta flotando encima del control.
 */
export async function pickOption(
  dialog: Locator,
  label: string,
  option: string,
): Promise<void> {
  const page = dialog.page();
  await dialog
    .locator('mat-form-field')
    .filter({ has: page.getByRole('combobox', { name: label, exact: true }) })
    .click();
  await page.getByRole('option', { name: option }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}
