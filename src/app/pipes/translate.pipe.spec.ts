import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../services/i18n';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [I18nService, TranslatePipe],
    });
    service = TestBed.inject(I18nService);
    pipe = TestBed.inject(TranslatePipe);
  });

  it('debería crearse correctamente', () => {
    expect(pipe).toBeTruthy();
  });

  it('debería traducir claves según el idioma actual', () => {
    expect(pipe.transform('nav.home')).toBe('Inicio');
    service.setLang('en');
    expect(pipe.transform('nav.home')).toBe('Home');
  });

  it('debería soportar parámetros interpolados', () => {
    expect(pipe.transform('Bienvenido {user}', { user: 'Carlos' })).toBe('Bienvenido Carlos');
  });
});
