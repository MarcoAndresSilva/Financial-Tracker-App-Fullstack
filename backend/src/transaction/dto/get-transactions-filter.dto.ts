import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsUUID,
} from 'class-validator';
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

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  // Máximo de transacciones a devolver (para la vista rápida del Home).
  // Llega como string en el query; el servicio lo convierte y clampea.
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
