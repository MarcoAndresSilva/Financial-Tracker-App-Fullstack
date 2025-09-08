import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface Subcategory {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubcategoryService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  getSubcategoriesByCategory(categoryId: string) {
    return this.http.get<Subcategory[]>(
      `${this.apiUrl}/subcategories?categoryId=${categoryId}`
    );
  }
}
