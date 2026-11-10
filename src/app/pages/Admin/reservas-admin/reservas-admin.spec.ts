import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ReservasAdmin } from './reservas-admin';
import { Reserva } from '../../../Models/Reserva';
import { I18nService } from '../../../services/i18n';
import { ThemeService } from '../../../services/theme';
import { environment } from '../../../../environments/environment';

describe('ReservasAdmin', () => {
  let component: ReservasAdmin;
  let fixture: ComponentFixture<ReservasAdmin>;
  let httpMock: HttpTestingController;
  let i18n: I18nService;
  let theme: ThemeService;

  const mockReservas: Reserva[] = [
    {
      id: 101,
      codigoReserva: 'AC-2026-AB12',
      persona: {
        id: 10,
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@aerogest.com',
      },
      valor: 150000,
      cantidadPasajes: 1,
      estadoReserva: 'CONFIRMADO',
      fechaReserva: '2026-10-15T12:00:00',
      pasajes: [
        {
          id: 1,
          codigoReserva: 'AC-2026-AB12',
          codigoPasaje: 'PAS001',
          clasesVuelo: 'ECONOMICA',
          nombre: 'Juan',
          apellido: 'Pérez',
          tipoDocumento: 'DNI',
          documento: '35123456',
          fechaNacimiento: '1990-05-15',
          email: 'juan@aerogest.com',
          asiento: { id: 20, codigo: '12A', precioExtra: 0 },
          vuelo: {
            id: 5,
            aeropuertoOrigen: { codigoIata: 'AEP', ciudad: 'Buenos Aires' },
            aeropuertoDestino: { codigoIata: 'BRC', ciudad: 'Bariloche' },
            fechaSalida: '2026-12-01',
            horaSalida: '10:00:00',
            fechaLlegada: '2026-12-01',
            horaLlegada: '12:15:00',
          },
          equipajes: [],
          asistenciaAlViajero: null,
        },
      ],
    },
    {
      id: 102,
      codigoReserva: 'AC-2026-CD34',
      persona: {
        id: 11,
        nombre: 'Lucía',
        apellido: 'Gómez',
        email: 'lucia@aerogest.com',
      },
      valor: 95000,
      cantidadPasajes: 1,
      estadoReserva: 'CANCELADA',
      fechaReserva: '2026-10-14T09:30:00',
      pasajes: [],
    },
  ];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ReservasAdmin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    i18n = TestBed.inject(I18nService);
    theme = TestBed.inject(ThemeService);

    fixture = TestBed.createComponent(ReservasAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Resolver las peticiones iniciales de ngOnInit
    httpMock.expectOne(`${environment.apiUrl}/reservas`).flush(mockReservas);
    httpMock.expectOne(`${environment.apiUrl}/personas`).flush([
      { id: 10, nombre: 'Juan', apellido: 'Pérez', email: 'juan@aerogest.com' },
      { id: 11, nombre: 'Lucía', apellido: 'Gómez', email: 'lucia@aerogest.com' },
    ]);
    httpMock.expectOne(`${environment.apiUrl}/vuelos/disponibles`).flush([
      {
        id: '5',
        aeropuertoOrigen: { id: 1, nombre: 'Aeroparque', ciudad: 'Buenos Aires', pais: 'Argentina', codigoIata: 'AEP' },
        aeropuertoDestino: { id: 2, nombre: 'Bariloche', ciudad: 'Bariloche', pais: 'Argentina', codigoIata: 'BRC' },
        avion: { id: 1, identificador: 'LV-ABC', capacidadBodega: 1000, capacidadPasajeros: 150, modelo: 'B737', estado: 'ACTIVO' },
        fechaSalida: '2026-12-01',
        fechaLlegada: '2026-12-01',
        horaSalida: '10:00:00',
        horaLlegada: '12:15:00',
        estado: 'PROGRAMADO',
        precioVuelo: 100000,
        escala: false,
      },
    ]);
    httpMock.expectOne(`${environment.apiUrl}/equipajes`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/asistenciasAlViajero`).flush([]);

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debería listar las reservas cargadas y filtrar por pestañas y búsqueda', () => {
    const cards = fixture.nativeElement.querySelectorAll('.reserva-card');
    expect(cards.length).toBe(2);

    // Filtrar solo canceladas
    component['tabActiva'].set('CANCELADAS');
    fixture.detectChanges();
    expect(component['reservasFiltradas']().length).toBe(1);
    expect(component['reservasFiltradas']()[0].codigoReserva).toBe('AC-2026-CD34');

    // Buscar por titular
    component['tabActiva'].set('TODAS');
    component['busqueda'].set('Juan');
    fixture.detectChanges();
    expect(component['reservasFiltradas']().length).toBe(1);
    expect(component['reservasFiltradas']()[0].id).toBe(101);
  });

  it('debería validar el formulario de alta y crear una nueva reserva mediante POST /api/reservas', () => {
    component['abrirModalAlta']();
    expect(component['modalAltaAbierto']()).toBe(true);

    // Intento sin seleccionar cliente
    component['guardarNuevaReserva']();
    expect(component['errorFormularioAlta']()).toBeTruthy();

    // Completar datos válidos
    component['altaPersonaId'].set(10);
    component['altaVueloId'].set(5);
    component['altaPasajeros'].set([
      {
        nombre: 'Carlos',
        apellido: 'López',
        tipoDocumento: 'DNI',
        documento: '38999111',
        fechaNacimiento: '1995-03-20',
        email: 'carlos@aerogest.com',
        clasesVuelo: 'ECONOMICA',
        asientoId: null,
        asistenciaId: null,
        equipajeIds: [],
      },
    ]);

    component['guardarNuevaReserva']();

    const req = httpMock.expectOne(`${environment.apiUrl}/reservas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.personaId).toBe(10);
    expect(req.request.body.vueloId).toBe(5);
    expect(req.request.body.cantidadPasajes).toBe(1);

    const nuevaReserva: Reserva = {
      id: 103,
      codigoReserva: 'AC-2026-EF56',
      persona: { id: 10, nombre: 'Juan', apellido: 'Pérez' },
      valor: 127050,
      cantidadPasajes: 1,
      estadoReserva: 'PROCESANDO',
      fechaReserva: '2026-10-16T10:00:00',
    };
    req.flush(nuevaReserva);

    expect(component['modalAltaAbierto']()).toBe(false);
    expect(component['reservas']().length).toBe(3);
  });

  it('debería modificar una reserva existente mediante PUT /api/reservas/{id}', () => {
    const reserva = component['reservas']()[0];
    component['abrirModalEdicion'](reserva);
    expect(component['reservaEnEdicion']()?.id).toBe(101);

    component['edicionClienteId'].set(11);
    component['edicionEstado'].set('ACTIVO');
    component['edicionValor'].set(160000);

    component['guardarEdicionReserva']();

    const req = httpMock.expectOne(`${environment.apiUrl}/reservas/101`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.clienteId).toBe(11);
    expect(req.request.body.estadoReserva).toBe('ACTIVO');
    expect(req.request.body.valor).toBe(160000);

    req.flush({
      ...reserva,
      persona: { id: 11, nombre: 'Lucía', apellido: 'Gómez' },
      estadoReserva: 'ACTIVO',
      valor: 160000,
    });

    expect(component['reservaEnEdicion']()).toBeNull();
    expect(component['reservas']()[0].estadoReserva).toBe('ACTIVO');
    expect(component['reservas']()[0].valor).toBe(160000);
  });

  it('debería dar de baja lógicamente una reserva mediante DELETE /api/reservas/{id} y conservarla como CANCELADA', () => {
    vi.useFakeTimers();
    const reserva = component['reservas']()[0];
    component['abrirModalBaja'](reserva);
    expect(component['reservaParaBaja']()?.id).toBe(101);

    component['confirmarBajaReserva']();

    const req = httpMock.expectOne(`${environment.apiUrl}/reservas/101`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    // El aviso se cierra con la animación de salida y se informa con un toast
    expect(component['cerrandoBaja']()).toBe(true);
    expect(component['toast']()?.tipo).toBe('exito');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(component['reservaParaBaja']()).toBeNull();
    const actualizada = component['reservas']().find((r) => r.id === 101);
    expect(actualizada?.estadoReserva).toBe('CANCELADA');
    expect(actualizada?.pasajes?.[0].asiento).toBeNull();
  });

  it('traduce textos en español e inglés y respeta el modo claro/oscuro', async () => {
    i18n.setLang('es');
    theme.set('dark');
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('.section-title') as HTMLElement;
    expect(title.textContent).toContain('Gestión de reservas');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    i18n.setLang('en');
    theme.set('light');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(title.textContent).toContain('Booking management');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
