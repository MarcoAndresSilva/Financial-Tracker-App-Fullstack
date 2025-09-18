import { Component, Inject, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { startWith, switchMap, of } from 'rxjs';

import { CommonModule, formatDate } from '@angular/common';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';
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

  transactionForm: FormGroup;
  categories: Category[] = [];
  subcategories: Subcategory[] = [];
  isEditMode = false;

  constructor(
    public dialogRef: MatDialogRef<TransactionFormComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { walletId: string; transaction?: Transaction }
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

  ngOnInit(): void {
    // 1. Siempre cargamos las opciones de categorías disponibles.
    this.loadCategories();

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
        date: new Date(transactionToEdit.date), // Convertimos el string a objeto Date
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
  }

  loadCategories() {
    this.categoryService
      .getCategoriesByWallet(this.data.walletId)
      .subscribe((data) => {
        this.categories = data;
      });
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
      });
  }

  onSave(): void {
    if (this.transactionForm.invalid) return;

    // ... (preparación de datos)
    const formData = this.transactionForm.getRawValue();
    const transactionData = {
      ...formData,
      walletId: this.data.walletId,
      date: formatDate(formData.date, 'yyyy-MM-dd', 'en-US'),
    };

    const finalData: CreateTransactionDto | UpdateTransactionDto =
      transactionData;

    // 4. Lógica condicional para guardar
    if (this.isEditMode) {
      // MODO EDICIÓN
      this.transactionService
        .updateTransaction(this.data.transaction!.id, finalData)
        .subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => console.error('Error al actualizar transacción', err),
        });
    } else {
      // MODO CREACIÓN
      this.transactionService
        .createTransaction(finalData as CreateTransactionDto)
        .subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => console.error('Error al crear transacción', err),
        });
    }
  }
}
