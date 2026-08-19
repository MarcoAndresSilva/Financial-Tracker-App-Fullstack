import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

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
  private apiUrl = environment.apiUrl;

  getCategoriesByWallet(walletId: string) {
    return this.http.get<Category[]>(
      `${this.apiUrl}/categories?walletId=${walletId}`
    );
  }

  createCategory(payload: { name: string; walletId: string }) {
    return this.http.post<Category>(`${this.apiUrl}/categories`, payload);
  }

  updateCategory(categoryId: string, payload: { name: string }) {
    return this.http.patch<Category>(
      `${this.apiUrl}/categories/${categoryId}`,
      payload
    );
  }

  deleteCategory(categoryId: string) {
    return this.http.delete<void>(`${this.apiUrl}/categories/${categoryId}`);
  }
}
