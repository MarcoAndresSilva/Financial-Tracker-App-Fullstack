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
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { LegendPosition } from '@swimlane/ngx-charts';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES, NgxChartsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private walletContext = inject(WalletContextService);
  private destroy$ = new Subject<void>();

  legendPosition: LegendPosition = LegendPosition.Below;

  summary?: WalletSummary;
  expensesByCategory?: ExpenseByCategory[];
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
      this.expensesByCategory = data;
      this.isLoading = false;
    });
  }
}
