import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  GetTransactionsFilterDto,
  CreateTransactionDto,
} from './transaction.types';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getTransactions(filters: GetTransactionsFilterDto) {
    // 1. Creamos un objeto para limpiar los filtros.
    // Usamos un tipo genérico para que TypeScript no se queje.
    const cleanFilters: { [key: string]: any } = {};

    // 2. Iteramos sobre las claves del objeto de filtros que recibimos.
    for (const key in filters) {
      // Comprobamos si la propiedad pertenece al objeto y si su valor NO es null o undefined.
      if (
        Object.prototype.hasOwnProperty.call(filters, key) &&
        filters[key as keyof GetTransactionsFilterDto]
      ) {
        // Si el filtro es válido, lo añadimos al objeto 'cleanFilters'.
        cleanFilters[key] = filters[key as keyof GetTransactionsFilterDto];
      }
    }

    // 3. Creamos los HttpParams a partir de nuestro objeto de filtros ya limpio.
    // HttpParams se encargará de formatear la URL correctamente (ej. /transactions?walletId=...&categoryId=...).
    const params = new HttpParams({ fromObject: cleanFilters });

    // 4. Hacemos la petición GET con los parámetros construidos.
    // Usamos 'any' como tipo de respuesta por ahora, pero podríamos crear una interfaz 'Transaction' detallada.
    return this.http.get<any[]>(`${this.apiUrl}/transactions`, { params });
  }

  createTransaction(transactionData: CreateTransactionDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/transactions`, transactionData);
  }
}
