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

export interface SavingsGoalFormDialogData {
  initialName?: string;
  initialTargetAmount?: number;
}

export interface SavingsGoalFormResult {
  name: string;
  targetAmount: number;
}

@Component({
  selector: 'app-savings-goal-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './savings-goal-form-dialog.component.html',
  styleUrls: ['./savings-goal-form-dialog.component.scss'],
})
export class SavingsGoalFormDialogComponent {
  private fb = inject(FormBuilder);

  isEditMode: boolean;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<SavingsGoalFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SavingsGoalFormDialogData
  ) {
    this.isEditMode = data.initialName !== undefined;
    this.form = this.fb.group({
      name: [data.initialName ?? '', [Validators.required]],
      targetAmount: [
        data.initialTargetAmount ?? null,
        [Validators.required, Validators.min(1)],
      ],
    });
  }

  onSave(): void {
    if (this.form.invalid) return;
    const result: SavingsGoalFormResult = {
      name: (this.form.value.name as string).trim(),
      targetAmount: this.form.value.targetAmount as number,
    };
    this.dialogRef.close(result);
  }
}
