// backend/src/transaction/transaction.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTransactionDto,
  GetTransactionsFilterDto,
  UpdateTransactionDto,
} from './dto';
import { MembershipRole, Prisma } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    await this.checkWalletMembership(userId, dto.walletId);
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
    const { walletId, startDate, endDate, type } = filterDto;
    await this.checkWalletMembership(userId, walletId);
    const whereClause: Prisma.TransactionWhereInput = {
      walletId,
    };
    if (type) {
      whereClause.type = type;
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
      orderBy: { date: 'desc' },
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
    await this.checkWalletMembership(userId, transaction.walletId);
    return transaction;
  }

  async updateTransactionById(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    const transaction = await this.getTransactionById(userId, transactionId);
    await this.checkWalletMembership(userId, transaction.walletId, true);
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

  async deleteTransactionById(userId: string, transactionId: string) {
    const transaction = await this.getTransactionById(userId, transactionId);
    await this.checkWalletMembership(userId, transaction.walletId, true);
    await this.prisma.transaction.delete({
      where: { id: transactionId },
    });
    return { message: 'Transaction deleted successfully' };
  }

  private async checkWalletMembership(
    userId: string,
    walletId: string,
    ownerRequired = false,
  ) {
    const membership = await this.prisma.walletMembership.findUnique({
      where: { userId_walletId: { userId, walletId } },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this wallet');
    }
    if (ownerRequired && membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'You must be an owner to perform this action',
      );
    }
  }
}
