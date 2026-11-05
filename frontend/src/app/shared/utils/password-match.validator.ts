import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validador de grupo: marca `passwordMismatch` en el control de confirmación
// cuando no coincide con el de la contraseña nueva, para que el mat-error se
// muestre debajo del campo que el usuario tiene que corregir.
export function passwordMatchValidator(
  passwordKey: string,
  confirmKey: string
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey);
    const confirm = group.get(confirmKey);
    if (!password || !confirm) return null;

    // Se conservan los otros errores del control (ej. `required`).
    const errors: ValidationErrors = { ...(confirm.errors ?? {}) };
    delete errors['passwordMismatch'];
    if (confirm.value && password.value !== confirm.value) {
      errors['passwordMismatch'] = true;
    }
    confirm.setErrors(Object.keys(errors).length ? errors : null);
    return null;
  };
}
