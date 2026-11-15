import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { DebtModule } from '../debt/debt.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

@Module({
  // DebtModule: para leer los compromisos de deudas del mes.
  imports: [PrismaModule, PermissionsModule, DebtModule],
  controllers: [BudgetController],
  providers: [BudgetService],
})
export class BudgetModule {}
