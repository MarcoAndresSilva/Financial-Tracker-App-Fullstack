import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BudgetService } from './budget.service';
import { UpsertBudgetEntryDto } from './dto/upsert-budget-entry.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('budget')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  /** GET /budget?walletId=…&year=2026&month=12 → el plan del mes. */
  @Get()
  getPlan(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      throw new BadRequestException('year/month fuera de rango');
    }
    return this.budgetService.getPlan(userId, walletId, { year, month });
  }

  /** PUT /budget/entries → guarda o quita el presupuesto de una categoría. */
  @Put('entries')
  upsertEntry(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertBudgetEntryDto,
  ) {
    return this.budgetService.upsertEntry(userId, dto);
  }
}
