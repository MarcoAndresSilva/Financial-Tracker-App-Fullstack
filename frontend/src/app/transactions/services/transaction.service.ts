import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  GetTransactionsFilterDto,
  CreateTransactionDto,
  UpdateTransactionDto,
} from './transaction.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getTransactions(filters: GetTransactionsFilterDto) {
    const cleanFilters: { [key: string]: any } = {};
    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) &&
        filters[key as keyof GetTransactionsFilterDto]
      ) {
        cleanFilters[key] = filters[key as keyof GetTransactionsFilterDto];
      }
    }
    const params = new HttpParams({ fromObject: cleanFilters });
    return this.http.get<any[]>(`${this.apiUrl}/transactions`, { params });
  }

  createTransaction(transactionData: CreateTransactionDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions`, transactionData);
  }

  updateTransaction(
    id: string,
    transactionData: UpdateTransactionDto
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/transactions/${id}`,
      transactionData
    );
  }
}
