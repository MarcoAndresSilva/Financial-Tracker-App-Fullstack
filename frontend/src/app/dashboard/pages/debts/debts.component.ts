import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Subject, filter, takeUntil } from 'rxjs';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import {
  Debt,
  DebtService,
  InstallmentDebt,
} from '../../../debts/services/debt.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Wallet } from '../../../user/types/user.types';
import {
  DebtFormDialogComponent,
  DebtFormDialogData,
  DebtFormResult,
} from '../../../shared/components/debt-form-dialog/debt-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  TransactionFormComponent,
  TransactionFormData,
} from '../../../transactions/components/transaction-form/transaction-form.component';
import {
  formatMonthYear,
  formatShortDay,
} from '../../../shared/utils/date.util';

/**
 * Deudas (Paso 78): una tarjeta por deuda, al estilo de la vista del banco
 * ("Cuota 42 de 300 · UF 8,44 ≈ $348.778 · vence el 1 dic"). Todo el progreso
 * viene calculado por el backend; acá solo se le da formato.
 */
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

  readonly formatShortDay = formatShortDay;
  readonly formatMonthYear = formatMonthYear;

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
    this.debtService.getDebtsByWallet(this.activeWallet.id).subscribe({
      next: (data) => {
        this.debts = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.notification.error('No pudimos cargar tus deudas.');
      },
    });
  }

  // --- Textos de la tarjeta ------------------------------------------------

  /** "Al día", "Vence en 3 días", "Atrasada 2 días"… */
  statusLabel(debt: InstallmentDebt): string {
    const { status, daysUntilDue: days } = debt.progress;
    switch (status) {
      case 'PAID':
        return 'Pagada';
      case 'OVERDUE':
        return `Atrasada ${-days!} ${-days! === 1 ? 'día' : 'días'}`;
      case 'DUE_SOON':
        if (days === 0) return 'Vence hoy';
        if (days === 1) return 'Vence mañana';
        return `Vence en ${days} días`;
      default:
        return 'Al día';
    }
  }

  kindLabel(debt: Debt): string {
    if (debt.kind === 'FREE_AMOUNT') return 'Monto libre';
    return debt.unit === 'UF' ? 'En cuotas · UF' : 'En cuotas';
  }

  // --- Acciones ------------------------------------------------------------

  /**
   * Abre el formulario de transacción ya llenado con la subcategoría de la
   * deuda y el monto de la cuota: al guardarlo, la cuota se suma sola.
   */
  registerPayment(debt: Debt): void {
    if (!this.activeWallet) return;
    const data: TransactionFormData = {
      walletId: this.activeWallet.id,
      preset: {
        categoryId: debt.categoryId,
        subcategoryId: debt.subcategoryId,
        amount:
          debt.kind === 'INSTALLMENTS' ? debt.progress.installmentValueClp : null,
      },
    };
    this.dialog
      .open(TransactionFormComponent, { width: '500px', data })
      .afterClosed()
      .pipe(filter((saved) => saved === true))
      .subscribe(() => {
        this.notification.success(`Pago registrado en ${debt.name}.`);
        this.loadDebts();
      });
  }

  addDebt(): void {
    if (!this.activeWallet) return;
    const walletId = this.activeWallet.id;

    this.openFormDialog({}).subscribe((result) => {
      if (!result?.kind) return;
      this.debtService
        .createDebt({ ...result, kind: result.kind, walletId })
        .subscribe({
          next: () => {
            this.notification.success(
              `Deuda creada. Sus pagos van en Deudas → ${result.name}.`,
            );
            this.loadDebts();
          },
          error: (err) => this.showError(err),
        });
    });
  }

  editDebt(debt: Debt): void {
    this.openFormDialog({ debt }).subscribe((result) => {
      if (!result) return;
      const { kind: _kind, ...payload } = result;
      this.debtService.updateDebt(debt.id, payload).subscribe({
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
        width: '380px',
        data: {
          title: 'Eliminar deuda',
          message: `¿Eliminar "${debt.name}"? Los pagos que registraste no se borran: quedan en Deudas → ${debt.name}.`,
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
      .open<DebtFormDialogComponent, DebtFormDialogData, DebtFormResult>(
        DebtFormDialogComponent,
        { width: '480px', maxWidth: '95vw', data },
      )
      .afterClosed();
  }

  private showError(err: unknown): void {
    const message =
      (err as { error?: { message?: string } })?.error?.message ??
      'Ocurrió un error inesperado.';
    this.notification.error(message);
  }
}
