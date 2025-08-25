// backend/src/category/dto/create-category.dto.ts
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsNotEmpty()
  walletId: string;
}
