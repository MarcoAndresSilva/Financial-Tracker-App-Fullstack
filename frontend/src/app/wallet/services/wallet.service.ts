import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Wallet } from '../../user/types/user.types';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  createSharedWallet(payload: {
    name: string;
    inviteEmail: string;
    copyCategoriesFromWalletId?: string;
  }) {
    return this.http.post<Wallet>(`${this.apiUrl}/wallets/shared`, payload);
  }
}
