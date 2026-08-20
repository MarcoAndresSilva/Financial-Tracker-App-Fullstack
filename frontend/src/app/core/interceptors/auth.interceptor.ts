import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const notification = inject(NotificationService);

  // 1. Obtenemos el token del localStorage
  const token = localStorage.getItem('access_token');

  // 2. Si no hay token, simplemente dejamos pasar la petición original sin modificarla
  //    (Esto es para peticiones como el login o el registro)
  const request = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  // 3. Si el backend responde 401 con un token que sí mandamos, la sesión ya
  //    no sirve (venció o es inválido): se limpia y se manda a login, en vez
  //    de dejar la app en un estado roto en silencio. Si no había token (ej.
  //    un signin con credenciales incorrectas), el 401 lo maneja el propio
  //    formulario — no es un vencimiento de sesión.
  return next(request).pipe(
    catchError((error) => {
      if (error.status === 401 && token) {
        localStorage.removeItem('access_token');
        notification.error(
          'Tu sesión expiró. Vuelve a iniciar sesión.',
          'Sesión finalizada'
        );
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
