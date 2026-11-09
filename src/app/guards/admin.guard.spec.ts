import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { adminGuard } from './admin.guard';
import { Auth } from '../services/auth';
import { Rol } from '../Models/Perfil';

describe('adminGuard', () => {
  let router: Router;
  let authMock: {
    estaAutenticado: () => boolean;
    sincronizarRolDesdeServidor: () => Observable<Rol | null>;
  };

  beforeEach(() => {
    authMock = {
      estaAutenticado: () => false,
      sincronizarRolDesdeServidor: () => of(null),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: authMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('redirige a /login cuando el usuario no está autenticado', () => {
    authMock.estaAutenticado = () => false;

    const resultado = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, {} as any)
    );

    expect(resultado instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });

  it('redirige a / cuando el usuario autenticado no tiene rol ROLE_ADMIN en el servidor', () => {
    authMock.estaAutenticado = () => true;
    authMock.sincronizarRolDesdeServidor = () => of('ROLE_USUARIO');

    let resultadoFinal: unknown;
    const obs = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, {} as any)
    ) as Observable<boolean | UrlTree>;

    obs.subscribe((res) => {
      resultadoFinal = res;
    });

    expect(resultadoFinal instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(resultadoFinal as UrlTree)).toBe('/');
  });

  it('permite el acceso cuando el servidor confirma ROLE_ADMIN', () => {
    authMock.estaAutenticado = () => true;
    authMock.sincronizarRolDesdeServidor = () => of('ROLE_ADMIN');

    let resultadoFinal: unknown;
    const obs = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, {} as any)
    ) as Observable<boolean | UrlTree>;

    obs.subscribe((res) => {
      resultadoFinal = res;
    });

    expect(resultadoFinal).toBe(true);
  });
});
