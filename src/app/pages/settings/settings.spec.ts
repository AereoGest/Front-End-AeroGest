import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Settings } from './settings';
import { I18nService } from '../../services/i18n';
import { ThemeService } from '../../services/theme';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;
  let httpMock: HttpTestingController;
  let i18n: I18nService;
  let theme: ThemeService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    i18n = TestBed.inject(I18nService);
    theme = TestBed.inject(ThemeService);

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/auth/perfil');
    req.flush({
      id: 1,
      email: 'test@aerogest.com',
      twoFactorEnabled: false,
    });

    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('debería crearse y cargar el estado del perfil', () => {
    expect(component).toBeTruthy();
    expect(component['perfil']()?.twoFactorEnabled).toBe(false);
  });

  it('permite cambiar el idioma y la tonalidad', () => {
    i18n.setLang('en');
    expect(i18n.currentLang()).toBe('en');

    theme.set('dark');
    expect(theme.isDark()).toBe(true);

    theme.set('light');
    expect(theme.isDark()).toBe(false);
  });

  it('permite alternar el 2FA enviando petición al backend', () => {
    component.toggleDosFactores();

    const req = httpMock.expectOne('/api/auth/toggle-2fa');
    expect(req.request.method).toBe('POST');
    req.flush('2FA habilitado');

    const reqReload = httpMock.expectOne('/api/auth/perfil');
    reqReload.flush({
      id: 1,
      email: 'test@aerogest.com',
      twoFactorEnabled: true,
    });

    expect(component['mensajeExito']()).toBe('2FA habilitado');
  });

  it('toggleTotp cuando está desactivado abre el modal y solicita setup TOTP', () => {
    component.toggleTotp();

    const req = httpMock.expectOne('/api/auth/2fa/totp/setup');
    expect(req.request.method).toBe('GET');
    req.flush({
      secret: 'SECRETBASE32ABCDEF',
      otpauthUrl: 'otpauth://totp/AeroGest:test@aerogest.com?secret=SECRETBASE32ABCDEF',
      qrCodeUrl: 'https://api.qrserver.com/qr.png',
    });

    expect(component['modalTotpAbierto']()).toBe(true);
    expect(component['totpSetupData']()?.secret).toBe('SECRETBASE32ABCDEF');
  });

  it('confirmarYActivarTotp valida el código de 6 dígitos y activa TOTP', () => {
    component['totpSetupData'].set({
      secret: 'SECRETBASE32ABCDEF',
      otpauthUrl: 'otpauth://...',
      qrCodeUrl: 'https://...',
    });
    component['modalTotpAbierto'].set(true);
    component['codigoTotp'].set('123456');

    component.confirmarYActivarTotp();

    const req = httpMock.expectOne('/api/auth/2fa/totp/activar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ secret: 'SECRETBASE32ABCDEF', code: '123456' });
    req.flush('Autenticador móvil activado exitosamente.');

    const reqReload = httpMock.expectOne('/api/auth/perfil');
    reqReload.flush({
      id: 1,
      email: 'test@aerogest.com',
      twoFactorEnabled: false,
      totpEnabled: true,
    });

    expect(component['modalTotpAbierto']()).toBe(false);
    expect(component['mensajeExito']()).toContain('Autenticador móvil activado');
  });

  it('toggleTotp cuando está activado envía petición de desactivación', () => {
    component['perfil'].set({
      personaId: 1,
      nombre: 'Juan',
      apellido: 'Perez',
      email: 'test@aerogest.com',
      telefono: '123',
      numeroIdentificador: null,
      identificador: null,
      fechaNacimiento: null,
      sexo: null,
      twoFactorEnabled: false,
      totpEnabled: true,
      isVerified: true,
      role: 'ROLE_USUARIO',
    });

    component.toggleTotp();

    const req = httpMock.expectOne('/api/auth/2fa/totp/desactivar');
    expect(req.request.method).toBe('POST');
    req.flush('Autenticador móvil desactivado exitosamente.');

    const reqReload = httpMock.expectOne('/api/auth/perfil');
    reqReload.flush({
      id: 1,
      email: 'test@aerogest.com',
      twoFactorEnabled: false,
      totpEnabled: false,
    });

    expect(component['mensajeExito']()).toContain('Autenticador móvil desactivado');
  });
});
