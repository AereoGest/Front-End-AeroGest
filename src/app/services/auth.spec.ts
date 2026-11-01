import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';
import { AuthResponse } from '../Models/Perfil';

describe('Auth Service', () => {
  let service: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [Auth, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('guardarSesion almacena token, email, userId, perfilCompleto, role e isVerified', () => {
    const mockResponse: AuthResponse = {
      token: 'jwt.sample.token',
      email: 'user@aerogest.com',
      userId: 5,
      perfilCompleto: true,
      requires2fa: false,
      role: 'ROLE_USUARIO',
      isVerified: true,
    };

    service.guardarSesion(mockResponse);

    expect(localStorage.getItem('token')).toBe('jwt.sample.token');
    expect(localStorage.getItem('email')).toBe('user@aerogest.com');
    expect(localStorage.getItem('userId')).toBe('5');
    expect(localStorage.getItem('perfilCompleto')).toBe('true');
    expect(localStorage.getItem('role')).toBe('ROLE_USUARIO');
    expect(localStorage.getItem('isVerified')).toBe('true');
    expect(service.estaAutenticado()).toBe(true);
    expect(service.estaVerificado()).toBe(true);
    expect(service.getRole()).toBe('ROLE_USUARIO');
  });

  it('cerrarSesion limpia el almacenamiento local y el estado reactivo', () => {
    localStorage.setItem('token', 'sample');
    localStorage.setItem('email', 'a@a.com');
    localStorage.setItem('isVerified', 'true');

    service.cerrarSesion();

    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush('OK');

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('email')).toBeNull();
    expect(localStorage.getItem('isVerified')).toBeNull();
    expect(service.estaAutenticado()).toBe(false);
  });

  it('reenviarVerificacion envía petición POST con el email correspondiente', () => {
    service.reenviarVerificacion('test@aerogest.com').subscribe((res) => {
      expect(res.message).toBe('Email enviado');
    });

    const req = httpMock.expectOne('/api/auth/resend-verification');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@aerogest.com' });
    req.flush({ message: 'Email enviado' });
  });
});
