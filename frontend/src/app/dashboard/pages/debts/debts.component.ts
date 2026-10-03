import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Subject, filter, takeUntil } from 'rxjs';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { Debt, DebtService } from '../../../debts/services/debt.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Wallet } from '../../../user/types/user.types';
import {
  DebtFormDialogComponent,
  DebtFormDialogData,
} from '../../../shared/components/debt-form-dialog/debt-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss'],
})
export class DebtsComponent implements OnInit, OnDestroy {
  private debtService = inject(DebtService);
  private walletContext = inject(WalletContextService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  activeWallet?: Wallet;
  debts: Debt[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.walletContext.activeWallet$
      .pipe(takeUntil(this.destroy$))
      .subscribe((wallet) => {
        if (wallet) {
          this.activeWallet = wallet;
          this.loadDebts();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDebts(): void {
    if (!this.activeWallet) return;
    this.isLoading = true;
    this.debtService.getDebtsByWallet(this.activeWallet.id).subscribe((data) => {
      this.debts = data;
      this.isLoading = false;
    });
  }

  addDebt(): void {
    if (!this.activeWallet) return;
    const walletId = this.activeWallet.id;

    this.openFormDialog({}).subscribe((result) => {
      if (!result) return;
      this.debtService.createDebt({ ...result, walletId }).subscribe({
        next: () => {
          this.notification.success('Deuda creada.');
          this.loadDebts();
        },
        error: (err) => this.showError(err),
      });
    });
  }

  editDebt(debt: Debt): void {
    this.openFormDialog({
      initialData: {
        name: debt.name,
        totalAmount: debt.totalAmount,
        totalInstallments: debt.totalInstallments,
        startDate: debt.startDate,
      },
    }).subscribe((result) => {
      if (!result) return;
      // En edición no se reenvían initialPaidInstallments/initialPaidAmount
      // (el diálogo no los pide) — el punto de partida no se toca después de
      // creada la deuda.
      const { initialPaidInstallments, initialPaidAmount, ...updatePayload } =
        result;
      this.debtService.updateDebt(debt.id, updatePayload).subscribe({
        next: () => {
          this.notification.success('Deuda actualizada.');
          this.loadDebts();
        },
        error: (err) => this.showError(err),
      });
    });
  }

  deleteDebt(debt: Debt): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '350px',
        data: {
          title: 'Eliminar deuda',
          message: `¿Eliminar "${debt.name}"? Los pagos ya registrados no se borran, solo quedan sin vincular.`,
        },
      })
      .afterClosed()
      .pipe(filter((result) => result === true))
      .subscribe(() => {
        this.debtService.deleteDebt(debt.id).subscribe({
          next: () => {
            this.notification.success('Deuda eliminada.');
            this.loadDebts();
          },
          error: (err) => this.showError(err),
        });
      });
  }

  private openFormDialog(data: DebtFormDialogData) {
    return this.dialog
      .open(DebtFormDialogComponent, { width: '450px', data })
      .afterClosed();
  }

  private showError(err: unknown): void {
    const message =
      (err as { error?: { message?: string } })?.error?.message ??
      'Ocurrió un error inesperado.';
    this.notification.error(message);
  }
}
