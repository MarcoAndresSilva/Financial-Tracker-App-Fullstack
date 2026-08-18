import { Module } from '@nestjs/common';
import { SavingsGoalController } from './savings-goal.controller';
import { SavingsGoalService } from './savings-goal.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SavingsGoalController],
  providers: [SavingsGoalService],
})
export class SavingsGoalModule {}
