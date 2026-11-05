import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  // Destino del link del email: /auth/reset-password?token=...
  { path: 'reset-password', component: ResetPasswordComponent },
  // Si alguien va a /auth sin especificar, lo redirigimos a /auth/login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
