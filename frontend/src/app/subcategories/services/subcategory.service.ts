import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface Subcategory {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubcategoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getSubcategoriesByCategory(categoryId: string) {
    return this.http.get<Subcategory[]>(
      `${this.apiUrl}/subcategories?categoryId=${categoryId}`
    );
  }

  createSubcategory(payload: { name: string; categoryId: string }) {
    return this.http.post<Subcategory>(
      `${this.apiUrl}/subcategories`,
      payload
    );
  }

  updateSubcategory(subcategoryId: string, payload: { name: string }) {
    return this.http.patch<Subcategory>(
      `${this.apiUrl}/subcategories/${subcategoryId}`,
      payload
    );
  }

  deleteSubcategory(subcategoryId: string) {
    return this.http.delete<void>(
      `${this.apiUrl}/subcategories/${subcategoryId}`
    );
  }
}
