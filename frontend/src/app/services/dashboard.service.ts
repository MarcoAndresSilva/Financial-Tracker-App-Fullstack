import { HttpClient } from '@angular/common/http';
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

  getWalletSummary(walletId: string) {
    return this.http.get<WalletSummary>(
      `${this.apiUrl}/dashboard/summary?walletId=${walletId}`
    );
  }

  getExpensesByCategory(walletId: string) {
    return this.http.get<ExpenseByCategory[]>(
      `${this.apiUrl}/dashboard/expenses-by-category?walletId=${walletId}`
    );
  }

  getIncomeByCategory(walletId: string) {
    return this.http.get<ExpenseByCategory[]>(
      `${this.apiUrl}/dashboard/income-by-category?walletId=${walletId}`
    );
  }

  getMonthlySummary(walletId: string) {
    return this.http.get<MonthlySummary>(
      `${this.apiUrl}/dashboard/monthly-summary?walletId=${walletId}`
    );
  }
}
