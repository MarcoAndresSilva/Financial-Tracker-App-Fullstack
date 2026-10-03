import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtDto, UpdateDebtDto } from './dto';
import { Debt } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PermissionsService } from '../common/permissions/permissions.service';

type DebtWithPayments = Debt & {
  payments: { amount: number; date: Date }[];
};

@Injectable()
export class DebtService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  async createDebt(userId: string, dto: CreateDebtDto) {
    await this.permissions.checkWalletMembership(userId, dto.walletId);
    try {
      const debt = await this.prisma.debt.create({
        data: {
          name: dto.name,
          totalAmount: dto.totalAmount,
          totalInstallments: dto.totalInstallments,
          startDate: new Date(dto.startDate),
          initialPaidInstallments: dto.initialPaidInstallments ?? 0,
          initialPaidAmount: dto.initialPaidAmount ?? 0,
          walletId: dto.walletId,
        },
      });
      return this.withProgress({ ...debt, payments: [] });
    } catch (error) {
      throw this.mapDuplicateNameError(error);
    }
  }

  // Devuelve las deudas de la cartera con el progreso ya calculado a partir de
  // los pagos (Transaction) vinculados — nunca se guarda un "avance" a mano,
  // así no puede desincronizarse de lo que realmente se registró como gasto.
  async getDebtsByWallet(userId: string, walletId: string) {
    await this.permissions.checkWalletMembership(userId, walletId);
    const debts = await this.prisma.debt.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      include: { payments: { select: { amount: true, date: true } } },
    });
    return debts.map((debt) => this.withProgress(debt));
  }

  async getDebtById(userId: string, debtId: string) {
    const debt = await this.getDebtOrThrow(debtId);
    await this.permissions.checkWalletMembership(userId, debt.walletId);
    return this.withProgress(debt);
  }

  async updateDebtById(userId: string, debtId: string, dto: UpdateDebtDto) {
    const debt = await this.getDebtOrThrow(debtId);
    await this.permissions.checkWalletMembership(userId, debt.walletId);
    try {
      const updated = await this.prisma.debt.update({
        where: { id: debtId },
        data: {
          ...dto,
          ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        },
      });
      return this.withProgress({ ...updated, payments: debt.payments });
    } catch (error) {
      throw this.mapDuplicateNameError(error);
    }
  }

  async deleteDebtById(userId: string, debtId: string) {
    const debt = await this.getDebtOrThrow(debtId);
    await this.permissions.checkWalletMembership(userId, debt.walletId);
    await this.prisma.debt.delete({ where: { id: debtId } });
    return { message: 'Debt deleted successfully' };
  }

  private async getDebtOrThrow(debtId: string): Promise<DebtWithPayments> {
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
      include: { payments: { select: { amount: true, date: true } } },
    });
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }
    return debt;
  }

  /**
   * Cuotas pagadas = declaradas al crear + N° de pagos vinculados — nunca por
   * el monto de cada pago, para que un pago parcial (ej. el préstamo
   * familiar, "esta vez pagamos 200 en vez de 300") siga contando como "la
   * cuota de este mes". Plata pagada, en cambio, sí es la suma real, así el
   * saldo pendiente refleja la plata exacta que falta.
   */
  private withProgress(debt: DebtWithPayments) {
    const paidInstallments =
      debt.initialPaidInstallments + debt.payments.length;
    const paidAmount =
      debt.initialPaidAmount +
      debt.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, debt.totalAmount - paidAmount);
    const remainingInstallments = Math.max(
      0,
      debt.totalInstallments - paidInstallments,
    );

    // Ancla para proyectar el término: la fecha del pago vinculado más
    // reciente, o la fecha declarada de inicio si todavía no hay ninguno. Si
    // un mes no se paga, el ancla no avanza y la fecha estimada simplemente
    // se corre sola la próxima vez que se recalcule — no hace falta ninguna
    // alerta de "atraso" aparte.
    const lastPaymentDate = debt.payments.length
      ? debt.payments.reduce(
          (latest, p) => (p.date > latest ? p.date : latest),
          debt.payments[0].date,
        )
      : debt.startDate;

    const isFinished = remainingAmount <= 0 || remainingInstallments <= 0;
    const estimatedEndDate = isFinished
      ? lastPaymentDate
      : addMonthsUTC(lastPaymentDate, remainingInstallments);

    return {
      id: debt.id,
      name: debt.name,
      totalAmount: debt.totalAmount,
      totalInstallments: debt.totalInstallments,
      initialPaidInstallments: debt.initialPaidInstallments,
      initialPaidAmount: debt.initialPaidAmount,
      startDate: debt.startDate,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      walletId: debt.walletId,
      paidInstallments,
      paidAmount,
      remainingAmount,
      remainingInstallments,
      percentage:
        debt.totalAmount > 0
          ? Math.min(100, (paidAmount / debt.totalAmount) * 100)
          : 100,
      isFinished,
      estimatedEndDate,
    };
  }

  private mapDuplicateNameError(error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Ya existe una deuda con ese nombre en esta cartera.',
      );
    }
    return error;
  }
}

// Suma meses en UTC explícito — mismo criterio que `monthRange` en
// DashboardService (Paso 52): evita corrimientos de día si el servidor corre
// en un huso horario distinto al de Chile.
function addMonthsUTC(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
    ),
  );
}
