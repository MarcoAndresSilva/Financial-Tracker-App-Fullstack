import { AmountUnit } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

/**
 * Todo opcional, pero lo que venga se valida. Se escribe aparte (y no con
 * PartialType del de creación) porque allá las validaciones dependen de `kind`,
 * que acá no viene: con PartialType se saltarían todas.
 *
 * El tipo no se puede cambiar: una deuda en cuotas y una de monto libre se
 * describen con datos distintos. Para cambiarlo, se borra y se crea de nuevo.
 */
export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalInstallments?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  installmentValue?: number;

  @IsOptional()
  @IsEnum(AmountUnit)
  unit?: AmountUnit;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialPaidInstallments?: number;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  totalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPaidAmount?: number;
}
