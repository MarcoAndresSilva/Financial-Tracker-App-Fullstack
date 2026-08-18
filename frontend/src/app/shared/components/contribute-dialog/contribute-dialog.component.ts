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

export interface ContributeDialogData {
  goalName: string;
}

@Component({
  selector: 'app-contribute-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './contribute-dialog.component.html',
  styleUrls: ['./contribute-dialog.component.scss'],
})
export class ContributeDialogComponent {
  private fb = inject(FormBuilder);

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<ContributeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ContributeDialogData
  ) {
    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
    });
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value.amount as number);
  }
}
