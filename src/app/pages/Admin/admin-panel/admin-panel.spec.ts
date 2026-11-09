import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { AdminPanel } from './admin-panel';
import { I18nService } from '../../../services/i18n';
import { ThemeService } from '../../../services/theme';

describe('AdminPanel', () => {
  let component: AdminPanel;
  let fixture: ComponentFixture<AdminPanel>;
  let i18n: I18nService;
  let theme: ThemeService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminPanel],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    theme = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(AdminPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('debería crearse y mostrar los 5 módulos administrativos requeridos', () => {
    expect(component).toBeTruthy();
    const cards = fixture.nativeElement.querySelectorAll('.admin-module-card');
    expect(cards.length).toBe(5);
  });

  it('traduce los títulos del panel en español e inglés y soporta cambio de tema', async () => {
    i18n.setLang('es');
    theme.set('dark');
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('#admin-panel-title') as HTMLElement;
    expect(title.textContent).toContain('Panel de');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    i18n.setLang('en');
    theme.set('light');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(title.textContent).toContain('Administration');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
