import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Subject, filter, takeUntil } from 'rxjs';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import {
  SavingsGoal,
  SavingsGoalService,
} from '../../../savings-goals/services/savings-goal.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Wallet } from '../../../user/types/user.types';
import {
  SavingsGoalFormDialogComponent,
  SavingsGoalFormDialogData,
} from '../../../shared/components/savings-goal-form-dialog/savings-goal-form-dialog.component';
import { ContributeDialogComponent } from '../../../shared/components/contribute-dialog/contribute-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

interface SavingsGoalView extends SavingsGoal {
  percentage: number;
  isComplete: boolean;
}

@Component({
  selector: 'app-savings-goals',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES],
  templateUrl: './savings-goals.component.html',
  styleUrls: ['./savings-goals.component.scss'],
})
export class SavingsGoalsComponent implements OnInit, OnDestroy {
  private savingsGoalService = inject(SavingsGoalService);
  private walletContext = inject(WalletContextService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  activeWallet?: Wallet;
  goals: SavingsGoalView[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.walletContext.activeWallet$
      .pipe(takeUntil(this.destroy$))
      .subscribe((wallet) => {
        if (wallet) {
          this.activeWallet = wallet;
          this.loadGoals();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadGoals(): void {
    if (!this.activeWallet) return;
    this.isLoading = true;
    this.savingsGoalService
      .getSavingsGoalsByWallet(this.activeWallet.id)
      .subscribe((data) => {
        this.goals = data.map((goal) => this.toView(goal));
        this.isLoading = false;
      });
  }

  private toView(goal: SavingsGoal): SavingsGoalView {
    const percentage =
      goal.targetAmount > 0
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
        : 0;
    return { ...goal, percentage, isComplete: percentage >= 100 };
  }

  addGoal(): void {
    if (!this.activeWallet) return;
    const walletId = this.activeWallet.id;

    this.openFormDialog({}).subscribe((result) => {
      if (!result) return;
      this.savingsGoalService
        .createSavingsGoal({ ...result, walletId })
        .subscribe({
          next: () => {
            this.notification.success('Meta creada.');
            this.loadGoals();
          },
          error: (err) => this.showError(err),
        });
    });
  }

  editGoal(goal: SavingsGoalView): void {
    this.openFormDialog({
      initialName: goal.name,
      initialTargetAmount: goal.targetAmount,
    }).subscribe((result) => {
      if (!result) return;
      this.savingsGoalService.updateSavingsGoal(goal.id, result).subscribe({
        next: () => {
          this.notification.success('Meta actualizada.');
          this.loadGoals();
        },
        error: (err) => this.showError(err),
      });
    });
  }

  contribute(goal: SavingsGoalView): void {
    this.dialog
      .open(ContributeDialogComponent, {
        width: '350px',
        data: { goalName: goal.name },
      })
      .afterClosed()
      .subscribe((amount: number | undefined) => {
        if (!amount) return;
        this.savingsGoalService.contribute(goal.id, amount).subscribe({
          next: () => {
            this.notification.success('¡Ahorro sumado a la meta!');
            this.loadGoals();
          },
          error: (err) => this.showError(err),
        });
      });
  }

  deleteGoal(goal: SavingsGoalView): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '350px',
        data: {
          title: 'Eliminar meta',
          message: `¿Eliminar la meta "${goal.name}"? Esta acción no se puede deshacer.`,
        },
      })
      .afterClosed()
      .pipe(filter((result) => result === true))
      .subscribe(() => {
        this.savingsGoalService.deleteSavingsGoal(goal.id).subscribe({
          next: () => {
            this.notification.success('Meta eliminada.');
            this.loadGoals();
          },
          error: (err) => this.showError(err),
        });
      });
  }

  private openFormDialog(data: SavingsGoalFormDialogData) {
    return this.dialog
      .open(SavingsGoalFormDialogComponent, { width: '400px', data })
      .afterClosed();
  }

  private showError(err: unknown): void {
    const message =
      (err as { error?: { message?: string } })?.error?.message ??
      'Ocurrió un error inesperado.';
    this.notification.error(message);
  }
}
