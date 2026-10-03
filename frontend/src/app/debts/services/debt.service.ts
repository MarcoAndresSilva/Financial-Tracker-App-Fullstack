import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

// El progreso (paidInstallments, paidAmount, remainingAmount, percentage,
// isFinished, estimatedEndDate) siempre viene calculado por el backend a
// partir de los pagos vinculados (ver Paso 60) — el front nunca lo recalcula
// ni lo guarda, solo lo muestra.
export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  totalInstallments: number;
  initialPaidInstallments: number;
  initialPaidAmount: number;
  startDate: string;
  walletId: string;
  paidInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  remainingInstallments: number;
  percentage: number;
  isFinished: boolean;
  estimatedEndDate: string;
}

export interface CreateDebtDto {
  name: string;
  totalAmount: number;
  totalInstallments: number;
  startDate: string; // 'YYYY-MM-DD'
  // Cuotas/plata ya pagadas antes de trackearla en FinTrack (deuda a mitad de
  // camino). Se omiten al editar: son un punto de partida que se declara una
  // sola vez, no algo que se ajuste después.
  initialPaidInstallments?: number;
  initialPaidAmount?: number;
  walletId: string;
}

export type UpdateDebtDto = Partial<Omit<CreateDebtDto, 'walletId'>>;

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
