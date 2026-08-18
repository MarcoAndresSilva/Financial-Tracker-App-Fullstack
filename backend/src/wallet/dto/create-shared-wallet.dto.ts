import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSharedWalletDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  inviteEmail: string;

  // Si viene, se copian (nombre y estructura, sin transacciones) las
  // categorías/subcategorías de esta wallet a la nueva wallet compartida.
  @IsUUID()
  @IsOptional()
  copyCategoriesFromWalletId?: string;
}
