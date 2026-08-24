import { Module } from '@nestjs/common';
import { SavingsGoalController } from './savings-goal.controller';
import { SavingsGoalService } from './savings-goal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../common/permissions/permissions.module';

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [SavingsGoalController],
  providers: [SavingsGoalService],
})
export class SavingsGoalModule {}
