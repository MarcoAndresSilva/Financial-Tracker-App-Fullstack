import { IsNumber, IsPositive } from 'class-validator';

export class ContributeDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
