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

  // --- Gastos Agrupados por Categoría ---
  async getExpensesByCategory(userId: string, walletId: string) {
    await this.checkWalletMembership(userId, walletId);

    // consulta avanzada de Prisma
    const expenses = await this.prisma.transaction.groupBy({
      by: ['subcategoryId'], // Agrupamos por subcategoría
      where: {
        walletId,
        type: TransactionType.EXPENSE,
      },
      _sum: {
        amount: true, // Sumamos el monto para cada grupo
      },
    });

    // La consulta anterior nos da IDs, pero queremos nombres. Necesitamos "enriquecer" los datos.
    const enrichedExpenses = await Promise.all(
      expenses.map(async (expense) => {
        const subcategory = await this.prisma.subcategory.findUnique({
          where: { id: expense.subcategoryId },
          include: { category: true },
        });
        return {
          categoryName: subcategory.category.name,
          amount: expense._sum.amount,
        };
      }),
    );

    // Ahora, si tenemos múltiples subcategorías de la misma categoría, las sumamos. Ej: 'Supermercado' y 'Restaurante' son de la categoría 'Comida'.
    const finalSummary = enrichedExpenses.reduce(
      (acc, item) => {
        if (!acc[item.categoryName]) {
          acc[item.categoryName] = 0;
        }
        acc[item.categoryName] += item.amount;
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
