import { Module } from '@nestjs/common';
import { DebtController } from './debt.controller';
import { DebtService } from './debt.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../common/permissions/permissions.module';
import { IndicatorsModule } from '../common/indicators/indicators.module';

@Module({
  imports: [PrismaModule, PermissionsModule, IndicatorsModule],
  controllers: [DebtController],
  providers: [DebtService],
})
export class DebtModule {}
