import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MATERIAL_MODULES } from '../../material/material.module';
import { WalletContextService } from '../../../core/services/wallet-context.service';

export interface CreateSharedWalletResult {
  name: string;
  inviteEmail: string;
  copyCategoriesFromWalletId?: string;
}

@Component({
  selector: 'app-create-shared-wallet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    ...MATERIAL_MODULES,
  ],
  templateUrl: './create-shared-wallet-dialog.component.html',
  styleUrls: ['./create-shared-wallet-dialog.component.scss'],
})
export class CreateSharedWalletDialogComponent {
  private fb = inject(FormBuilder);
  private walletContext = inject(WalletContextService);

  userWallets$ = this.walletContext.userWallets$;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<CreateSharedWalletDialogComponent>
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      inviteEmail: ['', [Validators.required, Validators.email]],
      copyCategories: [false],
      sourceWalletId: [{ value: null, disabled: true }],
    });

    this.form.get('copyCategories')!.valueChanges.subscribe((checked) => {
      const sourceControl = this.form.get('sourceWalletId')!;
      if (checked) {
        sourceControl.enable();
        sourceControl.setValidators(Validators.required);
      } else {
        sourceControl.disable();
        sourceControl.clearValidators();
        sourceControl.setValue(null);
      }
      sourceControl.updateValueAndValidity();
    });
  }

  onSave(): void {
    if (this.form.invalid) return;
    const { name, inviteEmail, copyCategories, sourceWalletId } =
      this.form.getRawValue();

    const result: CreateSharedWalletResult = {
      name: (name as string).trim(),
      inviteEmail: (inviteEmail as string).trim(),
      ...(copyCategories && sourceWalletId
        ? { copyCategoriesFromWalletId: sourceWalletId as string }
        : {}),
    };
    this.dialogRef.close(result);
  }
}
