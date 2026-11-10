import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../../user/types/user.types';
import { environment } from '../../../environments/environment';

// interface para la respuesta de la autenticación para tener tipado fuerte
interface AuthResponse {
  access_token: string;
}

interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(credentials: {
    email: string;
    password: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/signin`, credentials)
      .pipe(
        tap((response) => {
          localStorage.setItem('access_token', response.access_token);
        })
      );
  }

  logout(): void {
    localStorage.removeItem('access_token');
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiUrl}/auth/forgot-password`,
      { email }
    );
  }

  resetPassword(
    token: string,
    newPassword: string
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiUrl}/auth/reset-password`,
      { token, newPassword }
    );
  }

  // El backend invalida el token con que se hizo el cambio y devuelve uno
  // nuevo: se guarda igual que en el login para que esta sesión siga activa.
  changePassword(
    currentPassword: string,
    newPassword: string
  ): Observable<AuthResponse> {
    return this.http
      .patch<AuthResponse>(`${this.apiUrl}/auth/password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        tap((response) => {
          localStorage.setItem('access_token', response.access_token);
        })
      );
  }

  // Paso 1 del cambio de email: no cambia nada, manda un link al email nuevo.
  requestEmailChange(
    newEmail: string,
    currentPassword: string
  ): Observable<{ message: string; pendingEmail: string }> {
    return this.http.post<{ message: string; pendingEmail: string }>(
      `${this.apiUrl}/auth/email-change`,
      { newEmail, currentPassword }
    );
  }

  // Paso 2: lo llama la página que abre el link del email (no requiere sesión).
  confirmEmailChange(
    token: string
  ): Observable<{ message: string; email: string }> {
    return this.http.post<{ message: string; email: string }>(
      `${this.apiUrl}/auth/confirm-email`,
      { token }
    );
  }

  signup(credentials: {
    name: string;
    email: string;
    password: string;
  }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/auth/signup`, credentials);
  }
}
