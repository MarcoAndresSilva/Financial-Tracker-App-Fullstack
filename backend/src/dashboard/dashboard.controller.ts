// backend/src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
// import { User } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getWalletSummary(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
  ) {
    return this.dashboardService.getWalletSummary(userId, walletId);
  }

  @Get('expenses-by-category')
  getExpensesByCategory(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
  ) {
    return this.dashboardService.getExpensesByCategory(userId, walletId);
  }

  //   @Get('cashflow-over-time')
  //   getCashflowOverTime(
  //     @CurrentUser('id') userId: string,
  //     @Query('walletId', ParseUUIDPipe) walletId: string,
  //     @Query('period') period: string, // 'monthly' or 'quarterly'
  //     @Query('year', ParseIntPipe) year: number, // Agregaremos validación más adelante
  //   ) {
  //     return this.dashboardService.getCashflowOverTime(
  //       userId,
  //       walletId,
  //       period,
  //       year,
  //     );
  //   }
}
