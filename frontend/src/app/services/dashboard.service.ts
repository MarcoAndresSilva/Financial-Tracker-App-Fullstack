import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface WalletSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface ExpenseByCategory {
  name: string;
  value: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  percentageSpent: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  constructor() {} // n oes encesario por que estoy usando el inject, la forma moderna

  // Arma `?walletId=...&year=...&month=...`; year/month solo van si se pasan.
  private walletParams(
    walletId: string,
    period?: { year: number; month: number }
  ): HttpParams {
    let params = new HttpParams().set('walletId', walletId);
    if (period) {
      params = params
        .set('year', String(period.year))
        .set('month', String(period.month));
    }
    return params;
  }

  getWalletSummary(walletId: string) {
    return this.http.get<WalletSummary>(`${this.apiUrl}/dashboard/summary`, {
      params: this.walletParams(walletId),
    });
  }

  // Sin `period` → todo el histórico de la cartera; con `period` → solo ese mes.
  getExpensesByCategory(
    walletId: string,
    period?: { year: number; month: number }
  ) {
    return this.http.get<ExpenseByCategory[]>(
      `${this.apiUrl}/dashboard/expenses-by-category`,
      { params: this.walletParams(walletId, period) }
    );
  }

  getIncomeByCategory(
    walletId: string,
    period?: { year: number; month: number }
  ) {
    return this.http.get<ExpenseByCategory[]>(
      `${this.apiUrl}/dashboard/income-by-category`,
      { params: this.walletParams(walletId, period) }
    );
  }

  // Sin `period` → mes en curso; con `period` → el mes pedido.
  getMonthlySummary(
    walletId: string,
    period?: { year: number; month: number }
  ) {
    return this.http.get<MonthlySummary>(
      `${this.apiUrl}/dashboard/monthly-summary`,
      { params: this.walletParams(walletId, period) }
    );
  }
}
