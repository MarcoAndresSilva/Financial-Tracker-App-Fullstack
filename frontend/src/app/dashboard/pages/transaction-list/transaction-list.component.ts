import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  finalize,
  startWith,
  switchMap,
  of,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  Subject,
  take,
  takeUntil,
} from 'rxjs';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TransactionFormComponent } from '../../../transactions/components/transaction-form/transaction-form.component';
import {
  BulkTransactionsDialogComponent,
  BulkTransactionsMode,
} from '../../../transactions/components/bulk-transactions-dialog/bulk-transactions-dialog.component';

import { TransactionService } from '../../../transactions/services/transaction.service';
import { NotificationService } from '../../../core/services/notification.service';
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
import {
  Period,
  PeriodContextService,
} from '../../../core/services/period-context.service';
import { Wallet } from '../../../user/types/user.types';
import { MatDialog } from '@angular/material/dialog';
import { dateToApiString } from '../../../shared/utils/date.util';
import { MonthSelectorComponent } from '../../../shared/components/month-selector/month-selector.component';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    ...MATERIAL_MODULES,
    LoadingSpinnerComponent,
    ReactiveFormsModule,
    MonthSelectorComponent,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.scss'],
})
export class TransactionListComponent implements OnInit {
  private transactionService = inject(TransactionService);
  private WalletContext = inject(WalletContextService);
  private periodContext = inject(PeriodContextService);
  private categoryService = inject(CategoryService);
  private subcategoryService = inject(SubcategoryService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private notification = inject(NotificationService);
  private breakpointObserver = inject(BreakpointObserver);

  private destroy$ = new Subject<void>();

  activeWallet: Wallet | null = null;
  activePeriod: Period = this.periodContext.getPeriod();
  // Por defecto la lista muestra solo el mes del período; el usuario puede
  // pasar a "todos los meses" o fijar un rango manual en el panel de filtros.
  showAllMonths = false;
  transactions: Transaction[] = [];
  isLoading = true;
  filterForm: FormGroup;

  // Modo de selección múltiple para mover un lote de transacciones a otra fecha.
  selectionMode = false;
  selectedIds = new Set<string>();

  // En mobile arrancan colapsados para no tapar la lista; en desktop, visibles
  // como siempre (se decide una sola vez al entrar, después el usuario lo maneja a mano).
  showFilters = true;

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
    combineLatest([
      this.WalletContext.activeWallet$,
      this.periodContext.activePeriod$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([wallet, period]) => {
        const walletChanged = wallet?.id !== this.activeWallet?.id;
        this.activeWallet = wallet;
        this.activePeriod = period;
        if (wallet) {
          if (walletChanged) this.loadFilterOptions();
          this.loadTransactions();
        }
      });
    this.setupDependentFilters();
    this.setupFilterFormListener();

    this.breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(take(1))
      .subscribe((result) => {
        this.showFilters = !result.matches;
      });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  toggleAllMonths(): void {
    this.showAllMonths = !this.showAllMonths;
    this.loadTransactions();
  }

  // --- Selección múltiple / acciones en lote ---

  toggleSelectionMode(): void {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) this.selectedIds.clear();
  }

  toggleSelected(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  // `mode`:
  //  - 'copy': crea copias en la fecha elegida (para no recargar las cuentas
  //            fijas cada mes), deja las originales
  //  - 'move': les cambia la fecha a todas
  openBulkDialog(mode: BulkTransactionsMode): void {
    if (!this.activeWallet || this.selectedIds.size === 0) return;
    const walletId = this.activeWallet.id;
    const ids = [...this.selectedIds];

    this.dialog
      .open(BulkTransactionsDialogComponent, {
        width: '400px',
        data: { count: ids.length, mode },
      })
      .afterClosed()
      .subscribe((targetDate: Date | undefined) => {
        if (!targetDate) return;
        const payload = {
          walletId,
          transactionIds: ids,
          date: dateToApiString(targetDate),
        };
        const request$ =
          mode === 'copy'
            ? this.transactionService.bulkCopy(payload)
            : this.transactionService.bulkMove(payload);

        request$.subscribe({
          next: ({ count }) => {
            // Quedamos parados en el mes destino para revisar el resultado.
            this.periodContext.setPeriod(
              targetDate.getFullYear(),
              targetDate.getMonth() + 1,
            );
            this.selectedIds.clear();
            this.selectionMode = false;
            const verb = mode === 'copy' ? 'copiada' : 'movida';
            this.notification.success(
              `${count} transacci${count === 1 ? 'ón ' + verb : 'ones ' + verb + 's'}.`,
            );
            // El cambio de período ya dispara loadTransactions vía combineLatest.
          },
          error: (err) => {
            const message =
              err?.error?.message ??
              `No se pudieron ${mode === 'copy' ? 'copiar' : 'mover'} las transacciones.`;
            this.notification.error(message);
          },
        });
      });
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

    // Prioridad de la ventana de fechas:
    //  1. rango manual del panel de filtros (si el usuario puso alguno)
    //  2. el mes del período activo (comportamiento por defecto)
    //  3. sin límite, si el usuario activó "todos los meses"
    let startDate = formValues.startDate
      ? dateToApiString(formValues.startDate)
      : undefined;
    let endDate = formValues.endDate
      ? dateToApiString(formValues.endDate)
      : undefined;

    if (!startDate && !endDate && !this.showAllMonths) {
      const { year, month } = this.activePeriod;
      startDate = dateToApiString(new Date(year, month - 1, 1));
      endDate = dateToApiString(new Date(year, month, 0)); // último día del mes
    }

    const filters: GetTransactionsFilterDto = {
      walletId: this.activeWallet.id,
      ...formValues,
      startDate,
      endDate,
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
