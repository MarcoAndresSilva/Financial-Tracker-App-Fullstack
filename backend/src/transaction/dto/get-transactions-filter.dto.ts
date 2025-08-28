import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class GetTransactionsFilterDto {
  @IsUUID()
  walletId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}
