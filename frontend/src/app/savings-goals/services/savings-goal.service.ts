import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

@Injectable({
  providedIn: 'root',
})
export class SavingsGoalService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getSavingsGoalsByWallet(walletId: string) {
    return this.http.get<SavingsGoal[]>(
      `${this.apiUrl}/savings-goals?walletId=${walletId}`
    );
  }

  createSavingsGoal(payload: {
    name: string;
    targetAmount: number;
    walletId: string;
  }) {
    return this.http.post<SavingsGoal>(`${this.apiUrl}/savings-goals`, payload);
  }

  updateSavingsGoal(
    goalId: string,
    payload: { name?: string; targetAmount?: number }
  ) {
    return this.http.patch<SavingsGoal>(
      `${this.apiUrl}/savings-goals/${goalId}`,
      payload
    );
  }

  contribute(goalId: string, amount: number) {
    return this.http.post<SavingsGoal>(
      `${this.apiUrl}/savings-goals/${goalId}/contributions`,
      { amount }
    );
  }

  deleteSavingsGoal(goalId: string) {
    return this.http.delete<void>(`${this.apiUrl}/savings-goals/${goalId}`);
  }
}
