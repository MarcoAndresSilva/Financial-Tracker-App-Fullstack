// backend/src/dashboard/dashboard.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // --- Resumen General de la Cartera ---
  async getWalletSummary(userId: string, walletId: string) {
    await this.checkWalletMembership(userId, walletId);

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

  // --- Resumen del Mes Actual (para la alerta de gasto vs. sueldo) ---
  async getMonthlySummary(userId: string, walletId: string) {
    await this.checkWalletMembership(userId, walletId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          walletId,
          type: TransactionType.INCOME,
          date: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          walletId,
          type: TransactionType.EXPENSE,
          date: { gte: startOfMonth },
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
  async getExpensesByCategory(userId: string, walletId: string) {
    await this.checkWalletMembership(userId, walletId);
    return this.getAmountsBreakdown(walletId, TransactionType.EXPENSE, 'category');
  }

  // --- Ingresos Agrupados por Subcategoría ---
  // Los ingresos suelen vivir todos bajo una sola categoría ("Ingresos"), con
  // el detalle real (sueldo, extras, etc.) en las subcategorías — agrupar por
  // categoría los mezclaría todos en un solo bloque sin decir nada útil.
  async getIncomeByCategory(userId: string, walletId: string) {
    await this.checkWalletMembership(userId, walletId);
    return this.getAmountsBreakdown(walletId, TransactionType.INCOME, 'subcategory');
  }

  // --- Función Auxiliar: monto agrupado por categoría o subcategoría, para un tipo de transacción dado ---
  private async getAmountsBreakdown(
    walletId: string,
    type: TransactionType,
    groupLevel: 'category' | 'subcategory',
  ) {
    // consulta avanzada de Prisma
    const transactions = await this.prisma.transaction.groupBy({
      by: ['subcategoryId'], // Siempre agrupamos por subcategoría primero
      where: {
        walletId,
        type,
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

  // --- Función Auxiliar de Permisos --- (La movemos aquí también)
  private async checkWalletMembership(userId: string, walletId: string) {
    const membership = await this.prisma.walletMembership.findUnique({
      where: { userId_walletId: { userId, walletId } },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this wallet');
    }
  }
}
