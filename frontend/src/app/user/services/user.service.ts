import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { User } from '../types/user.types';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getMe() {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  // Solo el nombre: el email cambia por el flujo verificado de AuthService.
  updateProfile(name: string) {
    return this.http.patch<Pick<User, 'id' | 'email' | 'name'>>(
      `${this.apiUrl}/users/me`,
      { name }
    );
  }
}
