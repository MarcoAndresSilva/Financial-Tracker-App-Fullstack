import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DebtKind, Prisma, TransactionType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions/permissions.service';
import { UfService } from '../common/indicators/uf.service';
import { CreateDebtDto, UpdateDebtDto } from './dto';
import {
  computeFreeAmountProgress,
  computeInstallmentProgress,
} from './debt-progress';

/** Categoría donde viven las subcategorías de las deudas (una por deuda). */
export const DEBTS_CATEGORY_NAME = 'Deudas';

// Cada deuda se lee junto a los GASTOS de su subcategoría: esos son sus pagos.
const debtInclude = Prisma.validator<Prisma.DebtInclude>()({
  subcategory: {
    select: {
      categoryId: true,
      transactions: {
        where: { type: TransactionType.EXPENSE },
        select: { amount: true, date: true, createdAt: true },
      },
    },
  },
});
type DebtWithPayments = Prisma.DebtGetPayload<{ include: typeof debtInclude }>;

/**
 * Deudas (Paso 77). Este servicio BUSCA los datos (base, UF, fecha de hoy) y
 * se los PASA a las funciones puras de debt-progress.ts, que hacen el cálculo.
 * Así el cálculo se testea sin base de datos y esto queda como "pegamento".
 */
@Injectable()
export class DebtService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private uf: UfService,
  ) {}

  /**
   * Crea la deuda y la conecta a una subcategoría con su nombre dentro de
   * "Deudas" (creando la categoría y/o la subcategoría si no existen). Desde
   * ese momento, todo gasto que se registre ahí es un pago.
   */
  async createDebt(userId: string, dto: CreateDebtDto) {
    await this.permissions.checkWalletMembership(userId, dto.walletId);
    assertPaidWithinTotal(
      dto.kind,
      dto.totalInstallments,
      dto.initialPaidInstallments ?? 0,
    );

    try {
      const debt = await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.findOrCreateDebtsCategory(
          tx,
          dto.walletId,
        );

        // Si ya existía una subcategoría con ese nombre (ej. la creaste antes
        // a mano), se reutiliza; sus gastos ANTERIORES no cuentan como pagos
        // (ver paymentsOf).
        const existing = await tx.subcategory.findUnique({
          where: { categoryId_name: { categoryId, name: dto.name } },
          include: { debt: { select: { id: true } } },
        });
        if (existing?.debt) {
          throw new ConflictException(
            'Ya existe una deuda con ese nombre en esta cartera.',
          );
        }
        const subcategory =
          existing ??
          (await tx.subcategory.create({
            data: { name: dto.name, categoryId },
          }));

        return tx.debt.create({
          data: {
            name: dto.name,
            kind: dto.kind,
            walletId: dto.walletId,
            subcategoryId: subcategory.id,
            ...kindSpecificData(dto.kind, dto),
          },
          include: debtInclude,
        });
      });

      return this.toResponse(debt, await this.ufValueFor([debt]));
    } catch (error) {
      throw mapDuplicateNameError(error);
    }
  }

  async getDebtsByWallet(userId: string, walletId: string) {
    await this.permissions.checkWalletMembership(userId, walletId);
    const debts = await this.prisma.debt.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      include: debtInclude,
    });
    // La UF se pide una sola vez para todas las deudas (y solo si alguna la usa).
    const ufValue = await this.ufValueFor(debts);
    return debts.map((debt) => this.toResponse(debt, ufValue));
  }

  async getDebtById(userId: string, debtId: string) {
    const debt = await this.getDebtOrThrow(debtId);
    await this.permissions.checkWalletMembership(userId, debt.walletId);
    return this.toResponse(debt, await this.ufValueFor([debt]));
  }

  /** Editar: renombrar la deuda renombra también su subcategoría. */
  async updateDebtById(userId: string, debtId: string, dto: UpdateDebtDto) {
    const debt = await this.getDebtOrThrow(debtId);
    await this.permissions.checkWalletMembership(userId, debt.walletId);
    assertPaidWithinTotal(
      debt.kind,
      dto.totalInstallments ?? debt.totalInstallments ?? undefined,
      dto.initialPaidInstallments ?? debt.initialPaidInstallments,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.name && dto.name !== debt.name) {
          await tx.subcategory.update({
            where: { id: debt.subcategoryId },
            data: { name: dto.name },
          });
        }
        return tx.debt.update({
          where: { id: debtId },
          data: { name: dto.name, ...kindSpecificData(debt.kind, dto) },
          include: debtInclude,
        });
      });
      return this.toResponse(updated, await this.ufValueFor([updated]));
    } catch (error) {
      throw mapDuplicateNameError(error);
    }
  }

  /**
   * Borra solo la deuda: la subcategoría y sus gastos quedan como historial
   * (lo que pagaste, lo pagaste igual).
   */
  async deleteDebtById(userId: string, debtId: string) {
    const debt = await this.getDebtOrThrow(debtId);
    await this.permissions.checkWalletMembership(userId, debt.walletId);
    await this.prisma.debt.delete({ where: { id: debtId } });
    return { message: 'Debt deleted successfully' };
  }

  // -------------------------------------------------------------------------

  private async getDebtOrThrow(debtId: string): Promise<DebtWithPayments> {
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
      include: debtInclude,
    });
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }
    return debt;
  }

  /** Busca "Deudas" sin importar mayúsculas (ej. "deudas"); si no está, la crea. */
  private async findOrCreateDebtsCategory(
    tx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<string> {
    const found = await tx.category.findFirst({
      where: {
        walletId,
        name: { equals: DEBTS_CATEGORY_NAME, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (found) return found.id;

    const created = await tx.category.create({
      data: { name: DEBTS_CATEGORY_NAME, walletId },
      select: { id: true },
    });
    return created.id;
  }

  private async ufValueFor(debts: DebtWithPayments[]): Promise<number | null> {
    return debts.some((d) => d.unit === 'UF') ? this.uf.getUfValue() : null;
  }

  /** Datos guardados + progreso calculado por las funciones puras. */
  private toResponse(debt: DebtWithPayments, ufValue: number | null) {
    const payments = paymentsOf(debt);

    const progress =
      debt.kind === DebtKind.INSTALLMENTS
        ? computeInstallmentProgress(
            {
              totalInstallments: debt.totalInstallments,
              installmentValue: debt.installmentValue,
              unit: debt.unit,
              initialPaidInstallments: debt.initialPaidInstallments,
              nextDueDateAtStart: debt.nextDueDateAtStart,
              payments,
            },
            { today: todayInChile(), ufValue },
          )
        : computeFreeAmountProgress({
            totalAmount: debt.totalAmount,
            initialPaidAmount: debt.initialPaidAmount,
            payments,
          });

    return {
      id: debt.id,
      name: debt.name,
      kind: debt.kind,
      unit: debt.unit,
      totalInstallments: debt.totalInstallments,
      installmentValue: debt.installmentValue,
      initialPaidInstallments: debt.initialPaidInstallments,
      nextDueDateAtStart: debt.nextDueDateAtStart,
      totalAmount: debt.totalAmount,
      initialPaidAmount: debt.initialPaidAmount,
      walletId: debt.walletId,
      subcategoryId: debt.subcategoryId,
      categoryId: debt.subcategory.categoryId,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      progress,
    };
  }
}

// ---------------------------------------------------------------------------

/**
 * Pagos = gastos de la subcategoría REGISTRADOS después de crear la deuda. Lo
 * pagado antes ya está incluido en "cuotas/plata ya pagadas" al registrarla;
 * contarlo de nuevo lo duplicaría (importa si se reutilizó una subcategoría
 * que ya tenía gastos).
 */
function paymentsOf(debt: DebtWithPayments) {
  return debt.subcategory.transactions
    .filter((t) => t.createdAt >= debt.createdAt)
    .map((t) => ({ amount: t.amount, date: t.date }));
}

/** Solo se guardan los campos que corresponden al tipo de la deuda. */
type KindSpecificFields = Partial<
  Pick<
    Prisma.DebtUncheckedCreateInput,
    | 'totalInstallments'
    | 'installmentValue'
    | 'unit'
    | 'initialPaidInstallments'
    | 'nextDueDateAtStart'
    | 'totalAmount'
    | 'initialPaidAmount'
  >
>;

function kindSpecificData(
  kind: DebtKind,
  dto: CreateDebtDto | UpdateDebtDto,
): KindSpecificFields {
  if (kind === DebtKind.INSTALLMENTS) {
    return {
      totalInstallments: dto.totalInstallments,
      installmentValue: dto.installmentValue,
      unit: dto.unit,
      initialPaidInstallments: dto.initialPaidInstallments,
      nextDueDateAtStart: dto.nextDueDate
        ? new Date(dto.nextDueDate)
        : undefined,
    };
  }
  return {
    totalAmount: dto.totalAmount,
    initialPaidAmount: dto.initialPaidAmount,
  };
}

function assertPaidWithinTotal(
  kind: DebtKind,
  totalInstallments: number | undefined,
  initialPaidInstallments: number,
) {
  if (
    kind === DebtKind.INSTALLMENTS &&
    totalInstallments !== undefined &&
    initialPaidInstallments > totalInstallments
  ) {
    throw new BadRequestException(
      'Las cuotas ya pagadas no pueden superar el total de cuotas.',
    );
  }
}

function mapDuplicateNameError(error: unknown) {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException(
      'Ya existe una deuda (o subcategoría) con ese nombre en esta cartera.',
    );
  }
  return error;
}

/**
 * "Hoy" según el calendario de Chile, como fecha UTC a medianoche (el mismo
 * formato que las fechas de las transacciones). Con la hora UTC, entre las
 * 21:00 y la medianoche chilena ya sería "mañana".
 */
function todayInChile(): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
  }).format(new Date());
  return new Date(`${iso}T00:00:00.000Z`);
}
