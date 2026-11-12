import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { Auth } from '../services/auth';

describe('authGuard', () => {
  let router: Router;
  let authMock: {
    estaAutenticado: () => boolean;
  };

  beforeEach(() => {
    authMock = {
      estaAutenticado: () => false,
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: authMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('permite el acceso cuando el usuario está autenticado válidamente', () => {
    authMock.estaAutenticado = () => true;

    const resultado = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(resultado).toBe(true);
  });

  it('redirige a /login cuando el usuario no está autenticado o el token expiró', () => {
    authMock.estaAutenticado = () => false;

    const resultado = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(resultado instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });
});
