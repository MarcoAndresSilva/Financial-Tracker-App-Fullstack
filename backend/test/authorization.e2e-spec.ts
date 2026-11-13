import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetDatabase } from './helpers/test-app';
import {
  bearer,
  createUser,
  seedWallet,
  SeededWallet,
  TestUser,
} from './helpers/factories';

/**
 * CONTRATO DE AUTORIZACIÓN
 *
 * Cada dato vive dentro de una wallet, y solo sus miembros pueden tocarlo.
 * Escenario:
 *   - Ana:   dueña de una wallet personal con datos (categoría, transacción...).
 *   - Beto:  usuario válido, con sesión, pero ajeno a la wallet de Ana.
 *   - Carla: miembro (no dueña) de una wallet compartida con Ana.
 *
 * Si alguno de estos tests falla, alguien puede ver o modificar plata ajena.
 */
describe('Autorización por wallet (e2e)', () => {
  let app: INestApplication<App>;
  let ana: TestUser;
  let beto: TestUser;
  let carla: TestUser;
  let anaData: SeededWallet;
  let betoData: SeededWallet;
  let sharedWalletId: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);

    ana = await createUser(app, 'Ana');
    beto = await createUser(app, 'Beto');
    carla = await createUser(app, 'Carla');
    anaData = await seedWallet(app, ana, ana.personalWalletId);
    betoData = await seedWallet(app, beto, beto.personalWalletId);

    const shared = await api()
      .post('/wallets/shared')
      .set(bearer(ana.token))
      .send({ name: 'Casa', inviteEmail: carla.email })
      .expect(201);
    sharedWalletId = shared.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------
  // 1. Un usuario ajeno no puede leer ni modificar nada de la wallet de Ana.
  //    Tabla de casos: cada fila es un endpoint que Beto intenta usar.
  // ---------------------------------------------------------------------
  type Method = 'get' | 'post' | 'patch' | 'delete';
  interface IntruderCase {
    name: string;
    method: Method;
    path: (d: SeededWallet) => string;
    body?: (d: SeededWallet) => object;
  }

  const intruderCases: IntruderCase[] = [
    // Categorías
    {
      name: 'listar categorías',
      method: 'get',
      path: (d) => `/categories?walletId=${d.walletId}`,
    },
    {
      name: 'ver una categoría',
      method: 'get',
      path: (d) => `/categories/${d.categoryId}`,
    },
    {
      name: 'crear categoría',
      method: 'post',
      path: () => '/categories',
      body: (d) => ({ name: 'Hackeo', walletId: d.walletId }),
    },
    {
      name: 'editar categoría',
      method: 'patch',
      path: (d) => `/categories/${d.categoryId}`,
      body: () => ({ name: 'Hackeo' }),
    },
    {
      name: 'borrar categoría',
      method: 'delete',
      path: (d) => `/categories/${d.categoryId}`,
    },
    // Subcategorías
    {
      name: 'listar subcategorías',
      method: 'get',
      path: (d) => `/subcategories?categoryId=${d.categoryId}`,
    },
    {
      name: 'ver una subcategoría',
      method: 'get',
      path: (d) => `/subcategories/${d.subcategoryId}`,
    },
    {
      name: 'crear subcategoría',
      method: 'post',
      path: () => '/subcategories',
      body: (d) => ({ name: 'Hackeo', categoryId: d.categoryId }),
    },
    {
      name: 'editar subcategoría',
      method: 'patch',
      path: (d) => `/subcategories/${d.subcategoryId}`,
      body: () => ({ name: 'Hackeo' }),
    },
    {
      name: 'borrar subcategoría',
      method: 'delete',
      path: (d) => `/subcategories/${d.subcategoryId}`,
    },
    // Transacciones
    {
      name: 'listar transacciones',
      method: 'get',
      path: (d) => `/transactions?walletId=${d.walletId}`,
    },
    {
      name: 'ver una transacción',
      method: 'get',
      path: (d) => `/transactions/${d.transactionId}`,
    },
    {
      name: 'crear transacción',
      method: 'post',
      path: () => '/transactions',
      body: (d) => ({
        amount: 1,
        type: 'EXPENSE',
        date: '2026-11-05',
        description: 'Hackeo',
        walletId: d.walletId,
        subcategoryId: d.subcategoryId,
      }),
    },
    {
      name: 'editar transacción',
      method: 'patch',
      path: (d) => `/transactions/${d.transactionId}`,
      body: () => ({ amount: 1 }),
    },
    {
      name: 'borrar transacción',
      method: 'delete',
      path: (d) => `/transactions/${d.transactionId}`,
    },
    {
      name: 'mover transacciones en lote',
      method: 'patch',
      path: () => '/transactions/bulk-move',
      body: (d) => ({
        walletId: d.walletId,
        transactionIds: [d.transactionId],
        date: '2020-01-01',
      }),
    },
    {
      name: 'copiar transacciones en lote',
      method: 'post',
      path: () => '/transactions/bulk-copy',
      body: (d) => ({
        walletId: d.walletId,
        transactionIds: [d.transactionId],
        date: '2020-01-01',
      }),
    },
    // Deudas
    {
      name: 'crear deuda',
      method: 'post',
      path: () => '/debts',
      body: (d) => ({
        name: 'Hackeo',
        kind: 'FREE_AMOUNT',
        totalAmount: 1,
        walletId: d.walletId,
      }),
    },
    {
      name: 'listar deudas',
      method: 'get',
      path: (d) => `/debts?walletId=${d.walletId}`,
    },
    { name: 'ver una deuda', method: 'get', path: (d) => `/debts/${d.debtId}` },
    {
      name: 'editar deuda',
      method: 'patch',
      path: (d) => `/debts/${d.debtId}`,
      body: () => ({ name: 'Hackeo' }),
    },
    {
      name: 'borrar deuda',
      method: 'delete',
      path: (d) => `/debts/${d.debtId}`,
    },
    // Metas de ahorro
    {
      name: 'listar metas',
      method: 'get',
      path: (d) => `/savings-goals?walletId=${d.walletId}`,
    },
    {
      name: 'editar meta',
      method: 'patch',
      path: (d) => `/savings-goals/${d.goalId}`,
      body: () => ({ name: 'Hackeo' }),
    },
    {
      name: 'aportar a una meta',
      method: 'post',
      path: (d) => `/savings-goals/${d.goalId}/contributions`,
      body: () => ({ amount: 1 }),
    },
    {
      name: 'borrar meta',
      method: 'delete',
      path: (d) => `/savings-goals/${d.goalId}`,
    },
    // Dashboard (solo lectura, pero revela montos)
    {
      name: 'resumen histórico',
      method: 'get',
      path: (d) => `/dashboard/summary?walletId=${d.walletId}`,
    },
    {
      name: 'resumen del mes',
      method: 'get',
      path: (d) => `/dashboard/monthly-summary?walletId=${d.walletId}`,
    },
    {
      name: 'gastos por categoría',
      method: 'get',
      path: (d) => `/dashboard/expenses-by-category?walletId=${d.walletId}`,
    },
    {
      name: 'ingresos por categoría',
      method: 'get',
      path: (d) => `/dashboard/income-by-category?walletId=${d.walletId}`,
    },
    {
      name: 'ahorro',
      method: 'get',
      path: (d) => `/dashboard/savings?walletId=${d.walletId}`,
    },
    {
      name: 'desglose anual',
      method: 'get',
      path: (d) => `/dashboard/yearly-breakdown?walletId=${d.walletId}`,
    },
    // La wallet misma
    {
      name: 'ver miembros de la wallet',
      method: 'get',
      path: (d) => `/wallets/${d.walletId}/members`,
    },
    {
      name: 'editar la wallet',
      method: 'patch',
      path: (d) => `/wallets/${d.walletId}`,
      body: () => ({ name: 'Hackeo' }),
    },
    {
      name: 'borrar la wallet',
      method: 'delete',
      path: (d) => `/wallets/${d.walletId}`,
    },
  ];

  describe('un usuario ajeno recibe 403 al intentar…', () => {
    it.each(intruderCases)('$name', async ({ method, path, body }) => {
      const res = await api()
        [method](path(anaData))
        .set(bearer(beto.token))
        .send(body?.(anaData));

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------
  // 2. Referencias cruzadas: Beto opera en SU wallet, pero apuntando a
  //    recursos de la de Ana. Es el ataque menos obvio.
  // ---------------------------------------------------------------------
  describe('referencias cruzadas entre wallets', () => {
    it('no se puede crear una transacción propia usando una subcategoría ajena', async () => {
      const res = await api()
        .post('/transactions')
        .set(bearer(beto.token))
        .send({
          amount: 1,
          type: 'EXPENSE',
          date: '2026-11-05',
          description: 'Colgada de Ana',
          walletId: betoData.walletId,
          subcategoryId: anaData.subcategoryId,
        });

      expect(res.status).toBe(403);
    });

    it('copiar en lote con la wallet propia e ids ajenos no copia nada', async () => {
      const res = await api()
        .post('/transactions/bulk-copy')
        .set(bearer(beto.token))
        .send({
          walletId: betoData.walletId,
          transactionIds: [anaData.transactionId],
          date: '2026-12-01',
        });

      expect(res.body.count).toBe(0);
    });

    it('mover en lote con la wallet propia e ids ajenos no mueve nada', async () => {
      const res = await api()
        .patch('/transactions/bulk-move')
        .set(bearer(beto.token))
        .send({
          walletId: betoData.walletId,
          transactionIds: [anaData.transactionId],
          date: '2020-01-01',
        });

      expect(res.body.count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // 3. Después de todos los intentos, los datos de Ana siguen intactos.
  //    Un 403 que igual alcanzó a modificar algo también sería un bug.
  // ---------------------------------------------------------------------
  describe('tras todos los intentos', () => {
    it('los datos de Ana quedan intactos', async () => {
      const auth = bearer(ana.token);

      const tx = await api()
        .get(`/transactions/${anaData.transactionId}`)
        .set(auth)
        .expect(200);
      expect(Number(tx.body.amount)).toBe(450000);
      expect(tx.body.description).toBe('Arriendo noviembre');
      expect(tx.body.date).toContain('2026-11-05');

      const list = await api()
        .get(`/transactions?walletId=${anaData.walletId}`)
        .set(auth)
        .expect(200);
      const items = Array.isArray(list.body) ? list.body : list.body.data;
      expect(items).toHaveLength(1);

      const category = await api()
        .get(`/categories/${anaData.categoryId}`)
        .set(auth)
        .expect(200);
      expect(category.body.name).toBe('Hogar');
    });
  });

  // ---------------------------------------------------------------------
  // 4. Roles en una wallet compartida: el MEMBER usa la wallet, pero su
  //    configuración es solo del OWNER.
  // ---------------------------------------------------------------------
  describe('wallet compartida: MEMBER vs OWNER', () => {
    it('el miembro puede ver la wallet y sus miembros', async () => {
      await api()
        .get(`/wallets/${sharedWalletId}/members`)
        .set(bearer(carla.token))
        .expect(200);
    });

    it('el miembro puede crear categorías en la wallet compartida', async () => {
      await api()
        .post('/categories')
        .set(bearer(carla.token))
        .send({ name: 'Supermercado', walletId: sharedWalletId })
        .expect(201);
    });

    it('el miembro NO puede editar la wallet', async () => {
      await api()
        .patch(`/wallets/${sharedWalletId}`)
        .set(bearer(carla.token))
        .send({ name: 'Mía' })
        .expect(403);
    });

    it('el miembro NO puede borrar la wallet', async () => {
      await api()
        .delete(`/wallets/${sharedWalletId}`)
        .set(bearer(carla.token))
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------
  // 5. Sin sesión no se entra a nada.
  // ---------------------------------------------------------------------
  describe('sin token', () => {
    it.each([
      ['/users/me'],
      ['/wallets'],
      ['/transactions?walletId=00000000-0000-0000-0000-000000000000'],
    ])('GET %s → 401', async (path) => {
      await api().get(path).expect(401);
    });

    it('un token inventado tampoco sirve', async () => {
      await api().get('/users/me').set(bearer('token.falso.123')).expect(401);
    });
  });
});
