import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Rutas de Autenticación (públicas)
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  // Rutas del Dashboard (protegidas)
  {
    path: 'dashboard',
    canActivate: [authGuard], // ¡Aplica el guardián aquí!
    loadChildren: () =>
      import('./dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  // Redirección por defecto
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
