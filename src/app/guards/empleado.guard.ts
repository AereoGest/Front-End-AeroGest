import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Auth } from '../services/auth';

/**
 * Protege rutas exclusivas para empleados y administradores (como check-in en mostrador
 * y mis asignaciones), verificando el rol real contra el servidor.
 */
export const empleadoGuard: CanActivateFn = () => {
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
      if (rol === 'ROLE_EMPLEADO' || rol === 'ROLE_ADMIN') {
        return true;
      }
      return router.createUrlTree(['/']);
    })
  );
};
