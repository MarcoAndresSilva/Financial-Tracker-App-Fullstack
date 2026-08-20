import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSharedWalletDto } from './dto';
import { MembershipRole, WalletType } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  // Wallets del usuario con su rol y cantidad de transacciones — usado por
  // la UI para decidir quién puede borrar cada wallet y con qué advertencia.
  async getMyWallets(userId: string) {
    const memberships = await this.prisma.walletMembership.findMany({
      where: { userId },
      include: {
        wallet: {
          include: {
            _count: { select: { transactions: true } },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.wallet.id,
      name: membership.wallet.name,
      type: membership.wallet.type,
      role: membership.role,
      transactionCount: membership.wallet._count.transactions,
    }));
  }

  /**
   * Elimina una wallet (y en cascada sus categorías, subcategorías,
   * transacciones y metas de ahorro). Solo el OWNER puede hacerlo, y no se
   * puede eliminar la única wallet que le queda al usuario.
   */
  async deleteWallet(userId: string, walletId: string) {
    const membership = await this.prisma.walletMembership.findUnique({
      where: { userId_walletId: { userId, walletId } },
    });

    if (!membership) {
      throw new ForbiddenException('No perteneces a esta wallet.');
    }

    if (membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'Solo quien creó la wallet puede eliminarla.',
      );
    }

    const walletCount = await this.prisma.walletMembership.count({
      where: { userId },
    });

    if (walletCount <= 1) {
      throw new ConflictException(
        'No puedes eliminar tu única wallet.',
      );
    }

    await this.prisma.wallet.delete({ where: { id: walletId } });

    return { message: 'Wallet deleted successfully' };
  }

  /**
   * Crea una wallet compartida y agrega de una a quien la crea (OWNER) y a
   * la persona invitada por email (MEMBER) — sin flujo de invitación
   * pendiente/aceptar, para mantenerlo simple entre dos personas de confianza.
   * Opcionalmente copia la estructura de categorías/subcategorías (sin
   * transacciones) de otra wallet del usuario, para no recrearlas a mano.
   */
  async createSharedWallet(userId: string, dto: CreateSharedWalletDto) {
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.inviteEmail },
    });

    if (!invitedUser) {
      throw new NotFoundException(
        'Ese email todavía no tiene una cuenta. Pídele que se registre primero.',
      );
    }

    if (invitedUser.id === userId) {
      throw new ConflictException('No puedes invitarte a ti mismo.');
    }

    const categoriesToCopy = dto.copyCategoriesFromWalletId
      ? await this.getCategoryStructure(
          userId,
          dto.copyCategoriesFromWalletId,
        )
      : [];

    return this.prisma.wallet.create({
      data: {
        name: dto.name,
        type: WalletType.SHARED,
        memberships: {
          create: [
            { userId, role: MembershipRole.OWNER },
            { userId: invitedUser.id, role: MembershipRole.MEMBER },
          ],
        },
        categories: {
          create: categoriesToCopy.map((category) => ({
            name: category.name,
            subcategories: {
              create: category.subcategories.map((sub) => ({
                name: sub.name,
              })),
            },
          })),
        },
      },
    });
  }

  // Trae nombre + subcategorías de las categorías de una wallet, verificando
  // que el usuario sea miembro de ella (no se puede copiar de una wallet ajena).
  private async getCategoryStructure(userId: string, walletId: string) {
    const membership = await this.prisma.walletMembership.findUnique({
      where: { userId_walletId: { userId, walletId } },
    });

    if (!membership) {
      throw new ForbiddenException(
        'No puedes copiar categorías de una wallet a la que no perteneces.',
      );
    }

    return this.prisma.category.findMany({
      where: { walletId },
      include: { subcategories: true },
    });
  }
}
