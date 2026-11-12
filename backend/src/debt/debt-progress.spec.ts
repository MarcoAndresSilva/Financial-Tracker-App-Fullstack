import {
  addMonthsClamped,
  computeFreeAmountProgress,
  computeInstallmentProgress,
  InstallmentDebtInput,
} from './debt-progress';

/**
 * CONTRATO DEL PROGRESO DE UNA DEUDA
 *
 * Funciones puras: reciben los datos de la deuda, sus pagos y "hoy", y
 * devuelven todo lo que muestra la tarjeta de la deuda. Sin base de datos ni
 * reloj del sistema: con las mismas entradas, siempre la misma salida.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('addMonthsClamped', () => {
  it('suma meses manteniendo el día', () => {
    expect(addMonthsClamped(d('2026-12-01'), 1)).toEqual(d('2027-01-01'));
  });

  it('ajusta al último día cuando el mes destino es más corto', () => {
    // 31 de enero + 1 mes = 28 de febrero, no 3 de marzo.
    expect(addMonthsClamped(d('2027-01-31'), 1)).toEqual(d('2027-02-28'));
    expect(addMonthsClamped(d('2028-01-31'), 1)).toEqual(d('2028-02-29')); // bisiesto
  });

  it('vuelve al día original en los meses que sí lo tienen', () => {
    // Clave para cuotas que vencen el 31: no "arrastra" el 28 de febrero.
    expect(addMonthsClamped(d('2027-01-31'), 2)).toEqual(d('2027-03-31'));
  });

  it('cruza años y acepta 0 meses', () => {
    expect(addMonthsClamped(d('2026-12-01'), 258)).toEqual(d('2048-06-01'));
    expect(addMonthsClamped(d('2026-12-01'), 0)).toEqual(d('2026-12-01'));
  });
});

describe('deuda EN CUOTAS', () => {
  // El hipotecario real: dividendo UF 8,44, 41 de 300 pagados, el 42 vence
  // el 1 de diciembre de 2026.
  const hipotecario: InstallmentDebtInput = {
    totalInstallments: 300,
    installmentValue: 8.44,
    unit: 'UF',
    initialPaidInstallments: 41,
    nextDueDateAtStart: d('2026-12-01'),
    payments: [],
  };
  const UF_HOY = 41324.4;

  describe('hipotecario en UF, recién registrado', () => {
    const p = computeInstallmentProgress(hipotecario, {
      today: d('2026-11-12'),
      ufValue: UF_HOY,
    });

    it('va en el dividendo 42 de 300', () => {
      expect(p.paidInstallments).toBe(41);
      expect(p.nextInstallmentNumber).toBe(42);
      expect(p.remainingInstallments).toBe(259);
    });

    it('el próximo vence el 1 de diciembre y el último en junio de 2048', () => {
      expect(p.nextDueDate).toEqual(d('2026-12-01'));
      expect(p.endDate).toEqual(d('2048-06-01'));
    });

    it('convierte la cuota a pesos con la UF del día', () => {
      expect(p.installmentValueClp).toBe(348778);
      expect(p.installmentValueSource).toBe('UF_TODAY');
    });

    it('estima lo que falta en pesos (cuotas restantes × cuota de hoy)', () => {
      expect(p.remainingAmountClp).toBe(259 * 348778);
    });

    it('calcula el avance y está al día (faltan 19 días)', () => {
      expect(p.percentage).toBeCloseTo((41 / 300) * 100);
      expect(p.daysUntilDue).toBe(19);
      expect(p.status).toBe('UP_TO_DATE');
    });
  });

  describe('el estado según la fecha de hoy', () => {
    it('a 7 días o menos del vencimiento: por vencer', () => {
      const p = computeInstallmentProgress(hipotecario, {
        today: d('2026-11-28'),
        ufValue: UF_HOY,
      });
      expect(p.daysUntilDue).toBe(3);
      expect(p.status).toBe('DUE_SOON');
    });

    it('el borde exacto: a 7 días es "por vencer", a 8 todavía "al día"', () => {
      const a7 = computeInstallmentProgress(hipotecario, {
        today: d('2026-11-24'),
        ufValue: UF_HOY,
      });
      expect(a7.daysUntilDue).toBe(7);
      expect(a7.status).toBe('DUE_SOON');

      const a8 = computeInstallmentProgress(hipotecario, {
        today: d('2026-11-23'),
        ufValue: UF_HOY,
      });
      expect(a8.daysUntilDue).toBe(8);
      expect(a8.status).toBe('UP_TO_DATE');
    });

    it('el mismo día del vencimiento todavía es "por vencer"', () => {
      const p = computeInstallmentProgress(hipotecario, {
        today: d('2026-12-01'),
        ufValue: UF_HOY,
      });
      expect(p.daysUntilDue).toBe(0);
      expect(p.status).toBe('DUE_SOON');
    });

    it('pasado el vencimiento sin registrar el pago: atrasada', () => {
      const p = computeInstallmentProgress(hipotecario, {
        today: d('2026-12-03'),
        ufValue: UF_HOY,
      });
      expect(p.daysUntilDue).toBe(-2);
      expect(p.status).toBe('OVERDUE');
    });
  });

  describe('al registrar pagos', () => {
    it('cada pago avanza una cuota y corre el vencimiento un mes', () => {
      const p = computeInstallmentProgress(
        {
          ...hipotecario,
          payments: [{ amount: 348778, date: d('2026-11-30') }],
        },
        { today: d('2026-12-03'), ufValue: UF_HOY },
      );
      expect(p.paidInstallments).toBe(42);
      expect(p.nextInstallmentNumber).toBe(43);
      expect(p.nextDueDate).toEqual(d('2027-01-01'));
      expect(p.status).toBe('UP_TO_DATE');
    });

    it('cuenta la cuota aunque el monto pagado varíe (UF, pago parcial)', () => {
      const p = computeInstallmentProgress(
        {
          ...hipotecario,
          payments: [
            { amount: 348778, date: d('2026-11-30') },
            { amount: 350102, date: d('2026-12-30') },
          ],
        },
        { today: d('2027-01-05'), ufValue: UF_HOY },
      );
      expect(p.paidInstallments).toBe(43);
      expect(p.paidAmountClp).toBe(348778 + 350102);
    });

    it('la fecha de término no cambia por pagar a tiempo (ya estaba en el plan)', () => {
      const p = computeInstallmentProgress(
        {
          ...hipotecario,
          payments: [{ amount: 348778, date: d('2026-11-30') }],
        },
        { today: d('2026-12-03'), ufValue: UF_HOY },
      );
      expect(p.endDate).toEqual(d('2048-06-01'));
    });
  });

  describe('cuota en UF sin el valor de la UF disponible', () => {
    it('usa la última cuota pagada como referencia', () => {
      const p = computeInstallmentProgress(
        {
          ...hipotecario,
          payments: [
            { amount: 350102, date: d('2026-12-30') },
            { amount: 348778, date: d('2026-11-30') },
          ],
        },
        { today: d('2027-01-05'), ufValue: null },
      );
      // La MÁS RECIENTE por fecha, no la última de la lista.
      expect(p.installmentValueClp).toBe(350102);
      expect(p.installmentValueSource).toBe('LAST_PAYMENT');
    });

    it('sin UF y sin pagos, no inventa un monto', () => {
      const p = computeInstallmentProgress(hipotecario, {
        today: d('2026-11-12'),
        ufValue: null,
      });
      expect(p.installmentValueClp).toBeNull();
      expect(p.installmentValueSource).toBe('UNKNOWN');
      expect(p.remainingAmountClp).toBeNull();
    });
  });

  describe('cuotas en pesos (tarjeta, casa comercial)', () => {
    const tarjeta: InstallmentDebtInput = {
      totalInstallments: 12,
      installmentValue: 45000,
      unit: 'CLP',
      initialPaidInstallments: 4,
      nextDueDateAtStart: d('2026-12-15'),
      payments: [],
    };

    it('la cuota es el monto fijo, sin depender de la UF', () => {
      const p = computeInstallmentProgress(tarjeta, {
        today: d('2026-11-12'),
        ufValue: null,
      });
      expect(p.installmentValueClp).toBe(45000);
      expect(p.installmentValueSource).toBe('FIXED');
      expect(p.nextInstallmentNumber).toBe(5);
      expect(p.remainingInstallments).toBe(8);
      expect(p.remainingAmountClp).toBe(8 * 45000);
      expect(p.endDate).toEqual(d('2027-07-15'));
    });

    it('al pagar la última cuota queda pagada', () => {
      const pagos = Array.from({ length: 8 }, (_, i) => ({
        amount: 45000,
        date: addMonthsClamped(d('2026-12-10'), i),
      }));
      const p = computeInstallmentProgress(
        { ...tarjeta, payments: pagos },
        { today: d('2027-08-01'), ufValue: null },
      );
      expect(p.status).toBe('PAID');
      expect(p.isFinished).toBe(true);
      expect(p.percentage).toBe(100);
      expect(p.remainingInstallments).toBe(0);
      expect(p.remainingAmountClp).toBe(0);
      expect(p.nextInstallmentNumber).toBeNull();
      expect(p.nextDueDate).toBeNull();
      expect(p.daysUntilDue).toBeNull();
    });

    it('un pago de más no deja cuotas negativas', () => {
      const pagos = Array.from({ length: 10 }, () => ({
        amount: 45000,
        date: d('2027-01-10'),
      }));
      const p = computeInstallmentProgress(
        { ...tarjeta, payments: pagos },
        { today: d('2027-08-01'), ufValue: null },
      );
      expect(p.paidInstallments).toBe(12);
      expect(p.remainingInstallments).toBe(0);
      expect(p.percentage).toBe(100);
    });

    it('vencimiento el 31: febrero cae el 28 y marzo vuelve al 31', () => {
      const p1 = computeInstallmentProgress(
        {
          ...tarjeta,
          nextDueDateAtStart: d('2027-01-31'),
          payments: [{ amount: 45000, date: d('2027-01-30') }],
        },
        { today: d('2027-02-01'), ufValue: null },
      );
      expect(p1.nextDueDate).toEqual(d('2027-02-28'));

      const p2 = computeInstallmentProgress(
        {
          ...tarjeta,
          nextDueDateAtStart: d('2027-01-31'),
          payments: [
            { amount: 45000, date: d('2027-01-30') },
            { amount: 45000, date: d('2027-02-27') },
          ],
        },
        { today: d('2027-03-01'), ufValue: null },
      );
      expect(p2.nextDueDate).toEqual(d('2027-03-31'));
    });
  });
});

describe('deuda de MONTO LIBRE (préstamo familiar)', () => {
  const prestamo = {
    totalAmount: 3_000_000,
    initialPaidAmount: 0,
    payments: [] as { amount: number; date: Date }[],
  };

  it('sin pagos: todo pendiente y sin fecha estimada', () => {
    const p = computeFreeAmountProgress(prestamo);
    expect(p.paidAmountClp).toBe(0);
    expect(p.remainingAmountClp).toBe(3_000_000);
    expect(p.percentage).toBe(0);
    expect(p.estimatedEndDate).toBeNull();
    expect(p.status).toBe('ACTIVE');
  });

  it('descuenta lo pagado, sea el monto que sea', () => {
    const p = computeFreeAmountProgress({
      ...prestamo,
      payments: [
        { amount: 300_000, date: d('2026-09-05') },
        { amount: 300_000, date: d('2026-10-05') },
        { amount: 150_000, date: d('2026-11-05') },
      ],
    });
    expect(p.paidAmountClp).toBe(750_000);
    expect(p.remainingAmountClp).toBe(2_250_000);
    expect(p.percentage).toBeCloseTo(25);
  });

  it('estima el término al ritmo de los últimos 3 pagos', () => {
    // Promedio 250.000 → faltan 2.250.000 → 9 meses desde el último pago.
    const p = computeFreeAmountProgress({
      ...prestamo,
      payments: [
        { amount: 500_000, date: d('2026-06-05') }, // más antiguo: no entra al promedio
        { amount: 150_000, date: d('2026-11-05') },
        { amount: 300_000, date: d('2026-09-05') },
        { amount: 300_000, date: d('2026-10-05') },
      ],
    });
    expect(p.averageRecentPaymentClp).toBe(250_000);
    expect(p.remainingAmountClp).toBe(1_750_000);
    // 1.750.000 / 250.000 = 7 meses desde el 5 de noviembre.
    expect(p.estimatedEndDate).toEqual(d('2027-06-05'));
  });

  it('considera lo pagado antes de registrarlo en la app', () => {
    const p = computeFreeAmountProgress({
      ...prestamo,
      initialPaidAmount: 1_000_000,
    });
    expect(p.paidAmountClp).toBe(1_000_000);
    expect(p.remainingAmountClp).toBe(2_000_000);
  });

  it('al cubrir el total queda pagada, sin saldo negativo', () => {
    const p = computeFreeAmountProgress({
      ...prestamo,
      initialPaidAmount: 2_900_000,
      payments: [{ amount: 300_000, date: d('2026-11-05') }],
    });
    expect(p.remainingAmountClp).toBe(0);
    expect(p.percentage).toBe(100);
    expect(p.status).toBe('PAID');
    expect(p.isFinished).toBe(true);
    expect(p.estimatedEndDate).toEqual(d('2026-11-05'));
  });
});
