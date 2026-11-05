import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './forgot-password.component.html',
  // Misma card que el login/registro, más los mensajes de estado compartidos.
  styleUrls: ['../login/login.component.scss', '../auth-status.scss'],
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isSending = false;
  // Email al que se mandó el link; con valor, la card muestra la confirmación.
  sentTo: string | null = null;

  onSubmit(): void {
    if (this.form.invalid || this.isSending) return;

    const email: string = this.form.value.email.trim();
    this.isSending = true;
    this.authService
      .forgotPassword(email)
      .pipe(finalize(() => (this.isSending = false)))
      .subscribe({
        next: () => (this.sentTo = email),
        error: () =>
          this.notification.error(
            'No pudimos procesar la solicitud. Inténtalo de nuevo en un rato.'
          ),
      });
  }
}
