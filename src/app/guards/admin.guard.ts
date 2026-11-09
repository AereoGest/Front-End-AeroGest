import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Auth } from '../services/auth';

/**
 * Protege rutas exclusivas para administradores verificando el rol real
 * contra GET /api/auth/perfil en el servidor (nunca confía en localStorage).
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(Auth);

  if (!auth.estaAutenticado()) {
    return router.createUrlTree(['/login']);
  }

  return auth.sincronizarRolDesdeServidor().pipe(
    map((rol) => {
      if (!auth.estaAutenticado()) {
        return router.createUrlTree(['/login']);
      }
      if (rol === 'ROLE_ADMIN') {
        return true;
      }
      return router.createUrlTree(['/']);
    })
  );
};
