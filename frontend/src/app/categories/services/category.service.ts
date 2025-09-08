import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

// Definimos un tipo para la categoría
export interface Category {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getCategoriesByWallet(walletId: string) {
    return this.http.get<Category[]>(
      `${this.apiUrl}/categories?walletId=${walletId}`
    );
  }
}
