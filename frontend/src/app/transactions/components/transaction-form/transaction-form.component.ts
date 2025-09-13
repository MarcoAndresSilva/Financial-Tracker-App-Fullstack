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
  Category,
  CategoryService,
} from '../../../categories/services/category.service';
import {
  Subcategory,
  SubcategoryService,
} from '../../../subcategories/services/subcategory.service';

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

  constructor(
    public dialogRef: MatDialogRef<TransactionFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { walletId: string }
  ) {
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
    this.loadCategories();
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
          subcategoryControl.reset({ value: null, disabled: true });
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
    if (this.transactionForm.invalid) {
      return;
    }

    const formData = this.transactionForm.value;
    const newTransactionData = {
      ...formData,
      walletId: this.data.walletId,
      date: formatDate(formData.date, 'yyyy-MM-dd', 'en-US'),
    };

    this.transactionService.createTransaction(newTransactionData).subscribe({
      next: (response) => {
        console.log('Transacción creada:', response);
        this.dialogRef.close(true);
      },
      error: (error) => {
        console.error('Error al crear la transacción:', error);
        //TODO Manejar notificacion de el error
      },
    });
  }
}
