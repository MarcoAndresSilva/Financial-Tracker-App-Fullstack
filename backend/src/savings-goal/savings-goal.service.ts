import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContributeDto,
  CreateSavingsGoalDto,
  UpdateSavingsGoalDto,
} from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PermissionsService } from '../common/permissions/permissions.service';

@Injectable()
export class SavingsGoalService {
  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) {}

  async createSavingsGoal(userId: string, dto: CreateSavingsGoalDto) {
    await this.permissions.checkWalletMembership(userId, dto.walletId);

    try {
      return await this.prisma.savingsGoal.create({
        data: {
          name: dto.name,
          targetAmount: dto.targetAmount,
          walletId: dto.walletId,
        },
      });
    } catch (error) {
      throw this.mapDuplicateNameError(error);
    }
  }

  async getSavingsGoalsByWallet(userId: string, walletId: string) {
    await this.permissions.checkWalletMembership(userId, walletId);
    return this.prisma.savingsGoal.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSavingsGoalById(
    userId: string,
    goalId: string,
    dto: UpdateSavingsGoalDto,
  ) {
    const goal = await this.getSavingsGoalOrThrow(goalId);
    await this.permissions.checkWalletMembership(userId, goal.walletId);

    try {
      return await this.prisma.savingsGoal.update({
        where: { id: goalId },
        data: { ...dto },
      });
    } catch (error) {
      throw this.mapDuplicateNameError(error);
    }
  }

  // Suma un aporte al monto actual de la meta (nunca se edita currentAmount a mano).
  async contributeToGoal(userId: string, goalId: string, dto: ContributeDto) {
    const goal = await this.getSavingsGoalOrThrow(goalId);
    await this.permissions.checkWalletMembership(userId, goal.walletId);

    return this.prisma.savingsGoal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: dto.amount } },
    });
  }

  async deleteSavingsGoalById(userId: string, goalId: string) {
    const goal = await this.getSavingsGoalOrThrow(goalId);
    await this.permissions.checkWalletMembership(userId, goal.walletId);

    await this.prisma.savingsGoal.delete({ where: { id: goalId } });
    return { message: 'Savings goal deleted successfully' };
  }

  private async getSavingsGoalOrThrow(goalId: string) {
    const goal = await this.prisma.savingsGoal.findUnique({
      where: { id: goalId },
    });
    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }
    return goal;
  }

  private mapDuplicateNameError(error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Ya existe una meta con ese nombre en esta cartera.',
      );
    }
    return error;
  }
}
