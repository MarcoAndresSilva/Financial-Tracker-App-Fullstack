import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateWalletDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  // Lo que ya tenías ahorrado antes de empezar a usar la app. No puede ser
  // negativo; se usa como punto de partida del saldo acumulado.
  @IsNumber()
  @Min(0)
  @IsOptional()
  saldoInicial?: number;
}
