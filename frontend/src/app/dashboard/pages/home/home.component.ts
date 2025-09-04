import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DashboardService,
  ExpenseByCategory,
  WalletSummary,
} from '../../../services/dashboard.service';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { LegendPosition } from '@swimlane/ngx-charts';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES, NgxChartsModule], // usameos CommonModule para poder usar las directivas *ngIf y *ngFor , etc
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  // Usaremos un walletId hardcodeado por ahora. ¡Esto lo haremos dinámico más tarde!
  // TODO: Obtener el walletId del usuario logueado.
  private tempWalletId = '6c2c74ed-a407-4238-b176-c30648c279df'; // <-- ¡REEMPLAZA ESTO!

  legendPosition: LegendPosition = LegendPosition.Below;

  summary?: WalletSummary;
  expensesByCategory?: ExpenseByCategory[];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData() {
    if (!this.tempWalletId) return;

    //cargar el resumen
    this.dashboardService
      .getWalletSummary(this.tempWalletId)
      .subscribe((data) => {
        this.summary = data;
      });

    // cargar los datos por categoria
    this.dashboardService
      .getExpensesByCategory(this.tempWalletId)
      .subscribe((data) => {
        this.expensesByCategory = data;
        console.log('Gastos por categoría:', this.expensesByCategory);
      });
  }
}
