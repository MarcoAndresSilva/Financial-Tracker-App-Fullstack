import { Component, Inject, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MATERIAL_MODULES } from '../../../shared/material/material.module';

export type BulkTransactionsMode = 'move' | 'copy';

export interface BulkTransactionsDialogData {
  count: number;
  mode: BulkTransactionsMode;
}

/**
 * Diálogo compartido para las acciones en lote de la lista de transacciones:
 *  - `move`: reasigna la fecha de las transacciones seleccionadas
 *  - `copy`: crea copias en la fecha elegida, dejando las originales
 * En ambos casos el usuario elige una única fecha. Devuelve un `Date`.
 */
@Component({
  selector: 'app-bulk-transactions-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './bulk-transactions-dialog.component.html',
  styleUrls: ['./bulk-transactions-dialog.component.scss'],
})
export class BulkTransactionsDialogComponent {
  private fb = inject(FormBuilder);

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<BulkTransactionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BulkTransactionsDialogData,
  ) {
    this.form = this.fb.group({
      date: [this.firstOfNextMonth(), [Validators.required]],
    });
  }

  get isCopy(): boolean {
    return this.data.mode === 'copy';
  }

  get title(): string {
    const n = this.data.count;
    const noun = n === 1 ? 'transacción' : 'transacciones';
    return this.isCopy ? `Copiar ${n} ${noun}` : `Mover ${n} ${noun}`;
  }

  get hint(): string {
    return this.isCopy
      ? 'Se crean copias con la fecha que elijas. Las originales quedan como están.'
      : 'Se les cambia la fecha a todas por la que elijas.';
  }

  get confirmLabel(): string {
    return this.isCopy ? 'Copiar' : 'Mover';
  }

  useFirstOfNextMonth(): void {
    this.form.patchValue({ date: this.firstOfNextMonth() });
  }

  private firstOfNextMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value.date as Date);
  }
}
