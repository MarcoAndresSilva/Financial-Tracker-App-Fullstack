import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  finalize,
  startWith,
  switchMap,
  of,
  debounceTime,
  distinctUntilChanged,
  filter,
  Subject,
  takeUntil,
} from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TransactionFormComponent } from '../../../transactions/components/transaction-form/transaction-form.component';

import { TransactionService } from '../../../transactions/services/transaction.service';
import {
  GetTransactionsFilterDto,
  Transaction,
} from '../../../transactions/services/transaction.types';
import {
  Category,
  CategoryService,
} from '../../../categories/services/category.service';
import {
  Subcategory,
  SubcategoryService,
} from '../../../subcategories/services/subcategory.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { Wallet } from '../../../user/types/user.types';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.scss'],
})
export class TransactionListComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private WalletContext = inject(WalletContextService);
  private categoryService = inject(CategoryService);
  private subcategoryService = inject(SubcategoryService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  private destroy$ = new Subject<void>();

  // TODO: Obtener walletId dinámicamente.
  // private tempWalletId = '6c2c74ed-a407-4238-b176-c30648c279df';

  activeWallet: Wallet | null = null;
  transactions: Transaction[] = [];
  isLoading = true;
  filterForm: FormGroup;

  categories: Category[] = [];
  subcategories: Subcategory[] = [];

  constructor() {
    this.filterForm = this.fb.group({
      type: [null],
      startDate: [null],
      endDate: [null],
      categoryId: [null],
      subcategoryId: [{ value: null, disabled: true }],
    });
  }

  ngOnInit(): void {
    this.WalletContext.activeWallet$
      .pipe(takeUntil(this.destroy$))
      .subscribe((wallet) => {
        this.activeWallet = wallet;
        if (wallet) {
          this.loadFilterOptions();
          this.loadTransactions();
        }
      });
    this.setupDependentFilters();
    this.setupFilterFormListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTransactions(): void {
    if (!this.activeWallet) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;

    const formValues = this.filterForm.getRawValue();
    const filters: GetTransactionsFilterDto = {
      walletId: this.activeWallet.id,
      ...formValues,
      startDate: formValues.startDate
        ? formatDate(formValues.startDate, 'yyy-mm-dd', 'en-US')
        : undefined,
      endDate: formValues.endDate
        ? formatDate(formValues.endDate, 'yyy-mm-dd', 'en-US')
        : undefined,
    };

    this.transactionService
      .getTransactions(filters)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (transactions) => {
          this.transactions = transactions;
        },
        error: (err) => console.error('Error al obtener transacciones', err),
      });
  }

  loadFilterOptions(): void {
    if (!this.activeWallet) return;
    this.categoryService
      .getCategoriesByWallet(this.activeWallet.id)
      .subscribe((data) => {
        this.categories = data;
      });
  }

  setupDependentFilters(): void {
    const categoryControl = this.filterForm.get('categoryId')!;
    const subcategoryControl = this.filterForm.get('subcategoryId')!;

    categoryControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((categoryId) => {
        subcategoryControl.reset({ value: null, disabled: true });
        if (categoryId) {
          this.subcategoryService
            .getSubcategoriesByCategory(categoryId)
            .subscribe((subcategories) => {
              this.subcategories = subcategories;
              subcategoryControl.enable();
            });
        }
      });
  }

  setupFilterFormListener(): void {
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadTransactions();
      });
  }

  openTransactionForm(): void {
    if (!this.activeWallet) return;
    const dialogRef = this.dialog.open(TransactionFormComponent, {
      width: '500px',
      data: { walletId: this.activeWallet.id },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadTransactions();
      }
    });
  }

  openEditForm(transaction: Transaction): void {
    if (!this.activeWallet) return;
    console.log('Abriendo diálogo para editar:', transaction);
    const dialogRef = this.dialog.open(TransactionFormComponent, {
      width: '500px',
      data: {
        walletId: this.activeWallet.id,
        transaction: transaction,
      },
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadTransactions();
      }
    });
  }

  onDelete(transactionId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        title: 'Confirmar Eliminación',
        message:
          '¿Estás seguro de que quieres eliminar esta transacción? Esta acción no se puede deshacer.',
      },
    });

    dialogRef
      .afterClosed()
      .pipe(filter((result) => result === true))
      .subscribe(() => {
        this.transactionService.deleteTransaction(transactionId).subscribe({
          next: () => {
            console.log('Transacción eliminada con éxito');
            this.loadTransactions();
          },
          error: (err) => {
            console.error('Error al eliminar la transacción', err);
          },
        });
      });
  }

  resetFilters(): void {
    this.filterForm.reset({
      type: null,
      startDate: null,
      endDate: null,
      categoryId: null,
      subcategoryId: { value: null, disabled: true },
    });
  }
}
