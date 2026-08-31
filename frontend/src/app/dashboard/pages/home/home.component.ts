import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { TransactionFormComponent } from '../../../transactions/components/transaction-form/transaction-form.component';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { Transaction } from '../../../transactions/services/transaction.types';
import {
  DashboardService,
  ExpenseByCategory,
  MonthlySummary,
  SavingsSummary,
  WalletSummary,
} from '../../../services/dashboard.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import {
  Period,
  PeriodContextService,
} from '../../../core/services/period-context.service';
import { Wallet } from '../../../user/types/user.types';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { MonthSelectorComponent } from '../../../shared/components/month-selector/month-selector.component';
import {
  CategoryBar,
  CategoryBarsComponent,
} from '../../../shared/components/category-bars/category-bars.component';

// NOTA: estos dos arrays (categórico y de estado) son la única excepción a la
// regla "todos los colores viven en src/styles/_tokens.scss" — la skill de
// dataviz manda que las paletas categóricas y de estado NO sigan la marca.
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
  label: string;
  message: string;
}

function buildSpendingMood(percentage: number | null): SpendingMood {
  if (percentage === null) {
    return {
      icon: 'sentiment_neutral',
      color: STATUS_COLORS.neutral,
      label: 'Sin datos',
      message: 'Registra tus ingresos del mes para activar esta alerta.',
    };
  }
  if (percentage < 50) {
    return {
      icon: 'sentiment_very_satisfied',
      color: STATUS_COLORS.good,
      label: 'Vas tranquilo',
      message: 'Vas tranquilo, todavía te queda bastante margen este mes.',
    };
  }
  if (percentage < 80) {
    return {
      icon: 'sentiment_satisfied',
      color: STATUS_COLORS.warning,
      label: 'Atención',
      message: 'Vas bien, pero empieza a prestar atención al resto del mes.',
    };
  }
  if (percentage <= 100) {
    return {
      icon: 'sentiment_dissatisfied',
      color: STATUS_COLORS.serious,
      label: 'Cuidado',
      message: 'Cuidado, estás cerca de gastar todo lo que entró este mes.',
    };
  }
  return {
    icon: 'sentiment_very_dissatisfied',
    color: STATUS_COLORS.critical,
    label: 'Te pasaste',
    message: 'Te pasaste de lo que ganaste este mes.',
  };
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ...MATERIAL_MODULES,
    CategoryBarsComponent,
    MonthSelectorComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private transactionService = inject(TransactionService);
  private walletContext = inject(WalletContextService);
  private periodContext = inject(PeriodContextService);
  private dialog = inject(MatDialog);

  // Vista rápida: los últimos movimientos del mes activo (máx. 5).
  readonly RECENT_LIMIT = 5;
  private destroy$ = new Subject<void>();

  activeWallet: Wallet | null = null;
  activePeriod: Period = this.periodContext.getPeriod();
  summary?: WalletSummary;
  monthlySummary?: MonthlySummary;
  monthlyBalance = 0;
  savings?: SavingsSummary;
  recentTransactions: Transaction[] = [];

  // Lente del bloque "Resumen": el mes en curso o todo el histórico de la wallet.
  // Antes eran dos filas de cards idénticas una debajo de otra — al empezar
  // mostraban los mismos números y se veía repetido.
  summaryView: 'mes' | 'historico' = 'mes';
  spendingMood?: SpendingMood;
  showInvestmentTip = false;
  expenseCategoryBars: CategoryBar[] = [];
  incomeCategoryBars: CategoryBar[] = [];
  isLoading = true;

  // Ej: "Agosto" — nombre del mes del período activo (no siempre el mes en curso).
  get periodLabel(): string {
    const d = new Date(this.activePeriod.year, this.activePeriod.month - 1, 1);
    const month = formatDate(d, 'MMMM', 'es-CL');
    return month.charAt(0).toUpperCase() + month.slice(1);
  }

  // Arco del anillo de gasto: el % real puede pasar de 100, pero el arco se llena al tope.
  get moodRingPct(): number {
    const p = this.monthlySummary?.percentageSpent ?? 0;
    return Math.max(0, Math.min(p, 100));
  }

  get isOverspent(): boolean {
    return (this.monthlySummary?.percentageSpent ?? 0) > 100;
  }

  get summaryCaption(): string {
    return this.summaryView === 'mes'
      ? `Movimiento de ${this.periodLabel} ${this.activePeriod.year}`
      : 'Desde que empezaste a usar esta cartera';
  }

  // La terna Ingresos/Gastos/Balance según el lente activo. `null` mientras
  // la llamada correspondiente todavía no responde.
  get activeSummary(): { income: number; expense: number; balance: number } | null {
    if (this.summaryView === 'mes') {
      return this.monthlySummary
        ? {
            income: this.monthlySummary.totalIncome,
            expense: this.monthlySummary.totalExpense,
            balance: this.monthlyBalance,
          }
        : null;
    }
    return this.summary
      ? {
          income: this.summary.totalIncome,
          expense: this.summary.totalExpense,
          balance: this.summary.balance,
        }
      : null;
  }

  ngOnInit(): void {
    combineLatest([
      this.walletContext.activeWallet$,
      this.periodContext.activePeriod$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([activeWallet, period]) => {
        this.activeWallet = activeWallet;
        this.activePeriod = period;
        if (activeWallet) {
          this.loadDashboardData(activeWallet, period);
        }
      });
  }

  // Alta rápida de transacción sin salir del Home: mismo diálogo que usa
  // TransactionListComponent. Al cerrarse con éxito se recargan los agregados
  // del dashboard (resumen del mes, carita, barras) para reflejar el movimiento.
  openTransactionForm(): void {
    if (!this.activeWallet) return;
    const dialogRef = this.dialog.open(TransactionFormComponent, {
      width: '500px',
      data: { walletId: this.activeWallet.id },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.activeWallet) {
        this.loadDashboardData(this.activeWallet, this.activePeriod);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardData(wallet: Wallet, period: Period): void {
    this.isLoading = true;

    // El "Histórico" (resumen general + tip de inversión) no depende del mes.
    this.dashboardService.getWalletSummary(wallet.id).subscribe((data) => {
      this.summary = data;
      this.showInvestmentTip = data.balance > INVESTMENT_TIP_THRESHOLD;
    });

    // Todo lo demás se acota al mes del período activo.
    this.dashboardService
      .getMonthlySummary(wallet.id, period)
      .subscribe((data) => {
        this.monthlySummary = data;
        this.monthlyBalance = data.totalIncome - data.totalExpense;
        this.spendingMood = buildSpendingMood(data.percentageSpent);
      });

    this.dashboardService
      .getSavings(wallet.id, period)
      .subscribe((data) => (this.savings = data));

    this.dashboardService
      .getExpensesByCategory(wallet.id, period)
      .subscribe((data) => {
        this.expenseCategoryBars = this.buildCategoryBars(data);
        this.isLoading = false;
      });

    this.dashboardService
      .getIncomeByCategory(wallet.id, period)
      .subscribe((data) => {
        this.incomeCategoryBars = this.buildCategoryBars(data);
      });

    // Vista rápida de últimos movimientos del mes activo.
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(period.year, period.month, 0).getDate();
    this.transactionService
      .getTransactions({
        walletId: wallet.id,
        startDate: `${period.year}-${pad(period.month)}-01`,
        endDate: `${period.year}-${pad(period.month)}-${pad(lastDay)}`,
        limit: this.RECENT_LIMIT,
      })
      .subscribe(
        (data) =>
          (this.recentTransactions = data.slice(0, this.RECENT_LIMIT)),
      );
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
