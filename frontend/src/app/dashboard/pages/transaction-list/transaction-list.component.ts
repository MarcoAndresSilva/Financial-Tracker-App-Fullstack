import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { delay, finalize } from 'rxjs';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES, LoadingSpinnerComponent],
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.scss'],
})
export class TransactionListComponent implements OnInit {
  private transactionService = inject(TransactionService);

  // TODO: Obtener walletId dinámicamente.
  private tempWalletId = '6c2c74ed-a407-4238-b176-c30648c279df';

  transactions: any[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    if (!this.tempWalletId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;

    const filters = {
      walletId: this.tempWalletId,
    };

    this.transactionService
      .getTransactions(filters)
      .pipe(
        delay(1000),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: (data) => {
          this.transactions = data;
          console.log('Gastos por categoría:', this.transactions);
        },
        error: (error) => {
          console.error('Error al obtener las transacciones:', error);
        },
      });
  }
}
