import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  // Si alguien va a /auth sin especificar, lo redirigimos a /auth/login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
