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
import { NotificationService } from '../../../core/services/notification.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [...MATERIAL_MODULES, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notification = inject(NotificationService);

  registerForm: FormGroup;
  // Bloquea el botón mientras responde el backend (evita crear la cuenta dos veces).
  isSubmitting = false;

  constructor() {
    this.registerForm = this.fb.group({
      name: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(8),
      ]),
    });
  }

  onSubmit() {
    if (this.registerForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    this.authService
      .signup(this.registerForm.value)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.notification.success(
            'Tu cuenta fue creada con éxito. Ya puedes iniciar sesión.'
          );
          this.router.navigate(['/auth/login']);
        },
        error: (err) => {
          const message = err?.error?.message ?? 'No se pudo crear la cuenta.';
          this.notification.error(message);
        },
      });
  }
}
