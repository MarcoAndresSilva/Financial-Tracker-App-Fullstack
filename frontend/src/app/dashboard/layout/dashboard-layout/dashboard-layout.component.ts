import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, RouterModule, ...MATERIAL_MODULES],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  isSidenavOpened = true;
}
