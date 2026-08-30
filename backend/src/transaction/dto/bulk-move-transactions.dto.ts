import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class BulkMoveTransactionsDto {
  @IsUUID()
  @IsNotEmpty()
  walletId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  transactionIds: string[];

  // Nueva fecha (YYYY-MM-DD) para todas las transacciones seleccionadas.
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
