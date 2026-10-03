import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @IsInt()
  @IsPositive()
  totalInstallments: number;

  @IsDateString() // Fecha del primer pago (real o declarada), ej. "2026-03-01"
  @IsNotEmpty()
  startDate: string;

  // Cuotas y plata ya pagadas ANTES de empezar a trackear esta deuda en
  // FinTrack — para poder cargarla a mitad de camino (ej. "vamos en la
  // cuota 4 de 8") en vez de reconstruir todo el historial previo.
  @IsOptional()
  @IsInt()
  @Min(0)
  initialPaidInstallments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPaidAmount?: number;

  @IsUUID()
  @IsNotEmpty()
  walletId: string;
}
