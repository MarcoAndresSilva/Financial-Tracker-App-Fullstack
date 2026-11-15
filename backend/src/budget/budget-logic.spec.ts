import {
  BudgetEntry,
  FreeAmountCommitmentDebt,
  InstallmentCommitmentDebt,
  budgetStatus,
  debtCommitmentsForMonth,
  resolveBudget,
  summarizePlan,
} from './budget-logic';

/**
 * CONTRATO DEL PRESUPUESTO (Paso 80)
 *
 * Funciones puras: sin base de datos. Reciben los montos guardados y lo
 * gastado, y deciden qué presupuesto aplica a cada mes, el color de la barra y
 * los totales del plan.
 *
 * Cómo se guarda un presupuesto: entradas con fecha (año/mes) y alcance.
 *   - FROM_MONTH:  "desde este mes en adelante" (el monto habitual).
 *   - ONLY_MONTH:  "solo este mes" (un ajuste puntual).
 *   - amount null: "sin presupuesto" (para quitarlo desde un mes, o solo uno).
 */

const desde = (
  year: number,
  month: number,
  amount: number | null,
): BudgetEntry => ({
  year,
  month,
  amount,
  scope: 'FROM_MONTH',
});
const soloEn = (
  year: number,
  month: number,
  amount: number | null,
): BudgetEntry => ({
  year,
  month,
  amount,
  scope: 'ONLY_MONTH',
});

describe('resolveBudget: qué presupuesto aplica a un mes', () => {
  it('sin entradas, no hay presupuesto', () => {
    expect(resolveBudget([], { year: 2026, month: 12 })).toEqual({
      amount: null,
      source: 'NONE',
    });
  });

  it('un monto "desde" aplica a ese mes y a los siguientes', () => {
    const entries = [desde(2026, 11, 300_000)];
    expect(resolveBudget(entries, { year: 2026, month: 11 }).amount).toBe(
      300_000,
    );
    expect(resolveBudget(entries, { year: 2027, month: 3 }).amount).toBe(
      300_000,
    );
    expect(resolveBudget(entries, { year: 2026, month: 11 }).source).toBe(
      'RECURRING',
    );
  });

  it('no aplica a los meses ANTERIORES (el historial no se reescribe)', () => {
    const entries = [desde(2026, 11, 300_000)];
    expect(resolveBudget(entries, { year: 2026, month: 10 }).amount).toBeNull();
  });

  it('un cambio "desde enero" no afecta diciembre', () => {
    const entries = [desde(2026, 11, 300_000), desde(2027, 1, 350_000)];
    expect(resolveBudget(entries, { year: 2026, month: 12 }).amount).toBe(
      300_000,
    );
    expect(resolveBudget(entries, { year: 2027, month: 1 }).amount).toBe(
      350_000,
    );
    expect(resolveBudget(entries, { year: 2027, month: 6 }).amount).toBe(
      350_000,
    );
  });

  it('el orden en que llegan las entradas no importa', () => {
    const entries = [desde(2027, 1, 350_000), desde(2026, 11, 300_000)];
    expect(resolveBudget(entries, { year: 2026, month: 12 }).amount).toBe(
      300_000,
    );
  });

  it('un ajuste "solo este mes" gana ese mes y no toca los demás', () => {
    const entries = [desde(2026, 11, 300_000), soloEn(2026, 12, 450_000)];
    expect(resolveBudget(entries, { year: 2026, month: 12 })).toEqual({
      amount: 450_000,
      source: 'MONTH_ADJUSTMENT',
    });
    expect(resolveBudget(entries, { year: 2027, month: 1 }).amount).toBe(
      300_000,
    );
  });

  it('un ajuste puntual funciona aunque no haya monto habitual', () => {
    const entries = [soloEn(2026, 12, 100_000)];
    expect(resolveBudget(entries, { year: 2026, month: 12 }).amount).toBe(
      100_000,
    );
    expect(resolveBudget(entries, { year: 2027, month: 1 }).amount).toBeNull();
  });

  it('quitar el presupuesto "desde" un mes (null) lo deja sin presupuesto en adelante', () => {
    const entries = [desde(2026, 11, 300_000), desde(2027, 2, null)];
    expect(resolveBudget(entries, { year: 2027, month: 1 }).amount).toBe(
      300_000,
    );
    expect(resolveBudget(entries, { year: 2027, month: 2 })).toEqual({
      amount: null,
      source: 'NONE',
    });
  });

  it('quitarlo "solo este mes" (null) no afecta el mes siguiente', () => {
    const entries = [desde(2026, 11, 300_000), soloEn(2026, 12, null)];
    expect(resolveBudget(entries, { year: 2026, month: 12 }).amount).toBeNull();
    expect(resolveBudget(entries, { year: 2027, month: 1 }).amount).toBe(
      300_000,
    );
  });

  it('cruza el cambio de año correctamente', () => {
    const entries = [desde(2026, 12, 300_000)];
    expect(resolveBudget(entries, { year: 2027, month: 1 }).amount).toBe(
      300_000,
    );
    expect(resolveBudget(entries, { year: 2026, month: 11 }).amount).toBeNull();
  });
});

describe('budgetStatus: el color de la barra', () => {
  it('bajo el 80%: verde', () => {
    expect(budgetStatus(300_000, 200_000)).toEqual({
      status: 'OK',
      percentage: (200_000 / 300_000) * 100,
      remaining: 100_000,
    });
  });

  it('el borde exacto: 80% ya es amarillo', () => {
    expect(budgetStatus(100_000, 79_999).status).toBe('OK');
    expect(budgetStatus(100_000, 80_000).status).toBe('WARNING');
  });

  it('justo el 100% sigue siendo amarillo (llegaste, no te pasaste)', () => {
    const s = budgetStatus(100_000, 100_000);
    expect(s.status).toBe('WARNING');
    expect(s.remaining).toBe(0);
  });

  it('sobre el 100%: rojo, y "lo que queda" es negativo (cuánto te pasaste)', () => {
    const s = budgetStatus(70_000, 95_000);
    expect(s.status).toBe('OVER');
    expect(s.remaining).toBe(-25_000);
    expect(s.percentage).toBeCloseTo(135.71, 1);
  });

  it('sin gastos: verde y 0%', () => {
    expect(budgetStatus(300_000, 0)).toEqual({
      status: 'OK',
      percentage: 0,
      remaining: 300_000,
    });
  });

  it('presupuesto 0 y sin gastos: verde (planificaste no gastar y cumpliste)', () => {
    expect(budgetStatus(0, 0)).toEqual({
      status: 'OK',
      percentage: 0,
      remaining: 0,
    });
  });

  it('presupuesto 0 con gastos: rojo, sin un porcentaje infinito', () => {
    const s = budgetStatus(0, 15_000);
    expect(s.status).toBe('OVER');
    expect(s.percentage).toBeNull();
    expect(s.remaining).toBe(-15_000);
  });
});

describe('summarizePlan: el plan del mes', () => {
  const lines = [
    { budget: 300_000, spent: 240_000 }, // supermercado
    { budget: 80_000, spent: 76_000 }, // delivery
    { budget: 70_000, spent: 95_000 }, // salidas (pasada)
    { budget: null, spent: 38_000 }, // mascotas: sin presupuesto
    { budget: null, spent: 0 }, // otra sin presupuesto ni gastos
  ];

  it('suma lo planificado y lo gastado en las categorías con presupuesto', () => {
    const plan = summarizePlan({
      income: 2_440_000,
      debtCommitments: 0,
      lines,
    });
    expect(plan.totalPlanned).toBe(450_000);
    expect(plan.totalSpent).toBe(411_000);
  });

  it('"sin asignar" es lo que queda de los ingresos después de planificar', () => {
    expect(
      summarizePlan({ income: 2_440_000, debtCommitments: 0, lines })
        .unassigned,
    ).toBe(1_990_000);
  });

  it('los compromisos de deudas se restan de "sin asignar" (el número real)', () => {
    const plan = summarizePlan({
      income: 2_440_000,
      debtCommitments: 783_768,
      lines,
    });
    expect(plan.debtCommitments).toBe(783_768);
    expect(plan.unassigned).toBe(2_440_000 - 783_768 - 450_000);
  });

  it('si planificas más de lo que entra, "sin asignar" queda negativo', () => {
    expect(
      summarizePlan({ income: 400_000, debtCommitments: 0, lines }).unassigned,
    ).toBe(-50_000);
  });

  it('el estado general usa los mismos colores que cada barra', () => {
    const plan = summarizePlan({
      income: 2_440_000,
      debtCommitments: 0,
      lines,
    });
    expect(plan.overall).toEqual(budgetStatus(450_000, 411_000));
  });

  it('cuenta las categorías sin presupuesto y lo que se gastó en ellas', () => {
    const plan = summarizePlan({
      income: 2_440_000,
      debtCommitments: 0,
      lines,
    });
    expect(plan.unbudgetedCount).toBe(2);
    expect(plan.unbudgetedSpent).toBe(38_000);
  });

  it('sin ningún presupuesto: nada planificado y todo sin asignar', () => {
    const plan = summarizePlan({
      income: 1_000_000,
      debtCommitments: 0,
      lines: [{ budget: null, spent: 50_000 }],
    });
    expect(plan.totalPlanned).toBe(0);
    expect(plan.unassigned).toBe(1_000_000);
    expect(plan.overall).toBeNull();
  });
});

/**
 * Compromisos de deudas de un mes: qué cuota de cada deuda cae ese mes, cuánto
 * es y si ya se pagó. Solo LEE los datos de la página de Deudas; no se editan
 * ni se presupuestan (decisión: las deudas son contratos ya asumidos).
 */
describe('debtCommitmentsForMonth: compromisos de deudas del mes', () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  // Hipotecario: registrado con 41 pagadas, la 42 vence el 1 dic 2026.
  const hipotecario = (
    paidInstallments: number,
  ): InstallmentCommitmentDebt => ({
    kind: 'INSTALLMENTS',
    name: 'Hipotecario',
    totalInstallments: 300,
    initialPaidInstallments: 41,
    nextDueDateAtStart: d('2026-12-01'),
    paidInstallments,
    installmentValueClp: 348_778,
  });
  // Tarjeta: 12 cuotas, registrada con 4 pagadas, la 5 vence el 15 nov 2026.
  const tarjeta = (paidInstallments: number): InstallmentCommitmentDebt => ({
    kind: 'INSTALLMENTS',
    name: 'Tarjeta Falabella',
    totalInstallments: 12,
    initialPaidInstallments: 4,
    nextDueDateAtStart: d('2026-11-15'),
    paidInstallments,
    installmentValueClp: 45_000,
  });

  it('calcula qué cuota cae en el mes, su monto y su vencimiento', () => {
    const c = debtCommitmentsForMonth([hipotecario(41)], {
      year: 2026,
      month: 12,
    });
    expect(c.items).toEqual([
      {
        name: 'Hipotecario',
        installmentNumber: 42,
        totalInstallments: 300,
        amountClp: 348_778,
        estimated: false,
        dueDate: d('2026-12-01'),
        paid: false,
      },
    ]);
    expect(c.totalClp).toBe(348_778);
  });

  it('el mes siguiente avanza sola a la cuota siguiente', () => {
    const c = debtCommitmentsForMonth([hipotecario(41)], {
      year: 2027,
      month: 1,
    });
    expect(c.items[0].installmentNumber).toBe(43);
    expect(c.items[0].dueDate).toEqual(d('2027-01-01'));
  });

  it('marca como pagada la cuota del mes si ya se registró su pago', () => {
    const c = debtCommitmentsForMonth([tarjeta(5)], { year: 2026, month: 11 });
    expect(c.items[0]).toMatchObject({ installmentNumber: 5, paid: true });
    expect(c.paidCount).toBe(1);
  });

  it('suma todas las deudas del mes y cuenta cuántas van pagadas', () => {
    const c = debtCommitmentsForMonth([hipotecario(41), tarjeta(5)], {
      year: 2026,
      month: 12,
    });
    // Tarjeta: en diciembre cae la cuota 6 (todavía no pagada).
    expect(c.items.map((i) => i.installmentNumber)).toEqual([42, 6]);
    expect(c.totalClp).toBe(348_778 + 45_000);
    expect(c.paidCount).toBe(0);
    expect(c.totalCount).toBe(2);
  });

  it('una deuda que termina ya no aparece el mes después de su última cuota', () => {
    // Tarjeta: la cuota 5 vence el 15 nov 2026 → la 12 (última) el 15 jun 2027.
    const junio = debtCommitmentsForMonth([tarjeta(11)], {
      year: 2027,
      month: 6,
    });
    expect(junio.items[0]).toMatchObject({
      installmentNumber: 12,
      paid: false,
    });
    expect(
      debtCommitmentsForMonth([tarjeta(12)], { year: 2027, month: 7 }).items,
    ).toHaveLength(0);
  });

  it('una deuda que todavía no empieza no aparece', () => {
    const nueva: InstallmentCommitmentDebt = {
      ...tarjeta(0),
      initialPaidInstallments: 0,
      nextDueDateAtStart: d('2027-02-10'),
    };
    expect(
      debtCommitmentsForMonth([nueva], { year: 2027, month: 1 }).items,
    ).toHaveLength(0);
    expect(
      debtCommitmentsForMonth([nueva], { year: 2027, month: 2 }).items[0]
        .installmentNumber,
    ).toBe(1);
  });

  it('una cuota en UF sin estimación en pesos aparece, pero no suma y se avisa', () => {
    const sinUf: InstallmentCommitmentDebt = {
      ...hipotecario(41),
      installmentValueClp: null,
    };
    const c = debtCommitmentsForMonth([sinUf, tarjeta(4)], {
      year: 2026,
      month: 12,
    });
    expect(c.items[0].amountClp).toBeNull();
    expect(c.totalClp).toBe(45_000);
    expect(c.withoutEstimate).toBe(1);
  });

  describe('préstamo de monto libre', () => {
    const prestamo = (
      paidInPeriodClp: number,
      average: number | null,
      plannedMonthlyClp: number | null = null,
    ): FreeAmountCommitmentDebt => ({
      kind: 'FREE_AMOUNT',
      name: 'Préstamo familiar',
      isFinished: false,
      plannedMonthlyClp,
      averageRecentPaymentClp: average,
      paidInPeriodClp,
    });

    it('con pago mensual habitual definido: aparece con ese monto (no es estimado)', () => {
      const c = debtCommitmentsForMonth([prestamo(0, 283_333, 300_000)], {
        year: 2026,
        month: 12,
      });
      expect(c.items[0]).toMatchObject({
        amountClp: 300_000,
        estimated: false,
        paid: false,
      });
      expect(c.totalClp).toBe(300_000);
    });

    it('si ese mes se pagó menos que lo habitual, cuenta lo pagado de verdad', () => {
      const c = debtCommitmentsForMonth([prestamo(200_000, 283_333, 300_000)], {
        year: 2026,
        month: 12,
      });
      expect(c.items[0]).toMatchObject({
        amountClp: 200_000,
        estimated: false,
        paid: true,
      });
      expect(c.totalClp).toBe(200_000);
    });

    it('sin monto habitual ni pago este mes: usa su ritmo promedio, marcado como estimado', () => {
      const c = debtCommitmentsForMonth([prestamo(0, 283_333.4)], {
        year: 2026,
        month: 12,
      });
      expect(c.items[0]).toMatchObject({
        name: 'Préstamo familiar',
        installmentNumber: null,
        amountClp: 283_333,
        estimated: true,
        paid: false,
      });
    });

    it('si ya se pagó este mes, cuenta lo pagado de verdad (no el promedio)', () => {
      const c = debtCommitmentsForMonth([prestamo(200_000, 283_333)], {
        year: 2026,
        month: 12,
      });
      expect(c.items[0]).toMatchObject({
        amountClp: 200_000,
        estimated: false,
        paid: true,
      });
      expect(c.totalClp).toBe(200_000);
    });

    it('sin monto habitual ni pagos nunca: aparece sin monto y se avisa', () => {
      const c = debtCommitmentsForMonth([prestamo(0, null)], {
        year: 2026,
        month: 12,
      });
      expect(c.items[0].amountClp).toBeNull();
      expect(c.withoutEstimate).toBe(1);
    });

    it('si ya está pagado completo, no aparece', () => {
      const pagado: FreeAmountCommitmentDebt = {
        ...prestamo(0, 300_000),
        isFinished: true,
      };
      expect(
        debtCommitmentsForMonth([pagado], { year: 2026, month: 12 }).items,
      ).toHaveLength(0);
    });
  });
});
