import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, combineLatest, filter, takeUntil } from 'rxjs';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { MonthSelectorComponent } from '../../../shared/components/month-selector/month-selector.component';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import {
  Period,
  PeriodContextService,
} from '../../../core/services/period-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  BudgetLine,
  BudgetPlan,
  BudgetService,
  BudgetStatus,
} from '../../../budget/services/budget.service';
import {
  BudgetEntryDialogComponent,
  BudgetEntryDialogData,
  BudgetEntryDialogResult,
} from '../../../shared/components/budget-entry-dialog/budget-entry-dialog.component';
import { formatShortDay } from '../../../shared/utils/date.util';

/** Orden de las barras: primero lo que necesita atención. */
const STATUS_ORDER: Record<BudgetStatus, number> = { OVER: 0, WARNING: 1, OK: 2 };

/**
 * Presupuesto del mes (Paso 82): planificar y seguir en la misma pantalla.
 * Sigue el mes del navegador de meses y la wallet activa, como el Home. Todo
 * lo calculado (montos que aplican, colores, compromisos, sin asignar) viene
 * del backend: acá solo se ordena y se le da formato.
 */
@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, RouterModule, MonthSelectorComponent, ...MATERIAL_MODULES],
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.scss'],
})
export class BudgetComponent implements OnInit, OnDestroy {
  private budgetService = inject(BudgetService);
  private walletContext = inject(WalletContextService);
  private periodContext = inject(PeriodContextService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  readonly formatShortDay = formatShortDay;

  plan: BudgetPlan | null = null;
  isLoading = true;
  private walletId: string | null = null;
  private period: Period | null = null;

  ngOnInit(): void {
    combineLatest([this.walletContext.activeWallet$, this.periodContext.activePeriod$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([wallet, period]) => {
        if (!wallet) return;
        this.walletId = wallet.id;
        this.period = period;
        this.loadPlan();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlan(): void {
    if (!this.walletId || !this.period) return;
    this.isLoading = true;
    const { year, month } = this.period;
    this.budgetService.getPlan(this.walletId, year, month).subscribe({
      next: (plan) => {
        this.plan = plan;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.notification.error('No pudimos cargar el presupuesto.');
      },
    });
  }

  // --- Datos para la vista ----------------------------------------------

  /** Categorías con presupuesto: lo que se pasó primero, después lo que va cerca. */
  get budgeted(): BudgetLine[] {
    return (this.plan?.categories ?? [])
      .filter((c) => c.budget !== null)
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status!.status] - STATUS_ORDER[b.status!.status] ||
          a.name.localeCompare(b.name),
      );
  }

  get unbudgeted(): BudgetLine[] {
    return (this.plan?.categories ?? []).filter((c) => c.budget === null);
  }

  /** "diciembre" (para los textos del diálogo). */
  get monthName(): string {
    if (!this.period) return '';
    const iso = `${this.period.year}-${String(this.period.month).padStart(2, '0')}-01`;
    return formatDate(iso, 'MMMM', 'es-CL', 'UTC');
  }

  statusLabel(line: BudgetLine): string {
    switch (line.status!.status) {
      case 'OVER':
        return 'Te pasaste';
      case 'WARNING':
        return 'Cerca del tope';
      default:
        return 'Vas bien';
    }
  }

  statusIcon(status: BudgetStatus): string {
    return { OK: 'check_circle', WARNING: 'warning', OVER: 'error' }[status];
  }

  /** Ancho de la barra: tope en 100% (pasarse se dice con texto y color). */
  barWidth(line: BudgetLine): number {
    const pct = line.status?.percentage;
    return pct === null || pct === undefined ? 100 : Math.min(100, pct);
  }

  // --- Acciones ------------------------------------------------------------

  editBudget(line: BudgetLine): void {
    if (!this.period) return;
    const period = this.period;
    this.dialog
      .open<BudgetEntryDialogComponent, BudgetEntryDialogData, BudgetEntryDialogResult>(
        BudgetEntryDialogComponent,
        {
          width: '440px',
          maxWidth: '95vw',
          data: {
            categoryName: line.name,
            monthName: this.monthName,
            currentAmount: line.budget,
            isMonthAdjustment: line.source === 'MONTH_ADJUSTMENT',
          },
        },
      )
      .afterClosed()
      .pipe(filter((r): r is BudgetEntryDialogResult => !!r))
      .subscribe(({ amount, scope }) => {
        this.budgetService
          .upsertEntry({
            categoryId: line.categoryId,
            year: period.year,
            month: period.month,
            scope,
            amount,
          })
          .subscribe({
            next: () => {
              this.notification.success(
                amount === null
                  ? `Quitaste el presupuesto de ${line.name}.`
                  : `Presupuesto de ${line.name} guardado.`,
              );
              this.loadPlan();
            },
            error: () => this.notification.error('No pudimos guardar el presupuesto.'),
          });
      });
  }
}
