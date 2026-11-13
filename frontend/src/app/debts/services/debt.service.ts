import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Tipos de la API de deudas (Paso 77). El progreso (`progress`) siempre viene
 * calculado por el backend (debt-progress.ts): el front nunca lo recalcula,
 * solo lo muestra. Las fechas llegan como ISO a medianoche UTC ("solo día").
 */
export type DebtKind = 'INSTALLMENTS' | 'FREE_AMOUNT';
export type AmountUnit = 'CLP' | 'UF';

export type InstallmentStatus = 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'PAID';
export type InstallmentValueSource =
  | 'FIXED'
  | 'UF_TODAY'
  | 'LAST_PAYMENT'
  | 'UNKNOWN';

export interface InstallmentProgress {
  paidInstallments: number;
  remainingInstallments: number;
  nextInstallmentNumber: number | null;
  nextDueDate: string | null;
  endDate: string;
  daysUntilDue: number | null;
  status: InstallmentStatus;
  isFinished: boolean;
  percentage: number;
  installmentValueClp: number | null;
  installmentValueSource: InstallmentValueSource;
  remainingAmountClp: number | null;
  paidAmountClp: number;
}

export interface FreeAmountProgress {
  paidAmountClp: number;
  remainingAmountClp: number;
  percentage: number;
  isFinished: boolean;
  status: 'ACTIVE' | 'PAID';
  averageRecentPaymentClp: number | null;
  estimatedEndDate: string | null;
}

interface DebtBase {
  id: string;
  name: string;
  walletId: string;
  /** Subcategoría (dentro de "Deudas") donde se registran sus pagos. */
  subcategoryId: string;
  categoryId: string;
  createdAt: string;
}

export interface InstallmentDebt extends DebtBase {
  kind: 'INSTALLMENTS';
  unit: AmountUnit;
  totalInstallments: number;
  installmentValue: number;
  initialPaidInstallments: number;
  nextDueDateAtStart: string;
  progress: InstallmentProgress;
}

export interface FreeAmountDebt extends DebtBase {
  kind: 'FREE_AMOUNT';
  totalAmount: number;
  initialPaidAmount: number;
  progress: FreeAmountProgress;
}

/** Unión discriminada por `kind`: TypeScript sabe qué `progress` trae cada una. */
export type Debt = InstallmentDebt | FreeAmountDebt;

export interface DebtFormPayload {
  name: string;
  kind?: DebtKind; // solo al crear: el tipo no se cambia después
  // En cuotas
  totalInstallments?: number;
  installmentValue?: number;
  unit?: AmountUnit;
  initialPaidInstallments?: number;
  nextDueDate?: string; // 'YYYY-MM-DD'
  // Monto libre
  totalAmount?: number;
  initialPaidAmount?: number;
}

export type CreateDebtDto = DebtFormPayload & { kind: DebtKind; walletId: string };
export type UpdateDebtDto = Omit<DebtFormPayload, 'kind'>;

@Injectable({
  providedIn: 'root',
})
export class DebtService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getDebtsByWallet(walletId: string) {
    return this.http.get<Debt[]>(`${this.apiUrl}/debts?walletId=${walletId}`);
  }

  createDebt(payload: CreateDebtDto) {
    return this.http.post<Debt>(`${this.apiUrl}/debts`, payload);
  }

  updateDebt(debtId: string, payload: UpdateDebtDto) {
    return this.http.patch<Debt>(`${this.apiUrl}/debts/${debtId}`, payload);
  }

  deleteDebt(debtId: string) {
    return this.http.delete<void>(`${this.apiUrl}/debts/${debtId}`);
  }
}
