// backend/src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';
import { PermissionsService } from '../common/permissions/permissions.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  // --- Resumen General de la Cartera ---
  async getWalletSummary(userId: string, walletId: string) {
    await this.permissions.checkWalletMembership(userId, walletId);

    // Hacemos dos cálculos en paralelo para más eficiencia
    const [income, expense] = await Promise.all([
      // 1. Suma de todos los INGRESOS
      this.prisma.transaction.aggregate({
        where: { walletId, type: TransactionType.INCOME },
        _sum: {
          amount: true,
        },
      }),
      // 2. Suma de todos los GASTOS
      this.prisma.transaction.aggregate({
        where: { walletId, type: TransactionType.EXPENSE },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const totalIncome = income._sum.amount || 0;
    const totalExpense = expense._sum.amount || 0;

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }

  // --- Rango de un mes en UTC explícito ---
  // La columna `date` es `@db.Date` y Prisma la compara contra medianoche UTC;
  // calcular el límite con el huso local del proceso provocaría desajustes de un
  // día según dónde corra el servidor. `month` es 1–12. Sin año/mes → mes actual.
  private monthRange(year?: number, month?: number): { gte: Date; lt: Date } {
    const now = new Date();
    const y = year ?? now.getUTCFullYear();
    const m = month ?? now.getUTCMonth() + 1;
    return {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1)),
    };
  }

  // Igual que `monthRange` pero devuelve `undefined` si no se pidió un mes
  // concreto — para los breakdowns, que sin mes agregan todo el histórico.
  private optionalMonthRange(
    year?: number,
    month?: number,
  ): { gte: Date; lt: Date } | undefined {
    if (!year || !month) return undefined;
    return this.monthRange(year, month);
  }

  // --- Resumen de un mes (para la alerta de gasto vs. sueldo) ---
  // Sin `year`/`month` devuelve el mes en curso; con ellos, el mes pedido.
  async getMonthlySummary(
    userId: string,
    walletId: string,
    year?: number,
    month?: number,
  ) {
    await this.permissions.checkWalletMembership(userId, walletId);

    const range = this.monthRange(year, month);

    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          walletId,
          type: TransactionType.INCOME,
          date: range,
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          walletId,
          type: TransactionType.EXPENSE,
          date: range,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = income._sum.amount || 0;
    const totalExpense = expense._sum.amount || 0;
    const percentageSpent =
      totalIncome > 0 ? (totalExpense / totalIncome) * 100 : null;

    return { totalIncome, totalExpense, percentageSpent };
  }

  // --- Gastos Agrupados por Categoría ---
  // Los gastos suelen concentrarse en pocas categorías grandes (Alimentación,
  // Transporte, etc.), así que acá el nivel útil de detalle es la categoría.
  // Sin `year`/`month` agrega todo el histórico de la cartera; con ellos, solo ese mes.
  async getExpensesByCategory(
    userId: string,
    walletId: string,
    year?: number,
    month?: number,
  ) {
    await this.permissions.checkWalletMembership(userId, walletId);
    return this.getAmountsBreakdown(
      walletId,
      TransactionType.EXPENSE,
      'category',
      this.optionalMonthRange(year, month),
    );
  }

  // --- Ingresos Agrupados por Subcategoría ---
  // Los ingresos suelen vivir todos bajo una sola categoría ("Ingresos"), con
  // el detalle real (sueldo, extras, etc.) en las subcategorías — agrupar por
  // categoría los mezclaría todos en un solo bloque sin decir nada útil.
  async getIncomeByCategory(
    userId: string,
    walletId: string,
    year?: number,
    month?: number,
  ) {
    await this.permissions.checkWalletMembership(userId, walletId);
    return this.getAmountsBreakdown(
      walletId,
      TransactionType.INCOME,
      'subcategory',
      this.optionalMonthRange(year, month),
    );
  }

  // --- Función Auxiliar: monto agrupado por categoría o subcategoría, para un tipo de transacción dado ---
  private async getAmountsBreakdown(
    walletId: string,
    type: TransactionType,
    groupLevel: 'category' | 'subcategory',
    dateRange?: { gte: Date; lt: Date },
  ) {
    // consulta avanzada de Prisma
    const transactions = await this.prisma.transaction.groupBy({
      by: ['subcategoryId'], // Siempre agrupamos por subcategoría primero
      where: {
        walletId,
        type,
        ...(dateRange && { date: dateRange }),
      },
      _sum: {
        amount: true, // Sumamos el monto para cada grupo
      },
    });

    // La consulta anterior nos da IDs, pero queremos nombres. Necesitamos "enriquecer" los datos.
    const enriched = await Promise.all(
      transactions.map(async (item) => {
        const subcategory = await this.prisma.subcategory.findUnique({
          where: { id: item.subcategoryId },
          include: { category: true },
        });
        const label =
          groupLevel === 'subcategory'
            ? subcategory.name
            : subcategory.category.name;
        return {
          label,
          amount: item._sum.amount,
        };
      }),
    );

    // Si el nivel elegido repite nombre (ej. dos subcategorías "Extras" en categorías distintas), sumamos.
    const finalSummary = enriched.reduce(
      (acc, item) => {
        if (!acc[item.label]) {
          acc[item.label] = 0;
        }
        acc[item.label] += item.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Lo convertimos a un formato ideal para gráficos
    return Object.entries(finalSummary).map(([name, value]) => ({
      name,
      value,
    }));
  }
}
