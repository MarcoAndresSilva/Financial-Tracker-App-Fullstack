import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { AuthService } from '../../services/auth.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { finalize, switchMap } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [...MATERIAL_MODULES, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private WalletContext = inject(WalletContextService);
  private router = inject(Router);
  private notification = inject(NotificationService);

  loginForm: FormGroup;
  loginError: string | null = null;
  // Bloquea el botón mientras responde el backend (evita envíos repetidos).
  isSubmitting = false;

  constructor() {
    // Usamos 'new FormControl' para ser explícitos y evitar la ambigüedad.
    this.loginForm = this.fb.group({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(8),
      ]),
    });
  }

  onSubmit() {
    if (this.loginForm.invalid || this.isSubmitting) return;
    this.loginError = null;
    this.isSubmitting = true;

    this.authService
      .login(this.loginForm.value)
      .pipe(
        switchMap(() => this.WalletContext.loadUserWallets()),
        finalize(() => (this.isSubmitting = false))
      )
      .subscribe({
        // Bienvenida con el primer nombre, en un toast que no pide clic.
        next: (user) => {
          const firstName = user.name?.trim().split(/\s+/)[0];
          this.notification.success(
            firstName
              ? `¡Hola, ${firstName}! Qué bueno verte de nuevo.`
              : '¡Hola! Qué bueno verte de nuevo.'
          );
          this.router.navigate(['/dashboard']);
        },
        // El error se muestra dentro del formulario, donde se corrige.
        error: (err) => {
          this.loginError =
            err?.status === 401
              ? 'Email o contraseña incorrectos.'
              : 'No pudimos iniciar sesión. Inténtalo de nuevo en un rato.';
        },
      });
  }
}
