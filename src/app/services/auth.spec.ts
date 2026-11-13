import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth, decodificarToken, esTokenExpirado } from './auth';
import { AuthResponse } from '../Models/Perfil';

function crearJwtMock(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadBase64 = btoa(JSON.stringify(payload));
  return `${header}.${payloadBase64}.signature`;
}

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

  it('decodificarToken extrae correctamente los claims del token en base64url', () => {
    const jwt = crearJwtMock({
      sub: 'test@aerogest.com',
      userId: 42,
      role: 'ROLE_ADMIN',
      isVerified: true,
      perfilCompleto: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const payload = decodificarToken(jwt);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('test@aerogest.com');
    expect(payload?.userId).toBe(42);
    expect(payload?.role).toBe('ROLE_ADMIN');
    expect(payload?.isVerified).toBe(true);
    expect(payload?.perfilCompleto).toBe(true);
  });

  it('esTokenExpirado detecta tokens vencidos correctamente', () => {
    const expirado = { exp: Math.floor(Date.now() / 1000) - 60 };
    const valido = { exp: Math.floor(Date.now() / 1000) + 3600 };

    expect(esTokenExpirado(expirado)).toBe(true);
    expect(esTokenExpirado(valido)).toBe(false);
    expect(esTokenExpirado(null)).toBe(false);
  });

  it('guardarSesion almacena únicamente el token en localStorage y jamás expone email, userId, isVerified ni role', () => {
    const validJwt = crearJwtMock({
      sub: 'user@aerogest.com',
      userId: 5,
      role: 'ROLE_USUARIO',
      isVerified: true,
      perfilCompleto: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const mockResponse: AuthResponse = {
      token: validJwt,
      email: 'user@aerogest.com',
      userId: 5,
      perfilCompleto: true,
      requires2fa: false,
      role: 'ROLE_USUARIO',
      isVerified: true,
    };

    service.guardarSesion(mockResponse);

    // Solo el token debe existir en localStorage
    expect(localStorage.getItem('token')).toBe(validJwt);
    expect(localStorage.getItem('email')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('perfilCompleto')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();
    expect(localStorage.getItem('isVerified')).toBeNull();

    // El estado reactivo en memoria refleja los datos seguros
    expect(service.estaAutenticado()).toBe(true);
    expect(service.estaVerificado()).toBe(true);
    expect(service.emailUsuario()).toBe('user@aerogest.com');
    expect(service.userId()).toBe(5);
    expect(service.getRole()).toBe('ROLE_USUARIO');
    expect(service.rolUsuario()).toBe('ROLE_USUARIO');
    expect(service.esAdmin()).toBe(false);
  });

  it('no confía en un rol o isVerified manipulados manualmente en localStorage', () => {
    const validJwt = crearJwtMock({
      sub: 'user@aerogest.com',
      userId: 5,
      role: 'ROLE_USUARIO',
      isVerified: false,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    localStorage.setItem('token', validJwt);
    localStorage.setItem('role', 'ROLE_ADMIN');
    localStorage.setItem('isVerified', 'true');

    // Al reconfigurar el módulo para instanciar el servicio con el token ya existente
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [Auth, provideHttpClient(), provideHttpClientTesting()],
    });
    const nuevoServicio = TestBed.inject(Auth);
    expect(nuevoServicio.getRole()).toBe('ROLE_USUARIO');
    expect(nuevoServicio.esAdmin()).toBe(false);
    expect(nuevoServicio.estaVerificado()).toBe(false);

    // Las claves manipuladas son purgadas de localStorage
    expect(localStorage.getItem('role')).toBeNull();
    expect(localStorage.getItem('isVerified')).toBeNull();
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

  it('setupTotp solicita inicialización TOTP al backend', () => {
    service.setupTotp().subscribe((res) => {
      expect(res.secret).toBe('BASE32SECRET');
      expect(res.qrCodeUrl).toContain('create-qr-code');
    });

    const req = httpMock.expectOne('/api/auth/2fa/totp/setup');
    expect(req.request.method).toBe('GET');
    req.flush({
      secret: 'BASE32SECRET',
      otpauthUrl: 'otpauth://totp/AeroGest:test@aerogest.com?secret=BASE32SECRET',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?data=otpauth',
    });
  });

  it('activarTotp envía clave y código para habilitar el autenticador móvil', () => {
    service.activarTotp('BASE32SECRET', '123456').subscribe((res) => {
      expect(res).toBe('Autenticador activado');
    });

    const req = httpMock.expectOne('/api/auth/2fa/totp/activar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ secret: 'BASE32SECRET', code: '123456' });
    req.flush('Autenticador activado');
  });

  it('desactivarTotp envía solicitud para inhabilitar el autenticador móvil', () => {
    service.desactivarTotp().subscribe((res) => {
      expect(res).toBe('Autenticador desactivado');
    });

    const req = httpMock.expectOne('/api/auth/2fa/totp/desactivar');
    expect(req.request.method).toBe('POST');
    req.flush('Autenticador desactivado');
  });
});
