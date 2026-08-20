import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  DashboardService,
  ExpenseByCategory,
  MonthlySummary,
  WalletSummary,
} from '../../../services/dashboard.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { Wallet } from '../../../user/types/user.types';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import {
  CategoryBar,
  CategoryBarsComponent,
} from '../../../shared/components/category-bars/category-bars.component';

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

// Umbral simple para sugerir invertir el saldo histórico ocioso.
const INVESTMENT_TIP_THRESHOLD = 500_000;

// Paleta de estado fija (nunca sigue el tema) — ver dataviz skill.
const STATUS_COLORS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  neutral: '#898781',
} as const;

export interface SpendingMood {
  icon: string;
  color: string;
  message: string;
}

function buildSpendingMood(percentage: number | null): SpendingMood {
  if (percentage === null) {
    return {
      icon: 'sentiment_neutral',
      color: STATUS_COLORS.neutral,
      message: 'Registra tus ingresos del mes para activar esta alerta.',
    };
  }
  if (percentage < 50) {
    return {
      icon: 'sentiment_very_satisfied',
      color: STATUS_COLORS.good,
      message: 'Vas tranquilo, todavía te queda bastante margen este mes.',
    };
  }
  if (percentage < 80) {
    return {
      icon: 'sentiment_satisfied',
      color: STATUS_COLORS.warning,
      message: 'Vas bien, pero empieza a prestar atención al resto del mes.',
    };
  }
  if (percentage <= 100) {
    return {
      icon: 'sentiment_dissatisfied',
      color: STATUS_COLORS.serious,
      message: 'Cuidado, estás cerca de gastar todo lo que entró este mes.',
    };
  }
  return {
    icon: 'sentiment_very_dissatisfied',
    color: STATUS_COLORS.critical,
    message: 'Te pasaste de lo que ganaste este mes.',
  };
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES, CategoryBarsComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private walletContext = inject(WalletContextService);
  private destroy$ = new Subject<void>();

  summary?: WalletSummary;
  monthlySummary?: MonthlySummary;
  monthlyBalance = 0;
  spendingMood?: SpendingMood;
  showInvestmentTip = false;
  expenseCategoryBars: CategoryBar[] = [];
  incomeCategoryBars: CategoryBar[] = [];
  isLoading = true;

  // Ej: "Agosto" — usado en los labels de la sección "Este mes".
  currentMonthLabel = (() => {
    const month = formatDate(new Date(), 'MMMM', 'es-CL');
    return month.charAt(0).toUpperCase() + month.slice(1);
  })();

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
      this.showInvestmentTip = data.balance > INVESTMENT_TIP_THRESHOLD;
    });

    this.dashboardService.getMonthlySummary(Wallet.id).subscribe((data) => {
      this.monthlySummary = data;
      this.monthlyBalance = data.totalIncome - data.totalExpense;
      this.spendingMood = buildSpendingMood(data.percentageSpent);
    });

    this.dashboardService.getExpensesByCategory(Wallet.id).subscribe((data) => {
      this.expenseCategoryBars = this.buildCategoryBars(data);
      this.isLoading = false;
    });

    this.dashboardService.getIncomeByCategory(Wallet.id).subscribe((data) => {
      this.incomeCategoryBars = this.buildCategoryBars(data);
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
