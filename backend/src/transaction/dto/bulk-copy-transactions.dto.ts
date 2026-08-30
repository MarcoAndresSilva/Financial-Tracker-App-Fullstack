import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class BulkCopyTransactionsDto {
  @IsUUID()
  @IsNotEmpty()
  walletId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  transactionIds: string[];

  // Fecha (YYYY-MM-DD) que llevarán todas las copias. Las originales no se tocan.
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
