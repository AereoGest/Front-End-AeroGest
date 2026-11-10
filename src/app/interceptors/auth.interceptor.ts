import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';
import { I18nService } from '../services/i18n';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(Auth);
  const i18n = inject(I18nService);
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Accept-Language': i18n.currentLang()
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const authReq = req.clone({ setHeaders: headers });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.error && typeof error.error === 'object' && typeof error.error.message === 'string') {
        error.error.message = i18n.translateBackendMessage(error.error.message);
      } else if (typeof error.error === 'string') {
        try {
          const parsed = JSON.parse(error.error);
          if (parsed && typeof parsed.message === 'string') {
            parsed.message = i18n.translateBackendMessage(parsed.message);
            error = new HttpErrorResponse({
              error: parsed,
              headers: error.headers,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined
            });
          }
        } catch {
          error = new HttpErrorResponse({
            error: i18n.translateBackendMessage(error.error),
            headers: error.headers,
            status: error.status,
            statusText: error.statusText,
            url: error.url ?? undefined
          });
        }
      }

      if (error.status === 401 && !req.url.includes('/api/auth/login')) {
        auth.invalidarSesionLocal();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
