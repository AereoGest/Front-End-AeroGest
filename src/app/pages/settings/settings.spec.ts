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
});
