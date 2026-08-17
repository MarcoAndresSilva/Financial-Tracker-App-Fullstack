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
import { switchMap } from 'rxjs';

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
    if (this.loginForm.invalid) return;

    this.authService
      .login(this.loginForm.value)
      .pipe(switchMap(() => this.WalletContext.loadUserWallets()))
      .subscribe({
        next: () => {
          this.notification
            .success('Sesión iniciada correctamente.', '¡Bienvenido!')
            .afterClosed()
            .subscribe(() => this.router.navigate(['/dashboard']));
        },
        error: (err) => {
          const message =
            err?.error?.message ?? 'No se pudo iniciar sesión.';
          this.notification.error(message, 'Credenciales incorrectas');
        },
      });
  }
}
