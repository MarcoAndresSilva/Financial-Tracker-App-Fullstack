import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DebtService } from './debt.service';
import { CreateDebtDto, UpdateDebtDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('debts')
export class DebtController {
  constructor(private debtService: DebtService) {}

  @Post()
  createDebt(@CurrentUser('id') userId: string, @Body() dto: CreateDebtDto) {
    return this.debtService.createDebt(userId, dto);
  }

  @Get()
  getDebtsByWallet(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
  ) {
    return this.debtService.getDebtsByWallet(userId, walletId);
  }

  @Get(':id')
  getDebtById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) debtId: string,
  ) {
    return this.debtService.getDebtById(userId, debtId);
  }

  @Patch(':id')
  updateDebtById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) debtId: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtService.updateDebtById(userId, debtId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteDebtById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) debtId: string,
  ) {
    return this.debtService.deleteDebtById(userId, debtId);
  }
}
