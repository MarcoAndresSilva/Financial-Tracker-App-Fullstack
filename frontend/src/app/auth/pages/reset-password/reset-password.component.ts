import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { passwordMatchValidator } from '../../../shared/utils/password-match.validator';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../login/login.component.scss', '../auth-status.scss'],
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  // El token llega en el link del email (?token=...).
  private token = this.route.snapshot.queryParamMap.get('token');

  // Sin token, o si el backend lo rechaza (vencido / ya usado), la card deja de
  // mostrar el formulario y ofrece pedir un link nuevo.
  linkInvalid = !this.token;
  isSaving = false;

  form: FormGroup = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator('newPassword', 'confirmPassword') }
  );

  onSubmit(): void {
    if (this.form.invalid || this.isSaving || !this.token) return;

    this.isSaving = true;
    this.authService
      .resetPassword(this.token, this.form.value.newPassword)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => {
          // Si en este navegador había una sesión abierta, ese token ya no vale
          // (el backend invalida los anteriores al cambio): se limpia acá.
          this.authService.logout();
          this.notification.success(
            'Tu contraseña se actualizó. Ya puedes iniciar sesión con la nueva.'
          );
          this.router.navigate(['/auth/login']);
        },
        error: (err) => {
          if (err?.status === 400) {
            this.linkInvalid = true;
          } else {
            this.notification.error(
              'No pudimos actualizar la contraseña. Inténtalo de nuevo en un rato.'
            );
          }
        },
      });
  }
}
