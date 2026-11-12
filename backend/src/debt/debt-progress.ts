/**
 * Cálculo del progreso de una deuda — funciones PURAS: sin base de datos ni
 * reloj del sistema. Reciben la deuda, sus pagos y "hoy", y devuelven todo lo
 * que muestra la tarjeta de la deuda. El contrato está en debt-progress.spec.ts.
 *
 * Todas las fechas son "solo día" en UTC (medianoche), igual que
 * Transaction.date (Paso 51): así no hay corrimientos por huso horario.
 */

export type AmountUnit = 'CLP' | 'UF';

export interface Payment {
  amount: number; // siempre en pesos: es lo que se registró como gasto
  date: Date;
}

// ---------------------------------------------------------------------------
// Deuda EN CUOTAS (hipotecario, consumo, tarjetas, casas comerciales)
// ---------------------------------------------------------------------------

export interface InstallmentDebtInput {
  totalInstallments: number;
  /** Valor de la cuota en su unidad (ej. 8.44 UF o 45000 pesos). */
  installmentValue: number;
  unit: AmountUnit;
  /** Cuotas pagadas antes de registrar la deuda en la app. */
  initialPaidInstallments: number;
  /** Vencimiento de la cuota N° initialPaidInstallments + 1 (la "próxima" al registrarla). */
  nextDueDateAtStart: Date;
  payments: Payment[];
}

export type InstallmentStatus = 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'PAID';

/** De dónde sale el valor en pesos de la cuota. */
export type InstallmentValueSource =
  | 'FIXED' // cuota en pesos
  | 'UF_TODAY' // UF de la cuota × valor de la UF de hoy
  | 'LAST_PAYMENT' // no hay UF disponible: se usa el último pago registrado
  | 'UNKNOWN'; // no hay cómo estimarlo: no se inventa un monto

export interface InstallmentProgress {
  paidInstallments: number;
  remainingInstallments: number;
  nextInstallmentNumber: number | null;
  nextDueDate: Date | null;
  endDate: Date;
  daysUntilDue: number | null;
  status: InstallmentStatus;
  isFinished: boolean;
  percentage: number;
  installmentValueClp: number | null;
  installmentValueSource: InstallmentValueSource;
  remainingAmountClp: number | null;
  paidAmountClp: number;
}

/** A cuántos días del vencimiento una cuota pasa a "por vencer". */
export const DUE_SOON_DAYS = 7;

export function computeInstallmentProgress(
  debt: InstallmentDebtInput,
  context: { today: Date; ufValue: number | null },
): InstallmentProgress {
  const total = debt.totalInstallments;

  // Cada pago registrado es UNA cuota, sin importar el monto (en UF el monto en
  // pesos varía; un pago parcial igual cuenta como la cuota del mes).
  const paidInstallments = Math.min(
    total,
    debt.initialPaidInstallments + debt.payments.length,
  );
  const remainingInstallments = total - paidInstallments;
  const isFinished = remainingInstallments === 0;

  // Las fechas se calculan siempre desde el ancla original (no mes a mes), así
  // una cuota que vence el 31 vuelve al 31 después de febrero.
  const anchor = debt.nextDueDateAtStart;
  const nextDueDate = isFinished
    ? null
    : addMonthsClamped(anchor, paidInstallments - debt.initialPaidInstallments);
  const endDate = addMonthsClamped(
    anchor,
    total - debt.initialPaidInstallments - 1,
  );

  const daysUntilDue = nextDueDate
    ? daysBetween(context.today, nextDueDate)
    : null;

  const { value: installmentValueClp, source: installmentValueSource } =
    installmentValueInClp(debt, context.ufValue);

  return {
    paidInstallments,
    remainingInstallments,
    nextInstallmentNumber: isFinished ? null : paidInstallments + 1,
    nextDueDate,
    endDate,
    daysUntilDue,
    status: installmentStatus(isFinished, daysUntilDue),
    isFinished,
    percentage: total > 0 ? (paidInstallments / total) * 100 : 100,
    installmentValueClp,
    installmentValueSource,
    remainingAmountClp: isFinished
      ? 0
      : installmentValueClp === null
        ? null
        : remainingInstallments * installmentValueClp,
    paidAmountClp: sum(debt.payments.map((p) => p.amount)),
  };
}

function installmentStatus(
  isFinished: boolean,
  daysUntilDue: number | null,
): InstallmentStatus {
  if (isFinished || daysUntilDue === null) return 'PAID';
  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= DUE_SOON_DAYS) return 'DUE_SOON';
  return 'UP_TO_DATE';
}

function installmentValueInClp(
  debt: InstallmentDebtInput,
  ufValue: number | null,
): { value: number | null; source: InstallmentValueSource } {
  if (debt.unit === 'CLP') {
    return { value: debt.installmentValue, source: 'FIXED' };
  }
  if (ufValue !== null) {
    return {
      value: Math.round(debt.installmentValue * ufValue),
      source: 'UF_TODAY',
    };
  }
  const latest = latestPayment(debt.payments);
  if (latest) {
    return { value: latest.amount, source: 'LAST_PAYMENT' };
  }
  return { value: null, source: 'UNKNOWN' };
}

// ---------------------------------------------------------------------------
// Deuda de MONTO LIBRE (préstamo familiar: se paga lo que se puede)
// ---------------------------------------------------------------------------

export interface FreeAmountDebtInput {
  totalAmount: number;
  /** Plata pagada antes de registrar la deuda en la app. */
  initialPaidAmount: number;
  payments: Payment[];
}

export interface FreeAmountProgress {
  paidAmountClp: number;
  remainingAmountClp: number;
  percentage: number;
  isFinished: boolean;
  status: 'ACTIVE' | 'PAID';
  /** Promedio de los últimos pagos: el "ritmo" con que se viene pagando. */
  averageRecentPaymentClp: number | null;
  /** Estimación al ritmo actual; null si todavía no hay pagos para estimar. */
  estimatedEndDate: Date | null;
}

/** Cuántos pagos recientes definen el "ritmo" de un préstamo de monto libre. */
export const RECENT_PAYMENTS_FOR_PACE = 3;

export function computeFreeAmountProgress(
  debt: FreeAmountDebtInput,
): FreeAmountProgress {
  const paidAmountClp =
    debt.initialPaidAmount + sum(debt.payments.map((p) => p.amount));
  const remainingAmountClp = Math.max(0, debt.totalAmount - paidAmountClp);
  const isFinished = remainingAmountClp === 0;

  const byDateDesc = [...debt.payments].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const recent = byDateDesc.slice(0, RECENT_PAYMENTS_FOR_PACE);
  const averageRecentPaymentClp = recent.length
    ? sum(recent.map((p) => p.amount)) / recent.length
    : null;
  const lastPaymentDate = byDateDesc[0]?.date ?? null;

  let estimatedEndDate: Date | null = null;
  if (isFinished) {
    estimatedEndDate = lastPaymentDate;
  } else if (lastPaymentDate && averageRecentPaymentClp) {
    const monthsLeft = Math.ceil(remainingAmountClp / averageRecentPaymentClp);
    estimatedEndDate = addMonthsClamped(lastPaymentDate, monthsLeft);
  }

  return {
    paidAmountClp,
    remainingAmountClp,
    percentage:
      debt.totalAmount > 0
        ? Math.min(100, (paidAmountClp / debt.totalAmount) * 100)
        : 100,
    isFinished,
    status: isFinished ? 'PAID' : 'ACTIVE',
    averageRecentPaymentClp,
    estimatedEndDate,
  };
}

// ---------------------------------------------------------------------------
// Utilidades de fecha (UTC, solo día)
// ---------------------------------------------------------------------------

/**
 * Suma meses conservando el día; si el mes destino no lo tiene, usa su último
 * día (31 ene + 1 mes = 28 feb, no 3 mar como haría `new Date` sin ajuste).
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTarget);
  return new Date(Date.UTC(year, month, day));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Días enteros de `from` a `to` (negativo si `to` ya pasó). */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function latestPayment(payments: Payment[]): Payment | undefined {
  return payments.reduce<Payment | undefined>(
    (latest, p) => (!latest || p.date > latest.date ? p : latest),
    undefined,
  );
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
