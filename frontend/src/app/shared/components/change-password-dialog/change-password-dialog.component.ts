import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { MATERIAL_MODULES } from '../../material/material.module';
import { AuthService } from '../../../auth/services/auth.service';
import { passwordMatchValidator } from '../../utils/password-match.validator';

// A diferencia de los otros diálogos de formulario (que devuelven los datos y
// el que los abre hace la llamada), este llama a la API él mismo: si la
// contraseña actual está mal, el error se muestra acá sin cerrar el diálogo ni
// perder lo escrito. Cierra con `true` solo cuando el cambio se guardó.
@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    ...MATERIAL_MODULES,
  ],
  templateUrl: './change-password-dialog.component.html',
  styleUrls: ['./change-password-dialog.component.scss'],
})
export class ChangePasswordDialogComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

  isSaving = false;
  errorMessage: string | null = null;

  form: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('newPassword', 'confirmPassword') }
  );

  onSave(): void {
    if (this.form.invalid || this.isSaving) return;

    const { currentPassword, newPassword } = this.form.value;
    this.isSaving = true;
    this.errorMessage = null;
    this.authService
      .changePassword(currentPassword, newPassword)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => {
          // El backend responde 400 con un mensaje distinto para cada caso.
          const backendMessage: string = err?.error?.message ?? '';
          if (backendMessage.includes('Current password')) {
            this.errorMessage = 'La contraseña actual no es correcta.';
          } else if (backendMessage.includes('different')) {
            this.errorMessage =
              'La contraseña nueva tiene que ser distinta a la actual.';
          } else {
            this.errorMessage =
              'No pudimos cambiar la contraseña. Inténtalo de nuevo.';
          }
        },
      });
  }
}
