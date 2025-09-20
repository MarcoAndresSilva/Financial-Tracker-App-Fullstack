import { Component, OnInit, inject } from '@angular/core';
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
} from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

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
import { MatDialog } from '@angular/material/dialog';
import { TransactionFormComponent } from '../../../transactions/components/transaction-form/transaction-form.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    ConfirmDialogComponent,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.scss'],
})
export class TransactionListComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private subcategoryService = inject(SubcategoryService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  // TODO: Obtener walletId dinámicamente.
  private tempWalletId = '6c2c74ed-a407-4238-b176-c30648c279df';

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
    this.loadFilterData();
    this.setupSubcategoryListener();

    // Escuchamos los cambios en los filtros que NO son de fecha
    this.filterForm
      .get('type')!
      .valueChanges.subscribe(() => this.loadTransactions());
    this.filterForm
      .get('categoryId')!
      .valueChanges.subscribe(() => this.loadTransactions());
    this.filterForm
      .get('subcategoryId')!
      .valueChanges.subscribe(() => this.loadTransactions());

    // Escuchamos los cambios en la fecha de FIN para disparar la búsqueda de rango
    this.filterForm
      .get('endDate')!
      .valueChanges.pipe(
        // Solo continuamos si la fecha de fin no es nula
        filter((endDate) => !!endDate)
      )
      .subscribe(() => {
        this.loadTransactions();
      });

    this.loadTransactions(); // Carga inicial
  }

  loadTransactions(): void {
    if (!this.tempWalletId) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;

    const formValues = this.filterForm.getRawValue(); // .getRawValue() incluye los campos deshabilitados (como subcategoryId)

    const filters: GetTransactionsFilterDto = {
      walletId: this.tempWalletId,
      type: formValues.type,
      categoryId: formValues.categoryId,
      subcategoryId: formValues.subcategoryId,
      startDate: formValues.startDate
        ? formatDate(formValues.startDate, 'yyyy-MM-dd', 'en-US')
        : undefined,
      endDate: formValues.endDate
        ? formatDate(formValues.endDate, 'yyyy-MM-dd', 'en-US')
        : undefined,
    };

    this.transactionService
      .getTransactions(filters)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (data) => {
          this.transactions = data;
        },
        error: (err) => {
          console.error('Error al cargar transacciones:', err);
        },
      });
  }

  loadFilterData(): void {
    if (!this.tempWalletId) return;
    this.categoryService
      .getCategoriesByWallet(this.tempWalletId)
      .subscribe((data) => {
        this.categories = data;
      });
  }

  setupSubcategoryListener(): void {
    const categoryControl = this.filterForm.get('categoryId')!;
    const subcategoryControl = this.filterForm.get('subcategoryId')!;

    categoryControl.valueChanges
      .pipe(
        startWith(categoryControl.value),
        switchMap((categoryId) => {
          subcategoryControl.reset(null, { emitEvent: false });
          if (categoryId) {
            subcategoryControl.enable({ emitEvent: false });
            return this.subcategoryService.getSubcategoriesByCategory(
              categoryId
            );
          } else {
            subcategoryControl.disable({ emitEvent: false });
            return of([]);
          }
        })
      )
      .subscribe((subcategories) => {
        this.subcategories = subcategories;
      });
  }

  openTransactionForm(): void {
    const dialogRef = this.dialog.open(TransactionFormComponent, {
      width: '500px',
      data: { walletId: this.tempWalletId },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadTransactions();
      }
    });
  }

  openEditForm(transaction: Transaction): void {
    console.log('Abriendo diálogo para editar:', transaction);
    const dialogRef = this.dialog.open(TransactionFormComponent, {
      width: '500px',
      data: {
        walletId: this.tempWalletId,
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
