import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Header } from './header';
import { Auth } from '../../services/auth';
import { I18nService } from '../../services/i18n';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let auth: Auth;
  let i18n: I18nService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    auth = TestBed.inject(Auth);
    i18n = TestBed.inject(I18nService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el rol traducido en el header y acceso al panel admin solo en el menú desplegable cuando el usuario es ROLE_ADMIN', async () => {
    i18n.setLang('es');
    auth.guardarSesion({
      token: 'jwt.admin',
      email: 'admin@aerogest.com',
      userId: 1,
      perfilCompleto: true,
      requires2fa: false,
      role: 'ROLE_ADMIN',
      isVerified: true,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const native = fixture.nativeElement as HTMLElement;
    const badge = native.querySelector('#header-role-badge');
    expect(badge?.textContent?.trim()).toBe('Administrador');

    // Ya no debe estar en la barra principal del header
    expect(native.querySelector('#nav-admin-link')).toBeNull();

    // Al abrir el menú desplegable, sí debe estar presente
    component.toggleMenu();
    fixture.detectChanges();
    await fixture.whenStable();

    const adminPanelLink = native.querySelector('#admin-panel-link');
    expect(adminPanelLink).toBeTruthy();
    expect(adminPanelLink?.textContent?.trim()).toBe('Panel de administración');

    // Debe existir también el acceso a configuración
    const settingsLink = native.querySelector('#settings');
    expect(settingsLink).toBeTruthy();

    i18n.setLang('en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(badge?.textContent?.trim()).toBe('Administrator');
    expect(adminPanelLink?.textContent?.trim()).toBe('Admin panel');
  });

  it('muestra el rol Usuario y no muestra el panel admin en el menú desplegable cuando el usuario es ROLE_USUARIO', async () => {
    i18n.setLang('es');
    auth.guardarSesion({
      token: 'jwt.user',
      email: 'cliente@aerogest.com',
      userId: 2,
      perfilCompleto: true,
      requires2fa: false,
      role: 'ROLE_USUARIO',
      isVerified: true,
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const native = fixture.nativeElement as HTMLElement;
    const badge = native.querySelector('#header-role-badge');
    expect(badge?.textContent?.trim()).toBe('Usuario');
    expect(native.querySelector('#nav-admin-link')).toBeNull();

    component.toggleMenu();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(native.querySelector('#admin-panel-link')).toBeNull();
    expect(native.querySelector('#settings')).toBeTruthy();
  });
});
