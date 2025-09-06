import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { GetTransactionsFilterDto } from './transaction.types';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  // Usaremos un método genérico para obtener las transacciones
  getTransactions(filters: GetTransactionsFilterDto) {
    // Construimos los parámetros de la URL de forma segura
    let params = new HttpParams().set('walletId', filters.walletId);

    if (filters.type) {
      params = params.set('type', filters.type);
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }

    // El tipo de dato 'any' es temporal, lo mejoraremos
    return this.http.get<any[]>(`${this.apiUrl}/transactions`, { params });
  }
}
