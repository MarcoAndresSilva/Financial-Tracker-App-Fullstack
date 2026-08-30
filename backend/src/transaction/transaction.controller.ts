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
import {
  BulkCopyTransactionsDto,
  BulkMoveTransactionsDto,
  CreateTransactionDto,
  UpdateTransactionDto,
  GetTransactionsFilterDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
// import { filter } from 'rxjs';

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
    @Query() filterDto: GetTransactionsFilterDto,
  ) {
    return this.transactionService.getTransactionsByWallet(userId, filterDto);
  }

  // --- MOVER LOTE (reasignar fecha) ---
  // Antes de `:id` para que la ruta literal gane sobre el parámetro.
  @Patch('bulk-move')
  bulkMove(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkMoveTransactionsDto,
  ) {
    return this.transactionService.bulkMove(userId, dto);
  }

  // --- COPIAR LOTE a otra fecha (deja las originales) ---
  @Post('bulk-copy')
  bulkCopy(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkCopyTransactionsDto,
  ) {
    return this.transactionService.bulkCopy(userId, dto);
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
