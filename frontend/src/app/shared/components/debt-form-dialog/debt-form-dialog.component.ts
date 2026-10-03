import { CommonModule } from '@angular/common';
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
import { MATERIAL_MODULES } from '../../material/material.module';
import {
  dateToApiString,
  isoToLocalDate,
} from '../../utils/date.util';

export interface DebtFormDialogData {
  // Presente = editar; ausente = crear. En edición no se tocan las cuotas/
  // plata "ya pagadas al crear" — ese punto de partida se declara una sola
  // vez, no se reajusta después.
  initialData?: {
    name: string;
    totalAmount: number;
    totalInstallments: number;
    startDate: string;
  };
}

export interface DebtFormResult {
  name: string;
  totalAmount: number;
  totalInstallments: number;
  startDate: string; // 'YYYY-MM-DD'
  initialPaidInstallments?: number;
  initialPaidAmount?: number;
}

@Component({
  selector: 'app-debt-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './debt-form-dialog.component.html',
  styleUrls: ['./debt-form-dialog.component.scss'],
})
export class DebtFormDialogComponent {
  private fb = inject(FormBuilder);

  isEditMode: boolean;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<DebtFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DebtFormDialogData
  ) {
    this.isEditMode = !!data.initialData;

    this.form = this.fb.group({
      name: [data.initialData?.name ?? '', Validators.required],
      totalAmount: [
        data.initialData?.totalAmount ?? null,
        [Validators.required, Validators.min(1)],
      ],
      totalInstallments: [
        data.initialData?.totalInstallments ?? null,
        [Validators.required, Validators.min(1)],
      ],
      startDate: [
        data.initialData
          ? isoToLocalDate(data.initialData.startDate)
          : new Date(),
        Validators.required,
      ],
      // Solo se usan al crear (ver DebtFormDialogData) — arrancan
      // deshabilitados hasta que se marca el checkbox correspondiente.
      alreadyInProgress: [false],
      initialPaidInstallments: [{ value: 0, disabled: true }, [Validators.min(0)]],
      initialPaidAmount: [{ value: 0, disabled: true }, [Validators.min(0)]],
    });

    this.form.get('alreadyInProgress')!.valueChanges.subscribe((checked) => {
      const installmentsControl = this.form.get('initialPaidInstallments')!;
      const amountControl = this.form.get('initialPaidAmount')!;
      if (checked) {
        installmentsControl.enable();
        amountControl.enable();
      } else {
        installmentsControl.reset(0);
        amountControl.reset(0);
        installmentsControl.disable();
        amountControl.disable();
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();

    const result: DebtFormResult = {
      name: (raw.name as string).trim(),
      totalAmount: raw.totalAmount,
      totalInstallments: raw.totalInstallments,
      startDate: dateToApiString(raw.startDate),
    };
    if (!this.isEditMode && raw.alreadyInProgress) {
      result.initialPaidInstallments = raw.initialPaidInstallments;
      result.initialPaidAmount = raw.initialPaidAmount;
    }
    this.dialogRef.close(result);
  }
}
