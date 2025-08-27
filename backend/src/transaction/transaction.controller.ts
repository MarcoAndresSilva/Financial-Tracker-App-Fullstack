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
import { TransactionService } from './transaction.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Post()
  // --- CREATE ---
  createTransaction(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionService.createTransaction(userId, dto);
  }

  // --- READ ALL BY WALLET ---
  @Get()
  getTransactionsByWallet(
    @CurrentUser('id') userId: string,
    @Query('walletId', ParseUUIDPipe) walletId: string,
  ) {
    return this.transactionService.getTransactionsByWallet(userId, walletId);
  }

  // --- READ ONE BY ID ---
  @Get(':id')
  getTransactionById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ) {
    return this.transactionService.getTransactionById(userId, transactionId);
  }

  // --- UPDATE ---
  @Patch(':id')
  updateTransactionById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionService.updateTransactionById(
      userId,
      transactionId,
      dto,
    );
  }

  // --- DELETE ---
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteTransactionById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ) {
    return this.transactionService.deleteTransactionById(userId, transactionId);
  }
}
