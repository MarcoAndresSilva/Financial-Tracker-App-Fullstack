import { AmountUnit, DebtKind } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

const isInstallments = (o: CreateDebtDto) => o.kind === DebtKind.INSTALLMENTS;
const isFreeAmount = (o: CreateDebtDto) => o.kind === DebtKind.FREE_AMOUNT;

/**
 * Los campos obligatorios dependen del tipo: una deuda en cuotas se describe
 * como la informa el banco ("dividendo 42 de 300, UF 8,44, vence el 1 de
 * diciembre"); una de monto libre, solo con su total.
 */
export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(DebtKind)
  kind: DebtKind;

  @IsUUID()
  @IsNotEmpty()
  walletId: string;

  // --- En cuotas ---
  @ValidateIf(isInstallments)
  @IsInt()
  @Min(1)
  totalInstallments?: number;

  @ValidateIf(isInstallments)
  @IsNumber()
  @IsPositive()
  installmentValue?: number;

  @ValidateIf(isInstallments)
  @IsEnum(AmountUnit)
  unit?: AmountUnit;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialPaidInstallments?: number;

  /** Vencimiento de la próxima cuota a pagar, ej. "2026-12-01". */
  @ValidateIf(isInstallments)
  @IsDateString()
  nextDueDate?: string;

  // --- Monto libre ---
  @ValidateIf(isFreeAmount)
  @IsNumber()
  @IsPositive()
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPaidAmount?: number;
}
