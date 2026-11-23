import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MATERIAL_MODULES } from '../../material/material.module';
import { BudgetScope } from '../../../budget/services/budget.service';

export interface BudgetEntryDialogData {
  categoryName: string;
  /** "diciembre": para los textos "Solo diciembre" / "Diciembre y los siguientes". */
  monthName: string;
  currentAmount: number | null;
  /** Si el monto actual es un ajuste de solo este mes, se propone ese alcance. */
  isMonthAdjustment: boolean;
}

/** amount null = quitar el presupuesto con ese alcance. */
export interface BudgetEntryDialogResult {
  amount: number | null;
  scope: BudgetScope;
}

/**
 * Definir o cambiar el presupuesto de una categoría (Paso 82). La pregunta
 * clave es el alcance: "solo este mes" (un ajuste puntual, ej. diciembre por
 * las fiestas) o "este mes y los siguientes" (el nuevo monto habitual). Los
 * meses anteriores nunca cambian (Paso 81).
 */
@Component({
  selector: 'app-budget-entry-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './budget-entry-dialog.component.html',
  styleUrls: ['./budget-entry-dialog.component.scss'],
})
export class BudgetEntryDialogComponent {
  private fb = inject(FormBuilder);
  // Con inject() (y no en el constructor) para que `data` exista antes de
  // armar el formulario, que se crea como propiedad de la clase.
  readonly data = inject<BudgetEntryDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef =
    inject<MatDialogRef<BudgetEntryDialogComponent, BudgetEntryDialogResult>>(MatDialogRef);

  readonly form = this.fb.group({
    amount: [
      this.data.currentAmount as number | null,
      [Validators.required, Validators.min(0)],
    ],
    scope: [
      (this.data.isMonthAdjustment ? 'ONLY_MONTH' : 'FROM_MONTH') as BudgetScope,
    ],
  });

  get monthTitle(): string {
    return this.data.monthName.charAt(0).toUpperCase() + this.data.monthName.slice(1);
  }

  save(): void {
    if (this.form.invalid) return;
    const { amount, scope } = this.form.getRawValue();
    this.dialogRef.close({ amount: Number(amount), scope: scope! });
  }

  /** Quitar con el alcance elegido: solo este mes, o desde este mes. */
  remove(): void {
    this.dialogRef.close({ amount: null, scope: this.form.getRawValue().scope! });
  }
}
