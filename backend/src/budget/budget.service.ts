import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetScope, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions/permissions.service';
import { DebtService, monthRangeUtc } from '../debt/debt.service';
import { UpsertBudgetEntryDto } from './dto/upsert-budget-entry.dto';
import {
  BudgetEntry,
  budgetStatus,
  debtCommitmentsForMonth,
  PlanLine,
  resolveBudget,
  summarizePlan,
  YearMonth,
} from './budget-logic';

/**
 * Presupuesto (Paso 81). Igual que DebtService, este servicio BUSCA los datos
 * (categorías, montos guardados, transacciones del mes, deudas) y se los PASA
 * a las funciones puras de budget-logic.ts, que deciden todo lo demás.
 */
@Injectable()
export class BudgetService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private debts: DebtService,
  ) {}

  /** El plan completo de un mes: resumen, una línea por categoría y compromisos. */
  async getPlan(userId: string, walletId: string, period: YearMonth) {
    await this.permissions.checkWalletMembership(userId, walletId);
    const { start, end } = monthRangeUtc(period);

    const [categories, entries, monthTx, history, commitmentDebts] =
      await Promise.all([
        this.prisma.category.findMany({
          where: { walletId },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            subcategories: { select: { debt: { select: { id: true } } } },
          },
        }),
        this.prisma.budgetEntry.findMany({ where: { category: { walletId } } }),
        // Movimientos del mes (para ingresos y gastado por categoría).
        this.prisma.transaction.findMany({
          where: { walletId, date: { gte: start, lt: end } },
          select: {
            amount: true,
            type: true,
            subcategory: { select: { categoryId: true } },
          },
        }),
        // Qué tipos de movimiento ha tenido cada categoría alguna vez (para
        // reconocer las categorías "solo de ingresos").
        this.prisma.transaction.findMany({
          where: { walletId },
          distinct: ['subcategoryId', 'type'],
          select: { type: true, subcategory: { select: { categoryId: true } } },
        }),
        this.debts.getCommitmentDebts(walletId, period),
      ]);

    const income = sum(
      monthTx
        .filter((t) => t.type === TransactionType.INCOME)
        .map((t) => t.amount),
    );

    const lines = categories
      .filter((c) => isBudgetable(c, history))
      .map((category) => {
        const { amount: budget, source } = resolveBudget(
          entries.filter((e) => e.categoryId === category.id) as BudgetEntry[],
          period,
        );
        const spent = sum(
          monthTx
            .filter(
              (t) =>
                t.type === TransactionType.EXPENSE &&
                t.subcategory.categoryId === category.id,
            )
            .map((t) => t.amount),
        );
        return {
          categoryId: category.id,
          name: category.name,
          budget,
          source,
          spent,
          status: budget === null ? null : budgetStatus(budget, spent),
        };
      });

    const commitments = debtCommitmentsForMonth(commitmentDebts, period);

    return {
      year: period.year,
      month: period.month,
      summary: summarizePlan({
        income,
        debtCommitments: commitments.totalClp,
        lines: lines as PlanLine[],
      }),
      categories: lines,
      commitments,
    };
  }

  /**
   * Guarda (o quita, con amount null) el presupuesto de una categoría.
   *
   * "Desde este mes" (FROM_MONTH) significa "este mes y los siguientes", así
   * que también:
   *   - borra el ajuste puntual de ESE mes (si no, seguiría ganándole);
   *   - borra los "desde" POSTERIORES (si no, cortarían el cambio más adelante).
   * Respeta los ajustes puntuales futuros (ej. "solo febrero" por un
   * cumpleaños) y no toca los meses anteriores: el historial no se reescribe.
   */
  async upsertEntry(userId: string, dto: UpsertBudgetEntryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { walletId: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.permissions.checkWalletMembership(userId, category.walletId);

    const { categoryId, year, month, scope, amount } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (scope === BudgetScope.FROM_MONTH) {
        await tx.budgetEntry.deleteMany({
          where: { categoryId, year, month, scope: BudgetScope.ONLY_MONTH },
        });
        await tx.budgetEntry.deleteMany({
          where: {
            categoryId,
            scope: BudgetScope.FROM_MONTH,
            OR: [{ year: { gt: year } }, { year, month: { gt: month } }],
          },
        });
      }

      return tx.budgetEntry.upsert({
        where: {
          categoryId_year_month_scope: { categoryId, year, month, scope },
        },
        update: { amount },
        create: { categoryId, year, month, scope, amount },
      });
    });
  }
}

// ---------------------------------------------------------------------------

type CategoryWithDebts = {
  id: string;
  subcategories: { debt: { id: string } | null }[];
};
type TypeByCategory = {
  type: TransactionType;
  subcategory: { categoryId: string };
};

/**
 * Una categoría se presupuesta salvo que:
 *   - sea la de las deudas (tiene subcategorías de deudas): sus pagos ya están
 *     en los compromisos; presupuestarla sería contarlos dos veces;
 *   - sea "solo de ingresos" (ha tenido ingresos y nunca un gasto, ej.
 *     Ingresos → Sueldo): no tiene sentido ponerle un tope de gasto.
 */
function isBudgetable(
  category: CategoryWithDebts,
  history: TypeByCategory[],
): boolean {
  if (category.subcategories.some((s) => s.debt !== null)) return false;

  const types = history
    .filter((h) => h.subcategory.categoryId === category.id)
    .map((h) => h.type);
  const incomeOnly =
    types.includes(TransactionType.INCOME) &&
    !types.includes(TransactionType.EXPENSE);
  return !incomeOnly;
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
