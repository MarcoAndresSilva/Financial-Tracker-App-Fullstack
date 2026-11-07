import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestEmailChangeDto {
  @IsNotEmpty()
  @IsEmail()
  newEmail: string;

  // Cambiar el email cambia con qué se entra y adónde llega la recuperación de
  // contraseña: se exige la contraseña actual aunque haya sesión iniciada.
  @IsNotEmpty()
  @IsString()
  currentPassword: string;
}

export class ConfirmEmailChangeDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}
