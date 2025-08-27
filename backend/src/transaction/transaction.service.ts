import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto';
import { MembershipRole } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  // el usuario pertenece a la cartera donde quiere crear la transaccion
  async createTransaction(userId: string, dto: CreateTransactionDto) {
    await this.checkWalletMembership(userId, dto.walletId);

    // verificar que la subcategoria pertenezca a la cartera
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: dto.subcategoryId },
      include: { category: true },
    });

    if (!subcategory || subcategory.category.walletId !== dto.walletId) {
      throw new ForbiddenException('Subcategory does not belong to the wallet');
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

  // --- READ ALL BY WALLET ---
  async getTransactionsByWallet(userId: string, walletId: string) {
    //El usuario es miembro de esta cartera?
    await this.checkWalletMembership(userId, walletId);

    return this.prisma.transaction.findMany({
      where: { walletId },
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

    // Permiso: ¿El usuario es miembro de la cartera a la que pertenece esta transacción?
    await this.checkWalletMembership(userId, transaction.walletId);

    return transaction;
  }

  // --- UPDATE ---
  async updateTransactionById(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    // 1. Obtener la transacción para saber a qué cartera pertenece
    const transaction = await this.getTransactionById(userId, transactionId);

    // 2. Permiso: ¿El usuario es OWNER de la cartera? (O el autor de la transacción)
    //    Por ahora, simplifiquemos: solo los OWNERS pueden editar.
    await this.checkWalletMembership(userId, transaction.walletId, true);

    // (Opcional) Si se cambia la subcategoría, verificar que la nueva pertenezca a la misma cartera
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
        ...(dto.date && { date: new Date(dto.date) }), // Si se actualiza la fecha, convertirla
      },
    });
  }

  // --- DELETE ---
  async deleteTransactionById(userId: string, transactionId: string) {
    const transaction = await this.getTransactionById(userId, transactionId);

    // Permiso: Solo los OWNERS pueden borrar transacciones.
    await this.checkWalletMembership(userId, transaction.walletId, true);

    await this.prisma.transaction.delete({
      where: { id: transactionId },
    });

    return { message: 'Transaction deleted successfully' };
  }

  // --- Función Auxiliar de Permisos ---
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
