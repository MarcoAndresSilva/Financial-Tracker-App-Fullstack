import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
import { HomeComponent } from './pages/home/home.component';

export const DASHBOARD_ROUTES: Routes = [
  {
    // La ruta raíz de esta sección (/dashboard) carga nuestro layout
    path: '',
    component: DashboardLayoutComponent,
    // Las siguientes rutas son "hijas" y se renderizarán dentro del <router-outlet> del layout
    children: [
      { path: 'home', component: HomeComponent },
      // { path: 'transactions', component: ... } // Aquí añadiremos más páginas

      // Si el usuario va a /dashboard, lo redirigimos a /dashboard/home
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
