import { addMonthsClamped } from '../debt/debt-progress';

/**
 * El "cerebro" del presupuesto — funciones PURAS: sin base de datos. El
 * contrato está en budget-logic.spec.ts.
 *
 * Decisiones que fija este archivo:
 *   - Los montos se guardan con fecha (año/mes) y alcance, así cambiar el
 *     presupuesto "desde enero" no reescribe lo planificado en diciembre.
 *   - Las deudas NO se presupuestan (son contratos ya asumidos y se gestionan
 *     en su página): acá solo se LEEN para saber cuánto comprometen cada mes.
 */

export interface YearMonth {
  year: number;
  month: number; // 1–12
}

// ---------------------------------------------------------------------------
// Qué presupuesto aplica a un mes
// ---------------------------------------------------------------------------

export type BudgetScope = 'FROM_MONTH' | 'ONLY_MONTH';

/** Un monto guardado para una categoría. amount null = "sin presupuesto". */
export interface BudgetEntry extends YearMonth {
  amount: number | null;
  scope: BudgetScope;
}

export type BudgetSource = 'MONTH_ADJUSTMENT' | 'RECURRING' | 'NONE';

/** Índice correlativo de un mes, para comparar y restar meses fácilmente. */
const monthIndex = ({ year, month }: YearMonth) => year * 12 + (month - 1);

/**
 * Presupuesto de una categoría en un mes:
 *   1. el ajuste de ESE mes ("solo este mes"), si existe;
 *   2. si no, el último "desde tal mes" que empezó ese mes o antes;
 *   3. si no, ninguno.
 * Un monto null en cualquiera de los dos significa "sin presupuesto".
 */
export function resolveBudget(
  entries: BudgetEntry[],
  period: YearMonth,
): { amount: number | null; source: BudgetSource } {
  const target = monthIndex(period);

  const adjustment = entries.find(
    (e) => e.scope === 'ONLY_MONTH' && monthIndex(e) === target,
  );
  if (adjustment) {
    return adjustment.amount === null
      ? { amount: null, source: 'NONE' }
      : { amount: adjustment.amount, source: 'MONTH_ADJUSTMENT' };
  }

  const recurring = entries
    .filter((e) => e.scope === 'FROM_MONTH' && monthIndex(e) <= target)
    .sort((a, b) => monthIndex(b) - monthIndex(a))[0];
  if (recurring && recurring.amount !== null) {
    return { amount: recurring.amount, source: 'RECURRING' };
  }
  return { amount: null, source: 'NONE' };
}

// ---------------------------------------------------------------------------
// Color de la barra
// ---------------------------------------------------------------------------

export type BudgetStatus = 'OK' | 'WARNING' | 'OVER';

/** Desde qué porcentaje la barra pasa a amarillo. */
export const WARNING_PERCENTAGE = 80;

export interface BudgetStatusResult {
  status: BudgetStatus;
  /** null cuando el presupuesto es 0 y hubo gastos (sería infinito). */
  percentage: number | null;
  /** Negativo = cuánto te pasaste. */
  remaining: number;
}

export function budgetStatus(
  budget: number,
  spent: number,
): BudgetStatusResult {
  const remaining = budget - spent;

  if (budget <= 0) {
    return spent > 0
      ? { status: 'OVER', percentage: null, remaining }
      : { status: 'OK', percentage: 0, remaining };
  }

  const percentage = (spent / budget) * 100;
  const status: BudgetStatus =
    percentage > 100
      ? 'OVER'
      : percentage >= WARNING_PERCENTAGE
        ? 'WARNING'
        : 'OK';
  return { status, percentage, remaining };
}

// ---------------------------------------------------------------------------
// El plan del mes
// ---------------------------------------------------------------------------

export interface PlanLine {
  budget: number | null;
  spent: number;
}

export interface PlanSummary {
  income: number;
  debtCommitments: number;
  /** Suma de los presupuestos definidos. */
  totalPlanned: number;
  /** Lo gastado en las categorías CON presupuesto. */
  totalSpent: number;
  /** Ingresos − compromisos de deudas − planificado (negativo = planificaste de más). */
  unassigned: number;
  /** Estado general (mismos colores que cada barra); null si no hay nada planificado. */
  overall: BudgetStatusResult | null;
  unbudgetedCount: number;
  /** Lo gastado en categorías SIN presupuesto: se informa aparte, no en la dona. */
  unbudgetedSpent: number;
}

export function summarizePlan(input: {
  income: number;
  debtCommitments: number;
  lines: PlanLine[];
}): PlanSummary {
  const budgeted = input.lines.filter((l) => l.budget !== null);
  const unbudgeted = input.lines.filter((l) => l.budget === null);

  const totalPlanned = sum(budgeted.map((l) => l.budget));
  const totalSpent = sum(budgeted.map((l) => l.spent));

  return {
    income: input.income,
    debtCommitments: input.debtCommitments,
    totalPlanned,
    totalSpent,
    unassigned: input.income - input.debtCommitments - totalPlanned,
    overall: budgeted.length ? budgetStatus(totalPlanned, totalSpent) : null,
    unbudgetedCount: unbudgeted.length,
    unbudgetedSpent: sum(unbudgeted.map((l) => l.spent)),
  };
}

// ---------------------------------------------------------------------------
// Compromisos de deudas del mes (solo lectura)
// ---------------------------------------------------------------------------

export interface InstallmentCommitmentDebt {
  kind: 'INSTALLMENTS';
  name: string;
  totalInstallments: number;
  initialPaidInstallments: number;
  nextDueDateAtStart: Date;
  /** Cuotas pagadas a hoy (las iniciales + los pagos registrados). */
  paidInstallments: number;
  installmentValueClp: number | null;
}

export interface FreeAmountCommitmentDebt {
  kind: 'FREE_AMOUNT';
  name: string;
  isFinished: boolean;
  /** "Pago mensual habitual" (ej. $300.000), si se definió. */
  plannedMonthlyClp: number | null;
  averageRecentPaymentClp: number | null;
  /** Lo pagado en el mes consultado (0 si nada). */
  paidInPeriodClp: number;
}

/** Una deuda vista desde el presupuesto: en cuotas O de monto libre. */
export type CommitmentDebt =
  | InstallmentCommitmentDebt
  | FreeAmountCommitmentDebt;

export interface CommitmentItem {
  name: string;
  installmentNumber: number | null; // null en monto libre
  totalInstallments: number | null;
  amountClp: number | null; // null = no hay cómo estimarlo
  estimated: boolean;
  dueDate: Date | null;
  paid: boolean;
}

export interface MonthCommitments {
  items: CommitmentItem[];
  totalClp: number;
  paidCount: number;
  totalCount: number;
  /** Cuántos compromisos no tienen monto (no suman al total). */
  withoutEstimate: number;
}

export function debtCommitmentsForMonth(
  debts: CommitmentDebt[],
  period: YearMonth,
): MonthCommitments {
  const items = debts
    .map((debt) =>
      debt.kind === 'INSTALLMENTS'
        ? installmentCommitment(debt, period)
        : freeAmountCommitment(debt),
    )
    .filter((item): item is CommitmentItem => item !== null);

  return {
    items,
    totalClp: sum(items.map((i) => i.amountClp ?? 0)),
    paidCount: items.filter((i) => i.paid).length,
    totalCount: items.length,
    withoutEstimate: items.filter((i) => i.amountClp === null).length,
  };
}

/**
 * Qué cuota cae en el mes: el ancla (vencimiento de la cuota initialPaid + 1)
 * más los meses transcurridos hasta el consultado. Fuera del rango 1..total
 * (deuda que no empieza o ya terminó), no hay compromiso ese mes.
 */
function installmentCommitment(
  debt: InstallmentCommitmentDebt,
  period: YearMonth,
): CommitmentItem | null {
  const anchor = debt.nextDueDateAtStart;
  const monthsFromAnchor =
    monthIndex(period) -
    monthIndex({
      year: anchor.getUTCFullYear(),
      month: anchor.getUTCMonth() + 1,
    });
  const installmentNumber = debt.initialPaidInstallments + 1 + monthsFromAnchor;

  if (installmentNumber < 1 || installmentNumber > debt.totalInstallments) {
    return null;
  }

  return {
    name: debt.name,
    installmentNumber,
    totalInstallments: debt.totalInstallments,
    amountClp: debt.installmentValueClp,
    estimated: false,
    dueDate: addMonthsClamped(anchor, monthsFromAnchor),
    paid: debt.paidInstallments >= installmentNumber,
  };
}

/**
 * Monto libre: lo pagado de verdad si ya se pagó este mes; si no, el pago
 * mensual habitual; si no, el ritmo promedio (marcado como estimado).
 */
function freeAmountCommitment(
  debt: FreeAmountCommitmentDebt,
): CommitmentItem | null {
  if (debt.isFinished) return null;

  const base = {
    name: debt.name,
    installmentNumber: null,
    totalInstallments: null,
    dueDate: null,
  };
  if (debt.paidInPeriodClp > 0) {
    return {
      ...base,
      amountClp: debt.paidInPeriodClp,
      estimated: false,
      paid: true,
    };
  }
  if (debt.plannedMonthlyClp !== null) {
    return {
      ...base,
      amountClp: debt.plannedMonthlyClp,
      estimated: false,
      paid: false,
    };
  }
  return {
    ...base,
    amountClp:
      debt.averageRecentPaymentClp === null
        ? null
        : Math.round(debt.averageRecentPaymentClp),
    estimated: true,
    paid: false,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
