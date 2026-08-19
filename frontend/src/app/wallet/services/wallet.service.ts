import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Wallet } from '../../user/types/user.types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  createSharedWallet(payload: {
    name: string;
    inviteEmail: string;
    copyCategoriesFromWalletId?: string;
  }) {
    return this.http.post<Wallet>(`${this.apiUrl}/wallets/shared`, payload);
  }
}
