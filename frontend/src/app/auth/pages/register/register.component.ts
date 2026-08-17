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
    if (this.registerForm.invalid) return;

    this.authService.signup(this.registerForm.value).subscribe({
      next: () => {
        this.notification
          .success('Tu cuenta fue creada con éxito. Ya podés iniciar sesión.', 'Cuenta creada')
          .afterClosed()
          .subscribe(() => this.router.navigate(['/auth/login']));
      },
      error: (err) => {
        const message = err?.error?.message ?? 'No se pudo crear la cuenta.';
        this.notification.error(message);
      },
    });
  }
}
