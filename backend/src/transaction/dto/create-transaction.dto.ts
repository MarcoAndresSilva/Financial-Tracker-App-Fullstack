import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsNumber()
  @IsPositive() // El monto debe ser un número positivo
  @IsNotEmpty()
  amount: number;

  @IsEnum(TransactionType) // Debe ser 'INCOME' o 'EXPENSE'
  @IsNotEmpty()
  type: TransactionType;

  @IsDateString() // Debe ser una fecha válida en formato de texto (ej. "2025-08-27")
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  @IsNotEmpty()
  walletId: string;

  @IsUUID()
  @IsNotEmpty()
  subcategoryId: string;
}
