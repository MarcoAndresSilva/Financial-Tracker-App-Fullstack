import { IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateSavingsGoalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsPositive()
  targetAmount: number;

  @IsUUID()
  @IsNotEmpty()
  walletId: string;
}
