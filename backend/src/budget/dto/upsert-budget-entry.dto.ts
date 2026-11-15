import { BudgetScope } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Guardar (o quitar) el presupuesto de una categoría para un mes.
 * La wallet se deduce de la categoría: no viaja en el body.
 */
export class UpsertBudgetEntryDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  /** FROM_MONTH = "desde este mes en adelante"; ONLY_MONTH = "solo este mes". */
  @IsEnum(BudgetScope)
  scope: BudgetScope;

  /** null = "sin presupuesto" (para quitarlo). 0 es válido: "no gastar nada". */
  @ValidateIf((o: UpsertBudgetEntryDto) => o.amount !== null)
  @IsNumber()
  @Min(0)
  amount: number | null;
}
