import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Obtenemos el token del localStorage
  const token = localStorage.getItem('access_token');

  // 2. Si no hay token, simplemente dejamos pasar la petición original sin modificarla
  //    (Esto es para peticiones como el login o el registro)
  if (!token) {
    return next(req);
  }

  // 3. Si hay un token, clonamos la petición y le añadimos la cabecera
  const clonedRequest = req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  });

  // 4. Dejamos pasar la nueva petición clonada y con la cabecera
  return next(clonedRequest);
};
