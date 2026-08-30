import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BulkCopyTransactionsDto,
  BulkMoveTransactionsDto,
  CreateTransactionDto,
  GetTransactionsFilterDto,
  UpdateTransactionDto,
} from './dto';
import { Prisma } from '@prisma/client';
import { PermissionsService } from '../common/permissions/permissions.service';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    await this.permissions.checkWalletMembership(userId, dto.walletId);
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: dto.subcategoryId },
      include: { category: true },
    });
    if (!subcategory || subcategory.category.walletId !== dto.walletId) {
      throw new ForbiddenException(
        'Subcategory does not belong to this wallet',
      );
    }
    return this.prisma.transaction.create({
      data: {
        amount: dto.amount,
        type: dto.type,
        date: new Date(dto.date),
        description: dto.description,
        walletId: dto.walletId,
        subcategoryId: dto.subcategoryId,
        authorId: userId,
      },
    });
  }

  async getTransactionsByWallet(
    userId: string,
    filterDto: GetTransactionsFilterDto,
  ) {
    const { walletId, startDate, endDate, type, categoryId, subcategoryId } =
      filterDto;
    await this.permissions.checkWalletMembership(userId, walletId);
    const whereClause: Prisma.TransactionWhereInput = {
      walletId,
    };
    if (type) {
      whereClause.type = type;
    }
    if (subcategoryId) {
      whereClause.subcategoryId = subcategoryId;
    } else if (categoryId) {
      whereClause.subcategory = {
        categoryId: categoryId,
      };
    }
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate);
      }
    }
    return this.prisma.transaction.findMany({
      where: whereClause,
      // Desempata por fecha de creación: entre transacciones con la misma
      // `date` (elegida por el usuario), la creada más recientemente aparece primero.
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        subcategory: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async getTransactionById(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    await this.permissions.checkWalletMembership(userId, transaction.walletId);
    return transaction;
  }

  async updateTransactionById(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    const transaction = await this.getTransactionById(userId, transactionId);
    await this.permissions.checkWalletMembership(userId, transaction.walletId);
    if (dto.subcategoryId) {
      const subcategory = await this.prisma.subcategory.findUnique({
        where: { id: dto.subcategoryId },
        include: { category: true },
      });
      if (
        !subcategory ||
        subcategory.category.walletId !== transaction.walletId
      ) {
        throw new ForbiddenException(
          'New subcategory does not belong to this wallet',
        );
      }
    }
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...dto,
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  /**
   * Reasigna la fecha de varias transacciones de una vez (mover un lote a otro
   * mes). El `walletId` en el `where` del `updateMany` garantiza que solo se
   * toquen transacciones de esa wallet, aunque en `transactionIds` viniera un
   * id ajeno.
   */
  async bulkMove(userId: string, dto: BulkMoveTransactionsDto) {
    await this.permissions.checkWalletMembership(userId, dto.walletId);

    const result = await this.prisma.transaction.updateMany({
      where: {
        id: { in: dto.transactionIds },
        walletId: dto.walletId,
      },
      data: { date: new Date(dto.date) },
    });

    return { count: result.count };
  }

  /**
   * Duplica un lote de transacciones a una fecha dada, dejando las originales
   * intactas. Sirve para no recargar a mano las cuentas fijas cada mes. Solo se
   * copian las transacciones que realmente pertenecen a la wallet indicada.
   */
  async bulkCopy(userId: string, dto: BulkCopyTransactionsDto) {
    await this.permissions.checkWalletMembership(userId, dto.walletId);

    const originals = await this.prisma.transaction.findMany({
      where: { id: { in: dto.transactionIds }, walletId: dto.walletId },
    });

    if (originals.length === 0) {
      return { count: 0 };
    }

    const date = new Date(dto.date);
    const result = await this.prisma.transaction.createMany({
      data: originals.map((tx) => ({
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        date,
        walletId: tx.walletId,
        subcategoryId: tx.subcategoryId,
        authorId: userId,
      })),
    });

    return { count: result.count };
  }

  async deleteTransactionById(userId: string, transactionId: string) {
    const transaction = await this.getTransactionById(userId, transactionId);
    await this.permissions.checkWalletMembership(userId, transaction.walletId);
    await this.prisma.transaction.delete({
      where: { id: transactionId },
    });
    return { message: 'Transaction deleted successfully' };
  }
}
