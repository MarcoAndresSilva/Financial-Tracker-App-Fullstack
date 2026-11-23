import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Tipos y llamadas de la API del presupuesto (Paso 81). Este service es
 * agnóstico: solo habla HTTP, no sabe de pantallas. Todo el cálculo (qué monto
 * aplica, colores, compromisos, sin asignar) viene hecho desde el backend.
 */
export type BudgetScope = 'FROM_MONTH' | 'ONLY_MONTH';
export type BudgetStatus = 'OK' | 'WARNING' | 'OVER';
export type BudgetSource = 'MONTH_ADJUSTMENT' | 'RECURRING' | 'NONE';

export interface BudgetStatusResult {
  status: BudgetStatus;
  percentage: number | null;
  remaining: number;
}

export interface BudgetLine {
  categoryId: string;
  name: string;
  budget: number | null;
  source: BudgetSource;
  spent: number;
  status: BudgetStatusResult | null;
}

export interface CommitmentItem {
  name: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  amountClp: number | null;
  estimated: boolean;
  dueDate: string | null;
  paid: boolean;
}

export interface BudgetPlan {
  year: number;
  month: number;
  summary: {
    income: number;
    debtCommitments: number;
    totalPlanned: number;
    totalSpent: number;
    unassigned: number;
    overall: BudgetStatusResult | null;
    unbudgetedCount: number;
    unbudgetedSpent: number;
  };
  categories: BudgetLine[];
  commitments: {
    items: CommitmentItem[];
    totalClp: number;
    paidCount: number;
    totalCount: number;
    withoutEstimate: number;
  };
}

export interface UpsertBudgetEntryDto {
  categoryId: string;
  year: number;
  month: number;
  scope: BudgetScope;
  amount: number | null; // null = quitar el presupuesto
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getPlan(walletId: string, year: number, month: number) {
    return this.http.get<BudgetPlan>(`${this.apiUrl}/budget`, {
      params: { walletId, year, month },
    });
  }

  upsertEntry(dto: UpsertBudgetEntryDto) {
    return this.http.put(`${this.apiUrl}/budget/entries`, dto);
  }
}
