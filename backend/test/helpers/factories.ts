import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';

/**
 * Fábricas de datos de prueba. Crean todo a través de la API real (no
 * escribiendo directo en la base): así cada dato pasa por las mismas
 * validaciones y reglas que en producción.
 */

export interface TestUser {
  id: string;
  email: string;
  token: string;
  personalWalletId: string;
}

export interface SeededWallet {
  walletId: string;
  categoryId: string;
  subcategoryId: string;
  transactionId: string;
  debtId: string;
  goalId: string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const PASSWORD = 'clave-de-prueba-123';

/** Registra un usuario, inicia sesión y devuelve su token y wallet personal. */
export async function createUser(
  app: INestApplication<App>,
  name: string,
): Promise<TestUser> {
  const server = app.getHttpServer();
  const email = `${name.toLowerCase()}@test.cl`;

  await request(server)
    .post('/auth/signup')
    .send({ name, email, password: PASSWORD })
    .expect(201);

  const signin = await request(server)
    .post('/auth/signin')
    .send({ email, password: PASSWORD })
    .expect(200);
  const token: string = signin.body.access_token;

  const me = await request(server)
    .get('/users/me')
    .set(bearer(token))
    .expect(200);

  return {
    id: me.body.id,
    email,
    token,
    personalWalletId: me.body.memberships[0].wallet.id,
  };
}

/**
 * Llena una wallet con un recurso de cada tipo (categoría, subcategoría,
 * transacción, deuda y meta), para que los tests tengan algo que intentar
 * leer, editar o borrar.
 */
export async function seedWallet(
  app: INestApplication<App>,
  owner: TestUser,
  walletId: string,
): Promise<SeededWallet> {
  const server = app.getHttpServer();
  const auth = bearer(owner.token);

  const category = await request(server)
    .post('/categories')
    .set(auth)
    .send({ name: 'Hogar', walletId })
    .expect(201);

  const subcategory = await request(server)
    .post('/subcategories')
    .set(auth)
    .send({ name: 'Arriendo', categoryId: category.body.id })
    .expect(201);

  const transaction = await request(server)
    .post('/transactions')
    .set(auth)
    .send({
      amount: 450000,
      type: 'EXPENSE',
      date: '2026-11-05',
      description: 'Arriendo noviembre',
      walletId,
      subcategoryId: subcategory.body.id,
    })
    .expect(201);

  const debt = await request(server)
    .post('/debts')
    .set(auth)
    .send({
      name: 'Notebook',
      totalAmount: 600000,
      totalInstallments: 6,
      startDate: '2026-10-01',
      walletId,
    })
    .expect(201);

  const goal = await request(server)
    .post('/savings-goals')
    .set(auth)
    .send({ name: 'Vacaciones', targetAmount: 1000000, walletId })
    .expect(201);

  return {
    walletId,
    categoryId: category.body.id,
    subcategoryId: subcategory.body.id,
    transactionId: transaction.body.id,
    debtId: debt.body.id,
    goalId: goal.body.id,
  };
}
