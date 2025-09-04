import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface WalletSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface ExpenseByCategory {
  name: string;
  value: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

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
}
