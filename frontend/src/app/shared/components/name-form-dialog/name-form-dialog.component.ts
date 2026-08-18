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

export interface NameFormDialogData {
  title: string;
  label: string;
  initialValue?: string;
}

@Component({
  selector: 'app-name-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './name-form-dialog.component.html',
  styleUrls: ['./name-form-dialog.component.scss'],
})
export class NameFormDialogComponent {
  private fb = inject(FormBuilder);

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<NameFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: NameFormDialogData
  ) {
    this.form = this.fb.group({
      name: [data.initialValue ?? '', [Validators.required]],
    });
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.dialogRef.close((this.form.value.name as string).trim());
  }
}
