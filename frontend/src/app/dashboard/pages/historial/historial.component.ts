import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import {
  DashboardService,
  YearlyBreakdown,
  YearlyMonthRow,
} from '../../../services/dashboard.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { PeriodContextService } from '../../../core/services/period-context.service';
import { Wallet } from '../../../user/types/user.types';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss'],
})
export class HistorialComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private walletContext = inject(WalletContextService);
  private periodContext = inject(PeriodContextService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  readonly monthNames = MONTH_NAMES;
  readonly currentYear = new Date().getFullYear();
  private readonly currentMonth = new Date().getMonth() + 1;

  activeWallet?: Wallet;
  // Arranca en el año del mes activo, para que venir desde el Home de un mes
  // de otro año abra ese año.
  year = this.periodContext.getPeriod().year;
  data?: YearlyBreakdown;
  isLoading = true;

  ngOnInit(): void {
    this.walletContext.activeWallet$
      .pipe(takeUntil(this.destroy$))
      .subscribe((wallet) => {
        if (wallet) {
          this.activeWallet = wallet;
          this.load();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Selector acotado a [primer año con movimientos, año actual].
  get minYear(): number {
    return Math.min(this.data?.firstYear ?? this.currentYear, this.currentYear);
  }

  changeYear(delta: number): void {
    const next = this.year + delta;
    if (next < this.minYear || next > this.currentYear) return;
    this.year = next;
    this.load();
  }

  // Meses que todavía no llegan: se muestran con "—" en vez de $0, que se
  // leería como "no se gastó nada".
  isFuture(row: YearlyMonthRow): boolean {
    return (
      this.year > this.currentYear ||
      (this.year === this.currentYear && row.month > this.currentMonth)
    );
  }

  isActivePeriod(row: YearlyMonthRow): boolean {
    const p = this.periodContext.getPeriod();
    return p.year === this.year && p.month === row.month;
  }

  get totals() {
    const months = this.data?.months ?? [];
    const income = months.reduce((sum, m) => sum + m.income, 0);
    const expense = months.reduce((sum, m) => sum + m.expense, 0);
    return { income, expense, ahorro: income - expense };
  }

  openMonth(row: YearlyMonthRow): void {
    if (this.isFuture(row)) return;
    this.periodContext.setPeriod(this.year, row.month);
    this.router.navigate(['/dashboard/home']);
  }

  private load(): void {
    if (!this.activeWallet) return;
    this.isLoading = true;
    this.dashboardService
      .getYearlyBreakdown(this.activeWallet.id, this.year)
      .subscribe({
        next: (data) => {
          this.data = data;
          this.isLoading = false;
          // Si el año pedido quedó antes del primer movimiento de esta wallet
          // (p. ej. al cambiar a una wallet más nueva), saltamos al primero.
          if (data.firstYear && this.year < data.firstYear) {
            this.year = data.firstYear;
            this.load();
          }
        },
        error: () => (this.isLoading = false),
      });
  }
}
