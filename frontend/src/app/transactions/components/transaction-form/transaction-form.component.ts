import { Component, Inject, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { startWith, switchMap, of, finalize, Observable } from 'rxjs';

import { CommonModule } from '@angular/common';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import {
  isoToLocalDate,
  dateToApiString,
} from '../../../shared/utils/date.util';
import { TransactionService } from '../../../transactions/services/transaction.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from './../../services/transaction.types';

import {
  Category,
  CategoryService,
} from '../../../categories/services/category.service';
import {
  Subcategory,
  SubcategoryService,
} from '../../../subcategories/services/subcategory.service';
import { Transaction } from '../../../transactions/services/transaction.types';
import { Debt, DebtService } from '../../../debts/services/debt.service';

export interface TransactionFormData {
  walletId: string;
  /** Presente = editar esa transacción. */
  transaction?: Transaction;
  /** Al crear: valores ya puestos (ej. "Registrar pago" desde una deuda). */
  preset?: { categoryId: string; subcategoryId: string; amount?: number | null };
}
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, MATERIAL_MODULES, ReactiveFormsModule],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.scss'],
})
export class TransactionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private transactionService = inject(TransactionService);
  private categoryService = inject(CategoryService);
  private subcategoryService = inject(SubcategoryService);
  private debtService = inject(DebtService);
  private notification = inject(NotificationService);

  transactionForm: FormGroup;
  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  /** Deudas de la wallet: para reconocer cuándo un gasto es un pago (Paso 78). */
  debts: Debt[] = [];
  isEditMode = false;
  // Subcategoría a elegir apenas carguen las de la categoría (ver `preset`).
  private pendingSubcategoryId: string | null = null;
  // Mientras el backend responde, el botón queda bloqueado: un segundo clic
  // durante la espera creaba la transacción dos veces.
  isSaving = false;

  constructor(
    public dialogRef: MatDialogRef<TransactionFormComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: TransactionFormData
  ) {
    this.isEditMode = !!this.data.transaction;

    this.transactionForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      type: ['EXPENSE', Validators.required],
      description: ['', Validators.required],
      categoryId: [null, Validators.required],
      subcategoryId: [{ value: null, disabled: true }, Validators.required],
      date: [new Date(), Validators.required],
    });
  }

  /**
   * Si la subcategoría elegida es la de una deuda, este gasto es un pago: se
   * suma solo (Paso 77). Solo al crear: al editar, el pago ya está contado.
   */
  get linkedDebt(): Debt | undefined {
    if (this.isEditMode) return undefined;
    const { subcategoryId, type } = this.transactionForm.getRawValue();
    if (!subcategoryId || type !== 'EXPENSE') return undefined;
    return this.debts.find((d) => d.subcategoryId === subcategoryId);
  }

  get dialogTitle(): string {
    if (this.isEditMode) return 'Editar transacción';
    return this.data.preset ? 'Registrar pago' : 'Nueva transacción';
  }

  ngOnInit(): void {
    // 1. Siempre cargamos las opciones de categorías disponibles.
    this.loadCategories();
    this.loadDebts();

    // Abierto desde "Registrar pago" de una deuda: llega con categoría,
    // subcategoría y monto ya puestos.
    if (!this.isEditMode && this.data.preset) {
      const { categoryId, subcategoryId, amount } = this.data.preset;
      this.transactionForm.patchValue({ categoryId, amount: amount ?? null });
      this.pendingSubcategoryId = subcategoryId;
    }

    // 2. Si estamos en modo edición, procedemos a rellenar el formulario.
    if (this.isEditMode && this.data.transaction) {
      // Usamos una variable clara para la transacción que estamos editando.
      const transactionToEdit = this.data.transaction;

      // 3. Rellenamos el formulario con los datos de la transacción.
      //    Usamos patchValue para los campos que coinciden directamente.
      this.transactionForm.patchValue({
        amount: transactionToEdit.amount,
        type: transactionToEdit.type,
        description: transactionToEdit.description,
        date: isoToLocalDate(transactionToEdit.date), // ISO de la API → día local (sin corrimiento de huso)
        categoryId: transactionToEdit.subcategory.categoryId,
      });

      // 4. Manejamos la subcategoría de forma especial, ya que depende de la categoría.
      const parentCategoryId = transactionToEdit.subcategory.categoryId;
      if (parentCategoryId) {
        // Primero, cargamos la lista de subcategorías que pertenecen a la categoría de la transacción.
        this.subcategoryService
          .getSubcategoriesByCategory(parentCategoryId)
          .subscribe((availableSubcategories) => {
            this.subcategories = availableSubcategories;
            // Una vez cargadas, habilitamos el control y establecemos el valor correcto.
            this.transactionForm.get('subcategoryId')?.enable();
            this.transactionForm
              .get('subcategoryId')
              ?.setValue(transactionToEdit.subcategoryId);
          });
      }
    }

    // 5. Finalmente, configuramos el listener para que el formulario siga siendo reactivo
    //    en caso de que el usuario cambie la categoría manualmente.
    this.setupSubcategoryListener();
    this.transactionForm
      .get('subcategoryId')!
      .valueChanges.subscribe(() => this.prefillFromLinkedDebt());
  }

  loadCategories() {
    this.categoryService
      .getCategoriesByWallet(this.data.walletId)
      .subscribe((data) => {
        this.categories = data;
      });
  }

  loadDebts() {
    this.debtService.getDebtsByWallet(this.data.walletId).subscribe((data) => {
      this.debts = data;
      this.prefillFromLinkedDebt();
    });
  }

  /**
   * Al elegir la subcategoría de una deuda, propone el monto de la cuota y
   * una descripción, solo en los campos que el usuario dejó vacíos.
   */
  private prefillFromLinkedDebt(): void {
    const debt = this.linkedDebt;
    if (!debt) return;
    const amount = this.transactionForm.get('amount')!;
    const description = this.transactionForm.get('description')!;

    if (debt.kind === 'INSTALLMENTS' && !debt.progress.isFinished) {
      if (!amount.value && debt.progress.installmentValueClp) {
        amount.setValue(debt.progress.installmentValueClp);
      }
      if (!description.value) {
        description.setValue(
          `Cuota ${debt.progress.nextInstallmentNumber} de ${debt.totalInstallments} · ${debt.name}`
        );
      }
    } else if (debt.kind === 'FREE_AMOUNT' && !description.value) {
      description.setValue(`Pago ${debt.name}`);
    }
  }

  setupSubcategoryListener(): void {
    const categoryControl = this.transactionForm.get('categoryId')!;
    const subcategoryControl = this.transactionForm.get('subcategoryId')!;

    categoryControl.valueChanges
      .pipe(
        startWith(categoryControl.value),
        switchMap((categoryId) => {
          if (!this.isEditMode || this.transactionForm.dirty) {
            subcategoryControl.reset({ value: null, disabled: true });
          }
          if (categoryId) {
            subcategoryControl.enable();
            return this.subcategoryService.getSubcategoriesByCategory(
              categoryId
            );
          }
          return of([]);
        })
      )
      .subscribe((subcategories) => {
        this.subcategories = subcategories;
        if (
          this.pendingSubcategoryId &&
          subcategories.some((s) => s.id === this.pendingSubcategoryId)
        ) {
          subcategoryControl.setValue(this.pendingSubcategoryId);
          this.pendingSubcategoryId = null;
        }
      });
  }

  onSave(): void {
    if (this.transactionForm.invalid || this.isSaving) return;

    const formData = this.transactionForm.getRawValue();
    const finalData: CreateTransactionDto | UpdateTransactionDto = {
      ...formData,
      walletId: this.data.walletId,
      date: dateToApiString(formData.date),
    };

    const request$: Observable<unknown> = this.isEditMode
      ? this.transactionService.updateTransaction(
          this.data.transaction!.id,
          finalData
        )
      : this.transactionService.createTransaction(
          finalData as CreateTransactionDto
        );

    this.isSaving = true;
    // Tampoco se puede cerrar el diálogo a medio guardar: la transacción se
    // crearía igual, pero la lista no se enteraría para recargarse.
    this.dialogRef.disableClose = true;
    request$
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.dialogRef.disableClose = false;
        })
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () =>
          this.notification.error(
            'No pudimos guardar la transacción. Inténtalo de nuevo.'
          ),
      });
  }
}
