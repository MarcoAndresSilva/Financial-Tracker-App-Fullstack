import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Subject, filter, takeUntil } from 'rxjs';

import { MATERIAL_MODULES } from '../../../shared/material/material.module';
import {
  Category,
  CategoryService,
} from '../../../categories/services/category.service';
import {
  Subcategory,
  SubcategoryService,
} from '../../../subcategories/services/subcategory.service';
import { WalletContextService } from '../../../core/services/wallet-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Wallet } from '../../../user/types/user.types';
import {
  NameFormDialogComponent,
  NameFormDialogData,
} from '../../../shared/components/name-form-dialog/name-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_MODULES],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss'],
})
export class CategoriesComponent implements OnInit, OnDestroy {
  private categoryService = inject(CategoryService);
  private subcategoryService = inject(SubcategoryService);
  private walletContext = inject(WalletContextService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  activeWallet?: Wallet;
  categories: Category[] = [];
  subcategoriesByCategory: Record<string, Subcategory[]> = {};
  loadingSubcategoriesFor: Record<string, boolean> = {};
  isLoading = true;

  ngOnInit(): void {
    this.walletContext.activeWallet$
      .pipe(takeUntil(this.destroy$))
      .subscribe((wallet) => {
        if (wallet) {
          this.activeWallet = wallet;
          this.loadCategories();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    if (!this.activeWallet) return;
    this.isLoading = true;
    this.subcategoriesByCategory = {};
    this.categoryService
      .getCategoriesByWallet(this.activeWallet.id)
      .subscribe((data) => {
        this.categories = data;
        this.isLoading = false;
        // La grilla muestra todas las subcategorías a la vista, así que se
        // cargan de una para cada categoría (sin esperar a que se expanda nada).
        data.forEach((category) => this.loadSubcategories(category.id));
      });
  }

  private loadSubcategories(categoryId: string): void {
    this.loadingSubcategoriesFor[categoryId] = true;
    this.subcategoryService
      .getSubcategoriesByCategory(categoryId)
      .subscribe((data) => {
        this.subcategoriesByCategory[categoryId] = data;
        this.loadingSubcategoriesFor[categoryId] = false;
      });
  }

  addCategory(): void {
    if (!this.activeWallet) return;
    const walletId = this.activeWallet.id;

    this.openNameDialog({ title: 'Nueva categoría', label: 'Nombre' })
      .subscribe((name) => {
        if (!name) return;
        this.categoryService.createCategory({ name, walletId }).subscribe({
          next: () => {
            this.notification.success('Categoría creada.');
            this.loadCategories();
          },
          error: (err) => this.showError(err),
        });
      });
  }

  editCategory(category: Category): void {
    this.openNameDialog({
      title: 'Editar categoría',
      label: 'Nombre',
      initialValue: category.name,
    }).subscribe((name) => {
      if (!name) return;
      this.categoryService.updateCategory(category.id, { name }).subscribe({
        next: () => {
          this.notification.success('Categoría actualizada.');
          this.loadCategories();
        },
        error: (err) => this.showError(err),
      });
    });
  }

  deleteCategory(category: Category): void {
    this.openConfirmDialog(
      'Eliminar categoría',
      `¿Eliminar "${category.name}"? También se eliminan sus subcategorías.`
    ).subscribe(() => {
      this.categoryService.deleteCategory(category.id).subscribe({
        next: () => {
          this.notification.success('Categoría eliminada.');
          this.loadCategories();
        },
        error: (err) => this.showError(err),
      });
    });
  }

  addSubcategory(category: Category): void {
    this.openNameDialog({
      title: `Nueva subcategoría en "${category.name}"`,
      label: 'Nombre',
    }).subscribe((name) => {
      if (!name) return;
      this.subcategoryService
        .createSubcategory({ name, categoryId: category.id })
        .subscribe({
          next: () => {
            this.notification.success('Subcategoría creada.');
            this.loadSubcategories(category.id);
          },
          error: (err) => this.showError(err),
        });
    });
  }

  editSubcategory(category: Category, subcategory: Subcategory): void {
    this.openNameDialog({
      title: 'Editar subcategoría',
      label: 'Nombre',
      initialValue: subcategory.name,
    }).subscribe((name) => {
      if (!name) return;
      this.subcategoryService
        .updateSubcategory(subcategory.id, { name })
        .subscribe({
          next: () => {
            this.notification.success('Subcategoría actualizada.');
            this.loadSubcategories(category.id);
          },
          error: (err) => this.showError(err),
        });
    });
  }

  deleteSubcategory(category: Category, subcategory: Subcategory): void {
    this.openConfirmDialog(
      'Eliminar subcategoría',
      `¿Eliminar "${subcategory.name}"?`
    ).subscribe(() => {
      this.subcategoryService.deleteSubcategory(subcategory.id).subscribe({
        next: () => {
          this.notification.success('Subcategoría eliminada.');
          this.loadSubcategories(category.id);
        },
        error: (err) => this.showError(err),
      });
    });
  }

  private openNameDialog(data: NameFormDialogData) {
    return this.dialog
      .open<NameFormDialogComponent, NameFormDialogData, string>(
        NameFormDialogComponent,
        { width: '350px', data }
      )
      .afterClosed();
  }

  private openConfirmDialog(title: string, message: string) {
    return this.dialog
      .open(ConfirmDialogComponent, {
        width: '350px',
        data: { title, message },
      })
      .afterClosed()
      .pipe(filter((result) => result === true));
  }

  private showError(err: unknown): void {
    const message =
      (err as { error?: { message?: string } })?.error?.message ??
      'Ocurrió un error inesperado.';
    this.notification.error(message);
  }
}
