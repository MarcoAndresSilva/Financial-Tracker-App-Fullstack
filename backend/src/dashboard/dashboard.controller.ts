// backend/src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
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
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  ) {
    return this.dashboardService.getExpensesByCategory(
      userId,
      walletId,
      year,
      month,
    );
  }

  @Get('income-by-category')
  getIncomeByCategory(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  ) {
    return this.dashboardService.getIncomeByCategory(
      userId,
      walletId,
      year,
      month,
    );
  }

  @Get('monthly-summary')
  getMonthlySummary(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  ) {
    return this.dashboardService.getMonthlySummary(
      userId,
      walletId,
      year,
      month,
    );
  }

  @Get('savings')
  getSavings(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  ) {
    return this.dashboardService.getSavings(userId, walletId, year, month);
  }

  @Get('yearly-breakdown')
  getYearlyBreakdown(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.dashboardService.getYearlyBreakdown(userId, walletId, year);
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
