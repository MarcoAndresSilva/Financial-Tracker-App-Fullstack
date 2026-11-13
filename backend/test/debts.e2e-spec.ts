import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetDatabase } from './helpers/test-app';
import { bearer, createUser, TestUser } from './helpers/factories';

/**
 * CONTRATO DE DEUDAS (API)
 *
 * Una deuda vive conectada a una subcategoría dentro de la categoría "Deudas".
 * Registrar un GASTO en esa subcategoría ES pagar una cuota: no hay que
 * vincular nada a mano. El cálculo del progreso lo hace debt-progress.ts
 * (Paso 76); acá se prueba que la API le entregue los datos correctos.
 *
 * La UF se fija en 41.324,4 (createTestApp), nunca se consulta la API real.
 */
describe('Deudas (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  let walletId: string;

  const api = () => request(app.getHttpServer());
  const auth = () => bearer(user.token);

  const hipotecario = () => ({
    name: 'Hipotecario',
    kind: 'INSTALLMENTS',
    totalInstallments: 300,
    installmentValue: 8.44,
    unit: 'UF',
    initialPaidInstallments: 41,
    nextDueDate: '2026-12-01',
    walletId,
  });

  /** Registra un movimiento en la subcategoría de una deuda. */
  const registerMovement = (
    subcategoryId: string,
    amount: number,
    type: 'EXPENSE' | 'INCOME' = 'EXPENSE',
  ) =>
    api()
      .post('/transactions')
      .set(auth())
      .send({
        amount,
        type,
        date: '2026-11-30',
        description: 'Pago',
        walletId,
        subcategoryId,
      })
      .expect(201);

  const getDebt = async (id: string) =>
    (await api().get(`/debts/${id}`).set(auth()).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    user = await createUser(app, 'Marco');
    walletId = user.personalWalletId;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------
  describe('crear una deuda en cuotas (el hipotecario)', () => {
    let debt: any;

    beforeAll(async () => {
      debt = (
        await api().post('/debts').set(auth()).send(hipotecario()).expect(201)
      ).body;
    });

    it('devuelve los datos tal como se registraron', () => {
      expect(debt).toMatchObject({
        name: 'Hipotecario',
        kind: 'INSTALLMENTS',
        totalInstallments: 300,
        installmentValue: 8.44,
        unit: 'UF',
        initialPaidInstallments: 41,
      });
    });

    it('crea sola la categoría "Deudas" con una subcategoría "Hipotecario"', async () => {
      const categories = (
        await api()
          .get(`/categories?walletId=${walletId}`)
          .set(auth())
          .expect(200)
      ).body;
      const deudas = categories.find((c: any) => c.name === 'Deudas');
      expect(deudas).toBeDefined();

      const subcategories = (
        await api()
          .get(`/subcategories?categoryId=${deudas.id}`)
          .set(auth())
          .expect(200)
      ).body;
      const sub = subcategories.find((s: any) => s.name === 'Hipotecario');
      expect(sub).toBeDefined();
      expect(debt.subcategoryId).toBe(sub.id);
    });

    it('calcula el progreso: dividendo 42 de 300, vence el 1 de diciembre', () => {
      expect(debt.progress).toMatchObject({
        paidInstallments: 41,
        nextInstallmentNumber: 42,
        remainingInstallments: 259,
        installmentValueClp: 348778,
        installmentValueSource: 'UF_TODAY',
      });
      expect(debt.progress.nextDueDate).toContain('2026-12-01');
      expect(debt.progress.endDate).toContain('2048-06-01');
    });

    it('aparece en el listado de deudas de la wallet', async () => {
      const list = (
        await api().get(`/debts?walletId=${walletId}`).set(auth()).expect(200)
      ).body;
      expect(list.map((d: any) => d.name)).toContain('Hipotecario');
    });

    // -------------------------------------------------------------------
    describe('los pagos se vinculan solos por la subcategoría', () => {
      it('un gasto en la subcategoría de la deuda suma una cuota', async () => {
        await registerMovement(debt.subcategoryId, 348778);

        const updated = await getDebt(debt.id);
        expect(updated.progress.paidInstallments).toBe(42);
        expect(updated.progress.nextInstallmentNumber).toBe(43);
        expect(updated.progress.nextDueDate).toContain('2027-01-01');
      });

      it('un ingreso en esa subcategoría NO cuenta como pago', async () => {
        await registerMovement(debt.subcategoryId, 10000, 'INCOME');
        expect((await getDebt(debt.id)).progress.paidInstallments).toBe(42);
      });

      it('borrar el pago descuenta la cuota', async () => {
        const tx = (await registerMovement(debt.subcategoryId, 348778)).body;
        expect((await getDebt(debt.id)).progress.paidInstallments).toBe(43);

        await api().delete(`/transactions/${tx.id}`).set(auth()).expect(204);
        expect((await getDebt(debt.id)).progress.paidInstallments).toBe(42);
      });

      it('mover el pago a otra subcategoría también lo descuenta', async () => {
        const otra = await createCategoryWithSub('Hogar', 'Luz');
        const tx = (await registerMovement(debt.subcategoryId, 348778)).body;
        expect((await getDebt(debt.id)).progress.paidInstallments).toBe(43);

        await api()
          .patch(`/transactions/${tx.id}`)
          .set(auth())
          .send({ subcategoryId: otra })
          .expect(200);
        expect((await getDebt(debt.id)).progress.paidInstallments).toBe(42);
      });
    });
  });

  // ---------------------------------------------------------------------
  describe('la categoría "Deudas" y las subcategorías', () => {
    it('una segunda deuda reutiliza la categoría "Deudas" (no la duplica)', async () => {
      await api()
        .post('/debts')
        .set(auth())
        .send({
          name: 'Tarjeta Falabella',
          kind: 'INSTALLMENTS',
          totalInstallments: 12,
          installmentValue: 45000,
          unit: 'CLP',
          initialPaidInstallments: 4,
          nextDueDate: '2026-12-15',
          walletId,
        })
        .expect(201);

      const categories = (
        await api()
          .get(`/categories?walletId=${walletId}`)
          .set(auth())
          .expect(200)
      ).body;
      expect(categories.filter((c: any) => c.name === 'Deudas')).toHaveLength(
        1,
      );
    });

    it('si ya existía una subcategoría con ese nombre en "Deudas", la usa pero no cuenta los gastos anteriores', async () => {
      const deudas = await findCategory('Deudas');
      const sub = (
        await api()
          .post('/subcategories')
          .set(auth())
          .send({ name: 'Tarjeta Paris', categoryId: deudas.id })
          .expect(201)
      ).body;
      await registerMovement(sub.id, 30000); // gasto ANTES de crear la deuda

      const debt = (
        await api()
          .post('/debts')
          .set(auth())
          .send({
            name: 'Tarjeta Paris',
            kind: 'INSTALLMENTS',
            totalInstallments: 6,
            installmentValue: 30000,
            unit: 'CLP',
            initialPaidInstallments: 2,
            nextDueDate: '2026-12-05',
            walletId,
          })
          .expect(201)
      ).body;

      expect(debt.subcategoryId).toBe(sub.id);
      // El gasto previo ya está incluido en las 2 "ya pagadas".
      expect(debt.progress.paidInstallments).toBe(2);
    });

    it('no se puede borrar la subcategoría de una deuda que existe', async () => {
      const debt = await findDebt('Tarjeta Falabella');
      const res = await api()
        .delete(`/subcategories/${debt.subcategoryId}`)
        .set(auth())
        .expect(409);
      expect(res.body.message).toMatch(/deuda/i);
    });

    it('renombrar la deuda renombra su subcategoría', async () => {
      const debt = await findDebt('Tarjeta Falabella');
      await api()
        .patch(`/debts/${debt.id}`)
        .set(auth())
        .send({ name: 'Tarjeta CMR' })
        .expect(200);

      const sub = (
        await api()
          .get(`/subcategories/${debt.subcategoryId}`)
          .set(auth())
          .expect(200)
      ).body;
      expect(sub.name).toBe('Tarjeta CMR');
    });

    it('borrar la deuda conserva la subcategoría y los pagos (el historial)', async () => {
      const debt = await findDebt('Tarjeta CMR');
      const tx = (await registerMovement(debt.subcategoryId, 45000)).body;

      await api().delete(`/debts/${debt.id}`).set(auth()).expect(204);

      await api()
        .get(`/subcategories/${debt.subcategoryId}`)
        .set(auth())
        .expect(200);
      await api().get(`/transactions/${tx.id}`).set(auth()).expect(200);
    });

    it('no se pueden tener dos deudas con el mismo nombre en la wallet', async () => {
      await api()
        .post('/debts')
        .set(auth())
        .send({ ...hipotecario() })
        .expect(409);
    });
  });

  // ---------------------------------------------------------------------
  describe('deuda de monto libre (préstamo familiar)', () => {
    it('descuenta cada pago del total, sea el monto que sea', async () => {
      const debt = (
        await api()
          .post('/debts')
          .set(auth())
          .send({
            name: 'Préstamo familiar',
            kind: 'FREE_AMOUNT',
            totalAmount: 3_000_000,
            initialPaidAmount: 0,
            walletId,
          })
          .expect(201)
      ).body;
      expect(debt.progress.remainingAmountClp).toBe(3_000_000);

      await registerMovement(debt.subcategoryId, 300_000);
      await registerMovement(debt.subcategoryId, 150_000);

      const updated = await getDebt(debt.id);
      expect(updated.progress.paidAmountClp).toBe(450_000);
      expect(updated.progress.remainingAmountClp).toBe(2_550_000);
    });
  });

  // ---------------------------------------------------------------------
  describe('validaciones', () => {
    const base = () => hipotecario();

    // Cada caso dice qué campo debe nombrar el error: así un 400 "por otra
    // razón" (ej. si la API rechazara todo) no pasa como falso verde.
    it.each([
      ['sin tipo', { kind: undefined }, 'kind'],
      ['con un tipo inventado', { kind: 'OTRO' }, 'kind'],
      [
        'en cuotas sin total de cuotas',
        { totalInstallments: undefined },
        'totalInstallments',
      ],
      [
        'en cuotas sin valor de la cuota',
        { installmentValue: undefined },
        'installmentValue',
      ],
      ['en cuotas con una unidad inventada', { unit: 'USD' }, 'unit'],
      [
        'en cuotas sin la fecha de la próxima cuota',
        { nextDueDate: undefined },
        'nextDueDate',
      ],
      [
        'con más cuotas pagadas que el total',
        { initialPaidInstallments: 301 },
        'cuotas ya pagadas',
      ],
    ])('rechaza una deuda %s → 400', async (_, override, field) => {
      const res = await api()
        .post('/debts')
        .set(auth())
        .send({ ...base(), name: 'Inválida', ...override })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain(field);
    });

    it('la misma deuda con datos válidos sí se crea (control)', async () => {
      await api()
        .post('/debts')
        .set(auth())
        .send({ ...base(), name: 'Válida' })
        .expect(201);
    });

    it('rechaza una deuda de monto libre sin total → 400', async () => {
      const res = await api()
        .post('/debts')
        .set(auth())
        .send({ name: 'Inválida', kind: 'FREE_AMOUNT', walletId })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('totalAmount');
    });
  });

  // ---------------------------------------------------------------------
  // Helpers locales
  // ---------------------------------------------------------------------
  async function findCategory(name: string) {
    const categories = (
      await api()
        .get(`/categories?walletId=${walletId}`)
        .set(auth())
        .expect(200)
    ).body;
    return categories.find((c: any) => c.name === name);
  }

  async function findDebt(name: string) {
    const debts = (
      await api().get(`/debts?walletId=${walletId}`).set(auth()).expect(200)
    ).body;
    return debts.find((d: any) => d.name === name);
  }

  async function createCategoryWithSub(category: string, sub: string) {
    const cat = (
      await api()
        .post('/categories')
        .set(auth())
        .send({ name: category, walletId })
        .expect(201)
    ).body;
    const subcategory = (
      await api()
        .post('/subcategories')
        .set(auth())
        .send({ name: sub, categoryId: cat.id })
        .expect(201)
    ).body;
    return subcategory.id as string;
  }
});

/**
 * Sin el valor de la UF (la API externa no responde): la cuota en UF se
 * estima con el último pago y, si no hay pagos, no se inventa un monto.
 */
describe('Deudas en UF sin el valor de la UF disponible (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;

  beforeAll(async () => {
    app = await createTestApp({ ufValue: null });
    await resetDatabase(app);
    user = await createUser(app, 'Sinuf');
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin pagos: la cuota en pesos queda sin estimar', async () => {
    const debt = (
      await request(app.getHttpServer())
        .post('/debts')
        .set(bearer(user.token))
        .send({
          name: 'Hipotecario',
          kind: 'INSTALLMENTS',
          totalInstallments: 300,
          installmentValue: 8.44,
          unit: 'UF',
          initialPaidInstallments: 41,
          nextDueDate: '2026-12-01',
          walletId: user.personalWalletId,
        })
        .expect(201)
    ).body;

    expect(debt.progress.installmentValueClp).toBeNull();
    expect(debt.progress.installmentValueSource).toBe('UNKNOWN');
  });
});
