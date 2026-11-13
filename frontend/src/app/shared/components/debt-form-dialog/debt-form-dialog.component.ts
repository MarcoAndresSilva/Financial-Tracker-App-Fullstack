import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MATERIAL_MODULES } from '../../material/material.module';
import {
  Debt,
  DebtFormPayload,
  DebtKind,
} from '../../../debts/services/debt.service';
import {
  addMonthsToIsoDay,
  formatMonthYear,
  formatShortDay,
  isoDay,
} from '../../utils/date.util';

export interface DebtFormDialogData {
  /** Presente = editar; ausente = crear. */
  debt?: Debt;
}

export type DebtFormResult = DebtFormPayload;

interface DueOption {
  iso: string;
  label: string;
}

const INSTALLMENT_FIELDS = [
  'unit',
  'installmentValue',
  'totalInstallments',
  'initialPaidInstallments',
  'dueDay',
  'nextDueDate',
] as const;
const FREE_AMOUNT_FIELDS = ['totalAmount', 'initialPaidAmount'] as const;

/** Las cuotas ya pagadas no pueden superar el total (mismo criterio que la API). */
function paidWithinTotal(group: AbstractControl): ValidationErrors | null {
  const total = group.get('totalInstallments')?.value;
  const paid = group.get('initialPaidInstallments')?.value;
  return total != null && paid != null && paid > total
    ? { paidOverTotal: true }
    : null;
}

/**
 * Formulario de deuda en el lenguaje en que la informan bancos y casas
 * comerciales (Paso 78): "cuota de UF 8,44, 300 cuotas, voy en la 41, vence el
 * día 1". La fecha de la próxima cuota no se tipea (el datepicker nativo lee
 * "01-12-2026" como 12 de enero): se pide el día del mes y se ofrecen las dos
 * fechas posibles, con la más probable ya elegida.
 */
@Component({
  selector: 'app-debt-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, ...MATERIAL_MODULES],
  templateUrl: './debt-form-dialog.component.html',
  styleUrls: ['./debt-form-dialog.component.scss'],
})
export class DebtFormDialogComponent {
  private fb = inject(FormBuilder);

  readonly isEditMode: boolean;
  readonly form: FormGroup;
  dueOptions: DueOption[] = [];

  constructor(
    public dialogRef: MatDialogRef<DebtFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DebtFormDialogData,
  ) {
    const debt = data.debt;
    this.isEditMode = !!debt;
    const installments = debt?.kind === 'INSTALLMENTS' ? debt : undefined;
    const free = debt?.kind === 'FREE_AMOUNT' ? debt : undefined;

    this.form = this.fb.group(
      {
        kind: [{ value: debt?.kind ?? 'INSTALLMENTS', disabled: this.isEditMode }],
        name: [debt?.name ?? '', Validators.required],
        // En cuotas
        unit: [installments?.unit ?? 'CLP'],
        installmentValue: [
          installments?.installmentValue ?? null,
          [Validators.required, Validators.min(0.01)],
        ],
        totalInstallments: [
          installments?.totalInstallments ?? null,
          [Validators.required, Validators.min(1)],
        ],
        initialPaidInstallments: [
          installments?.initialPaidInstallments ?? 0,
          [Validators.required, Validators.min(0)],
        ],
        dueDay: [
          installments
            ? Number(installments.nextDueDateAtStart.slice(8, 10))
            : null,
          [Validators.required, Validators.min(1), Validators.max(31)],
        ],
        nextDueDate: [
          installments?.nextDueDateAtStart.slice(0, 10) ?? null,
          Validators.required,
        ],
        // Monto libre
        totalAmount: [free?.totalAmount ?? null, [Validators.required, Validators.min(1)]],
        initialPaidAmount: [free?.initialPaidAmount ?? 0, [Validators.min(0)]],
      },
      { validators: paidWithinTotal },
    );

    this.applyKind(this.form.get('kind')!.value);
    this.form.get('kind')!.valueChanges.subscribe((kind: DebtKind) =>
      this.applyKind(kind),
    );
    this.form.get('dueDay')!.valueChanges.subscribe(() => this.onDueDayChange());
  }

  get kind(): DebtKind {
    return this.form.get('kind')!.value;
  }

  get unit(): 'CLP' | 'UF' {
    return this.form.get('unit')!.value;
  }

  /**
   * Resumen en vivo (solo al crear): "Próxima: cuota 42 de 300 · te quedan 259
   * cuotas · terminas en junio 2048". Así se ve si algo no cuadra antes de
   * guardar.
   */
  get installmentsPreview(): {
    nextNumber: number;
    total: number;
    remaining: number;
    endLabel: string;
  } | null {
    const { totalInstallments: total, initialPaidInstallments: paid, nextDueDate } =
      this.form.getRawValue();
    if (!total || paid == null || paid >= total || !nextDueDate) return null;
    return {
      nextNumber: paid + 1,
      total,
      remaining: total - paid,
      endLabel: formatMonthYear(addMonthsToIsoDay(nextDueDate, total - paid - 1), true),
    };
  }

  get freeAmountRemaining(): number | null {
    const { totalAmount, initialPaidAmount } = this.form.getRawValue();
    if (!totalAmount) return null;
    return Math.max(0, totalAmount - (initialPaidAmount ?? 0));
  }

  onSave(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const name = (raw.name as string).trim();

    const result: DebtFormResult =
      raw.kind === 'INSTALLMENTS'
        ? {
            name,
            unit: raw.unit,
            installmentValue: raw.installmentValue,
            totalInstallments: raw.totalInstallments,
            initialPaidInstallments: raw.initialPaidInstallments,
            nextDueDate: raw.nextDueDate,
          }
        : {
            name,
            totalAmount: raw.totalAmount,
            initialPaidAmount: raw.initialPaidAmount ?? 0,
          };
    if (!this.isEditMode) result.kind = raw.kind;
    this.dialogRef.close(result);
  }

  /** Solo se validan (y se envían) los campos del tipo elegido. */
  private applyKind(kind: DebtKind): void {
    const [on, off] =
      kind === 'INSTALLMENTS'
        ? [INSTALLMENT_FIELDS, FREE_AMOUNT_FIELDS]
        : [FREE_AMOUNT_FIELDS, INSTALLMENT_FIELDS];
    on.forEach((f) => this.form.get(f)!.enable({ emitEvent: false }));
    off.forEach((f) => this.form.get(f)!.disable({ emitEvent: false }));
  }

  /**
   * Al crear: ofrece este mes y el siguiente con ese día, y elige el más
   * probable (si el día ya pasó este mes, el siguiente). Al editar: solo cambia
   * el día, manteniendo el mes de la cuota registrada.
   */
  private onDueDayChange(): void {
    const day = Number(this.form.get('dueDay')!.value);
    const nextDueDate = this.form.get('nextDueDate')!;
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      this.dueOptions = [];
      nextDueDate.setValue(null);
      return;
    }

    if (this.isEditMode) {
      const [y, m] = (nextDueDate.value as string).split('-').map(Number);
      nextDueDate.setValue(isoDay(y, m - 1, day));
      return;
    }

    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    this.dueOptions = [isoDay(y, m, day), isoDay(y, m + 1, day)].map((iso) => ({
      iso,
      label: formatShortDay(iso),
    }));
    nextDueDate.setValue(
      day >= today.getDate() ? this.dueOptions[0].iso : this.dueOptions[1].iso,
    );
  }
}
