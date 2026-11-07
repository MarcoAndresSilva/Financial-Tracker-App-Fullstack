import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  // Se recorta antes de validar: "   " no debe pasar como nombre.
  // (UserService recorta de nuevo al guardar; ver comentario ahí.)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}
