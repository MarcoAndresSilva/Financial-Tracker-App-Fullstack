import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Wallet } from '../../user/types/user.types';
import { environment } from '../../../environments/environment';

export interface MyWallet extends Wallet {
  role: 'OWNER' | 'MEMBER';
  transactionCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getMyWallets() {
    return this.http.get<MyWallet[]>(`${this.apiUrl}/wallets`);
  }

  createSharedWallet(payload: {
    name: string;
    inviteEmail: string;
    copyCategoriesFromWalletId?: string;
  }) {
    return this.http.post<Wallet>(`${this.apiUrl}/wallets/shared`, payload);
  }

  deleteWallet(walletId: string) {
    return this.http.delete<void>(`${this.apiUrl}/wallets/${walletId}`);
  }
}
