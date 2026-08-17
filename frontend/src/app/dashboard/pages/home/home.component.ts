import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  DashboardService,
  ExpenseByCategory,
  WalletSummary,
} from '../../../services/dashboard.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { Wallet } from '../../../user/types/user.types';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';

// Paleta categórica validada (8 tonos, orden fijo, CVD-safe) — ver dataviz skill.
const CATEGORY_COLORS = [
  '#2a78d6', // azul
  '#eb6834', // naranjo
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
];
const MAX_CATEGORY_SLOTS = 8;

export interface CategoryBar {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private walletContext = inject(WalletContextService);
  private destroy$ = new Subject<void>();

  summary?: WalletSummary;
  categoryBars: CategoryBar[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.walletContext.activeWallet$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeWallet) => {
        if (activeWallet) {
          this.loadDashboardData(activeWallet);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData(Wallet: Wallet): void {
    this.isLoading = true;

    this.dashboardService.getWalletSummary(Wallet.id).subscribe((data) => {
      this.summary = data;
    });

    this.dashboardService.getExpensesByCategory(Wallet.id).subscribe((data) => {
      this.categoryBars = this.buildCategoryBars(data);
      this.isLoading = false;
    });
  }

  private buildCategoryBars(data: ExpenseByCategory[]): CategoryBar[] {
    const sorted = [...data].sort((a, b) => b.value - a.value);

    // Más de 8 categorías: se pliegan en "Otros" en vez de generar más colores.
    const visible = sorted.slice(0, MAX_CATEGORY_SLOTS);
    const rest = sorted.slice(MAX_CATEGORY_SLOTS);
    if (rest.length > 0) {
      visible.push({
        name: 'Otros',
        value: rest.reduce((sum, item) => sum + item.value, 0),
      });
    }

    const total = visible.reduce((sum, item) => sum + item.value, 0);

    return visible.map((item, index) => ({
      name: item.name,
      value: item.value,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
  }
}
