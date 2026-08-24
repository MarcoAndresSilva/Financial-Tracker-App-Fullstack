import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verifica que el usuario sea miembro de la cartera (y, si `ownerRequired`
   * es true, que además tenga rol OWNER). Lanza ForbiddenException si no.
   */
  async checkWalletMembership(
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
