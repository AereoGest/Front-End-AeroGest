import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [I18nService],
    });
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('debería crearse e inicializarse en español por defecto', () => {
    expect(service).toBeTruthy();
    expect(service.currentLang()).toBe('es');
    expect(service.isSpanish()).toBe(true);
    expect(service.isEnglish()).toBe(false);
  });

  it('traduce claves comunes en español correctamente', () => {
    expect(service.t('nav.home')).toBe('Inicio');
    expect(service.t('nav.flights')).toBe('Vuelos');
    expect(service.t('auth.loginBtn')).toBe('Ingresar');
  });

  it('permite cambiar a inglés y traduce reactivamente', () => {
    service.setLang('en');
    expect(service.currentLang()).toBe('en');
    expect(service.isEnglish()).toBe(true);
    expect(service.t('nav.home')).toBe('Home');
    expect(service.t('nav.flights')).toBe('Flights');
    expect(service.t('auth.loginBtn')).toBe('Sign In');
    expect(localStorage.getItem('aerogest-lang')).toBe('en');
  });

  it('toggleLang alterna entre idiomas', () => {
    expect(service.currentLang()).toBe('es');
    service.toggleLang();
    expect(service.currentLang()).toBe('en');
    service.toggleLang();
    expect(service.currentLang()).toBe('es');
  });

  it('interpola parámetros en las traducciones correctamente', () => {
    const res = service.t('Test {name} and {{count}}', { name: 'AeroGest', count: 42 });
    expect(res).toBe('Test AeroGest and 42');
  });

  it('devuelve la clave original si la traducción no existe en ningún diccionario', () => {
    expect(service.t('clave.inexistente')).toBe('clave.inexistente');
  });

  it('traduce mensajes de error del backend según el idioma activo', () => {
    expect(service.translateBackendMessage('Email o contraseña incorrectos')).toBe('Email o contraseña incorrectos');
    service.setLang('en');
    expect(service.translateBackendMessage('Email o contraseña incorrectos')).toBe('Incorrect email or password');
    expect(service.translateBackendMessage('Formato de JSON inválido: sintaxis')).toBe('Invalid JSON format: sintaxis');
    service.setLang('es');
    expect(service.translateBackendMessage('Incorrect email or password')).toBe('Email o contraseña incorrectos');
  });
});
