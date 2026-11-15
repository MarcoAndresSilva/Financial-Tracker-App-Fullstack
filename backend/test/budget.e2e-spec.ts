import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetDatabase } from './helpers/test-app';
import { bearer, createUser, TestUser } from './helpers/factories';

/**
 * CONTRATO DE LA API DEL PRESUPUESTO (Paso 81)
 *
 * La lógica (qué monto aplica, colores, resumen, compromisos) está probada en
 * budget-logic.spec.ts. Acá se prueba que la API le entregue los datos
 * correctos desde la base: qué categorías entran, cuánto se gastó e ingresó en
 * el mes, cómo se guardan los montos y qué compromisos de deudas se leen.
 *
 * Escenario (diciembre 2026), con la UF fija en $41.324,4:
 *   - Ingresos → Sueldo: $2.440.000 (categoría SOLO de ingresos)
 *   - Supermercado → Compras: gastos $240.000
 *   - Salidas → Bar: gastos $95.000
 *   - Hipotecario (en cuotas, UF 8,44, 41 de 300, la 42 vence el 1 dic)
 *   - Préstamo familiar (monto libre, pago mensual habitual $300.000)
 */
describe('Presupuesto (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  let walletId: string;
  const sub: Record<string, string> = {};
  const cat: Record<string, string> = {};
  let hipotecario: { id: string; subcategoryId: string };

  const api = () => request(app.getHttpServer());
  const auth = () => bearer(user.token);

  const plan = async (year: number, month: number) =>
    (
      await api()
        .get(`/budget?walletId=${walletId}&year=${year}&month=${month}`)
        .set(auth())
        .expect(200)
    ).body;

  const line = (body: any, name: string) =>
    body.categories.find((c: any) => c.name === name);

  const setBudget = (
    category: string,
    year: number,
    month: number,
    scope: 'FROM_MONTH' | 'ONLY_MONTH',
    amount: number | null,
  ) =>
    api()
      .put('/budget/entries')
      .set(auth())
      .send({ categoryId: cat[category], year, month, scope, amount })
      .expect(200);

  const movement = (
    subName: string,
    amount: number,
    type: string,
    date: string,
  ) =>
    api()
      .post('/transactions')
      .set(auth())
      .send({
        amount,
        type,
        date,
        description: subName,
        walletId,
        subcategoryId: sub[subName],
      })
      .expect(201);

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    user = await createUser(app, 'Marco');
    walletId = user.personalWalletId;

    for (const [category, subcategory] of [
      ['Ingresos', 'Sueldo'],
      ['Supermercado', 'Compras'],
      ['Salidas', 'Bar'],
    ]) {
      const c = (
        await api()
          .post('/categories')
          .set(auth())
          .send({ name: category, walletId })
          .expect(201)
      ).body;
      cat[category] = c.id;
      const s = (
        await api()
          .post('/subcategories')
          .set(auth())
          .send({ name: subcategory, categoryId: c.id })
          .expect(201)
      ).body;
      sub[subcategory] = s.id;
    }

    hipotecario = (
      await api()
        .post('/debts')
        .set(auth())
        .send({
          name: 'Hipotecario',
          kind: 'INSTALLMENTS',
          totalInstallments: 300,
          installmentValue: 8.44,
          unit: 'UF',
          initialPaidInstallments: 41,
          nextDueDate: '2026-12-01',
          walletId,
        })
        .expect(201)
    ).body;

    await api()
      .post('/debts')
      .set(auth())
      .send({
        name: 'Préstamo familiar',
        kind: 'FREE_AMOUNT',
        totalAmount: 3_000_000,
        plannedMonthlyPayment: 300_000,
        walletId,
      })
      .expect(201);

    await movement('Sueldo', 2_440_000, 'INCOME', '2026-12-01');
    await movement('Compras', 240_000, 'EXPENSE', '2026-12-05');
    await movement('Bar', 95_000, 'EXPENSE', '2026-12-12');
    await movement('Compras', 50_000, 'EXPENSE', '2026-11-20'); // otro mes: no cuenta
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------
  describe('el plan del mes, sin presupuestos todavía', () => {
    let body: any;
    beforeAll(async () => {
      body = await plan(2026, 12);
    });

    it('trae los ingresos del mes', () => {
      expect(body.summary.income).toBe(2_440_000);
    });

    it('lista las categorías de gasto con lo gastado ese mes (y solo ese mes)', () => {
      expect(line(body, 'Supermercado')).toMatchObject({
        categoryId: cat['Supermercado'],
        budget: null,
        spent: 240_000,
        status: null,
      });
      expect(line(body, 'Salidas').spent).toBe(95_000);
    });

    it('NO lista la categoría de las deudas ni las categorías solo de ingresos', () => {
      const names = body.categories.map((c: any) => c.name);
      expect(names).not.toContain('Deudas');
      expect(names).not.toContain('Ingresos');
    });

    it('lee los compromisos de deudas del mes', () => {
      const items = body.commitments.items;
      expect(items).toHaveLength(2);
      expect(items.find((i: any) => i.name === 'Hipotecario')).toMatchObject({
        installmentNumber: 42,
        amountClp: 348_778,
        paid: false,
      });
      expect(
        items.find((i: any) => i.name === 'Préstamo familiar'),
      ).toMatchObject({
        amountClp: 300_000,
        estimated: false,
        paid: false,
      });
      expect(body.commitments.totalClp).toBe(348_778 + 300_000);
    });

    it('sin asignar = ingresos − compromisos (todavía no hay nada planificado)', () => {
      expect(body.summary.totalPlanned).toBe(0);
      expect(body.summary.unassigned).toBe(2_440_000 - 648_778);
    });
  });

  // -------------------------------------------------------------------
  describe('definir y cambiar presupuestos', () => {
    it('"desde noviembre" aplica a diciembre y se pinta según lo gastado', async () => {
      await setBudget('Supermercado', 2026, 11, 'FROM_MONTH', 300_000);

      const s = line(await plan(2026, 12), 'Supermercado');
      expect(s).toMatchObject({
        budget: 300_000,
        source: 'RECURRING',
        spent: 240_000,
      });
      expect(s.status).toMatchObject({ status: 'WARNING', remaining: 60_000 });
    });

    it('"solo diciembre" ajusta ese mes y enero vuelve al habitual', async () => {
      await setBudget('Supermercado', 2026, 12, 'ONLY_MONTH', 450_000);

      expect(line(await plan(2026, 12), 'Supermercado')).toMatchObject({
        budget: 450_000,
        source: 'MONTH_ADJUSTMENT',
      });
      expect(line(await plan(2027, 1), 'Supermercado').budget).toBe(300_000);
    });

    it('volver a guardar el mismo mes y alcance actualiza el monto (no duplica)', async () => {
      await setBudget('Supermercado', 2026, 12, 'ONLY_MONTH', 420_000);
      expect(line(await plan(2026, 12), 'Supermercado').budget).toBe(420_000);
    });

    it('"desde diciembre" pisa el ajuste de diciembre y no toca noviembre', async () => {
      await setBudget('Supermercado', 2026, 12, 'FROM_MONTH', 350_000);

      expect(line(await plan(2026, 12), 'Supermercado')).toMatchObject({
        budget: 350_000,
        source: 'RECURRING',
      });
      expect(line(await plan(2026, 11), 'Supermercado').budget).toBe(300_000);
    });

    it('"desde" pisa los "desde" posteriores, pero respeta los ajustes puntuales futuros', async () => {
      await setBudget('Salidas', 2027, 3, 'FROM_MONTH', 90_000);
      await setBudget('Salidas', 2027, 2, 'ONLY_MONTH', 150_000); // ej. un cumpleaños
      await setBudget('Salidas', 2026, 12, 'FROM_MONTH', 70_000);

      expect(line(await plan(2027, 3), 'Salidas').budget).toBe(70_000);
      expect(line(await plan(2027, 2), 'Salidas').budget).toBe(150_000);
    });

    it('quitar el presupuesto solo de un mes (null) deja el siguiente igual', async () => {
      await setBudget('Supermercado', 2027, 1, 'ONLY_MONTH', null);

      expect(line(await plan(2027, 1), 'Supermercado').budget).toBeNull();
      expect(line(await plan(2027, 2), 'Supermercado').budget).toBe(350_000);
    });

    it('pasarse se pinta rojo con lo que te pasaste', async () => {
      const s = line(await plan(2026, 12), 'Salidas');
      expect(s.status).toMatchObject({ status: 'OVER', remaining: -25_000 });
    });

    it('el resumen suma lo planificado y resta todo de los ingresos', async () => {
      const { summary } = await plan(2026, 12);
      expect(summary.totalPlanned).toBe(350_000 + 70_000);
      expect(summary.totalSpent).toBe(240_000 + 95_000);
      expect(summary.unassigned).toBe(2_440_000 - 648_778 - 420_000);
    });
  });

  // -------------------------------------------------------------------
  describe('compromisos de deudas', () => {
    it('al registrar el pago del hipotecario, la cuota del mes aparece pagada', async () => {
      await api()
        .post('/transactions')
        .set(auth())
        .send({
          amount: 348_778,
          type: 'EXPENSE',
          date: '2026-12-01',
          description: 'Dividendo',
          walletId,
          subcategoryId: hipotecario.subcategoryId,
        })
        .expect(201);

      const { commitments } = await plan(2026, 12);
      expect(
        commitments.items.find((i: any) => i.name === 'Hipotecario').paid,
      ).toBe(true);
      expect(commitments.paidCount).toBe(1);
    });

    it('los pagos de deudas no aparecen como gasto en ninguna categoría del presupuesto', async () => {
      const body = await plan(2026, 12);
      const totalSpent = body.categories.reduce(
        (acc: number, c: any) => acc + c.spent,
        0,
      );
      expect(totalSpent).toBe(240_000 + 95_000);
    });
  });

  // -------------------------------------------------------------------
  describe('pago mensual habitual de una deuda de monto libre', () => {
    it('se guarda al crear y se puede editar', async () => {
      const debts = (
        await api().get(`/debts?walletId=${walletId}`).set(auth()).expect(200)
      ).body;
      const prestamo = debts.find((d: any) => d.name === 'Préstamo familiar');
      expect(prestamo.plannedMonthlyPayment).toBe(300_000);

      await api()
        .patch(`/debts/${prestamo.id}`)
        .set(auth())
        .send({ plannedMonthlyPayment: 250_000 })
        .expect(200);

      const { commitments } = await plan(2026, 12);
      expect(
        commitments.items.find((i: any) => i.name === 'Préstamo familiar')
          .amountClp,
      ).toBe(250_000);
    });
  });

  // -------------------------------------------------------------------
  describe('validaciones', () => {
    it.each([
      ['un mes 13', { month: 13 }, 'month'],
      ['un alcance inventado', { scope: 'SIEMPRE' }, 'scope'],
      ['un monto negativo', { amount: -1 }, 'amount'],
      ['sin categoría', { categoryId: undefined }, 'categoryId'],
    ])('rechaza %s → 400', async (_, override, field) => {
      const res = await api()
        .put('/budget/entries')
        .set(auth())
        .send({
          categoryId: cat['Supermercado'],
          year: 2026,
          month: 12,
          scope: 'FROM_MONTH',
          amount: 1,
          ...override,
        })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain(field);
    });

    it('el plan exige año y mes válidos → 400', async () => {
      await api()
        .get(`/budget?walletId=${walletId}&year=2026&month=0`)
        .set(auth())
        .expect(400);
    });
  });
});
