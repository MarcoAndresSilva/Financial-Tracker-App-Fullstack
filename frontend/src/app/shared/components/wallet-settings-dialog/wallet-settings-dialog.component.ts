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

export interface WalletSettingsDialogData {
  name: string;
  saldoInicial: number;
}

export interface WalletSettingsResult {
  name: string;
  saldoInicial: number;
}

@Component({
  selector: 'app-wallet-settings-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './wallet-settings-dialog.component.html',
  styleUrls: ['./wallet-settings-dialog.component.scss'],
})
export class WalletSettingsDialogComponent {
  private fb = inject(FormBuilder);

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<WalletSettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: WalletSettingsDialogData,
  ) {
    this.form = this.fb.group({
      name: [data.name, [Validators.required]],
      saldoInicial: [
        data.saldoInicial ?? 0,
        [Validators.required, Validators.min(0)],
      ],
    });
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue() as WalletSettingsResult);
  }
}
