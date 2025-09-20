import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  GetTransactionsFilterDto,
  CreateTransactionDto,
  UpdateTransactionDto,
  Transaction,
} from './transaction.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getTransactions(
    filters: GetTransactionsFilterDto
  ): Observable<Transaction[]> {
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
    return this.http.get<Transaction[]>(`${this.apiUrl}/transactions`, {
      params,
    });
  }

  createTransaction(
    transactionData: CreateTransactionDto
  ): Observable<Transaction> {
    return this.http.post<Transaction>(
      `${this.apiUrl}/transactions`,
      transactionData
    );
  }

  updateTransaction(
    id: string,
    transactionData: UpdateTransactionDto
  ): Observable<Transaction> {
    return this.http.patch<Transaction>(
      `${this.apiUrl}/transactions/${id}`,
      transactionData
    );
  }

  deleteTransaction(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/transactions/${id}`
    );
  }
}
