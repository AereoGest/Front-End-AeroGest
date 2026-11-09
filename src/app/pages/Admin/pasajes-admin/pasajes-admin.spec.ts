import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { PasajesAdmin } from './pasajes-admin';
import { Reserva } from '../../../Models/Reserva';
import { I18nService } from '../../../services/i18n';
import { ThemeService } from '../../../services/theme';
import { environment } from '../../../../environments/environment';

describe('PasajesAdmin', () => {
  let component: PasajesAdmin;
  let fixture: ComponentFixture<PasajesAdmin>;
  let httpMock: HttpTestingController;
  let i18n: I18nService;
  let theme: ThemeService;

  const mockReservas: Reserva[] = [
    {
      id: 50,
      codigoReserva: 'AC-2026-TK01',
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
          id: 201,
          codigoReserva: 'AC-2026-TK01',
          codigoPasaje: 'PAS201',
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
            avion: { id: 1, modelo: 'B737' },
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
  ];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PasajesAdmin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    i18n = TestBed.inject(I18nService);
    theme = TestBed.inject(ThemeService);

    fixture = TestBed.createComponent(PasajesAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/reservas`).flush(mockReservas);
    httpMock.expectOne(`${environment.apiUrl}/equipajes`).flush([
      { id: 1, tipo: 'CABINA', peso: 10, precio: 8000 },
    ]);
    httpMock.expectOne(`${environment.apiUrl}/asistenciasAlViajero`).flush([
      { id: 2, nombrePlan: 'Básico', descripcion: 'Cobertura médica', precio: 5000 },
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debería mostrar las reservas con sus pasajes asociados y permitir filtrar por texto', () => {
    const cards = fixture.nativeElement.querySelectorAll('.pasaje-card');
    expect(cards.length).toBe(1);

    component['busqueda'].set('PAS201');
    fixture.detectChanges();
    expect(component['reservasFiltradas']().length).toBe(1);

    component['busqueda'].set('INEXISTENTE');
    fixture.detectChanges();
    expect(component['reservasFiltradas']().length).toBe(0);
  });

  it('debería modificar un pasaje asociado mediante PUT /api/pasajes/{id} y recargar las reservas', () => {
    const reserva = component['reservas']()[0];
    const pasaje = reserva.pasajes![0];

    component['abrirModalEdicion'](reserva, pasaje);
    httpMock.expectOne(`${environment.apiUrl}/asientos/avion/1`).flush([
      { id: 20, codigo: '12A', precioExtra: 0, avionId: 1, ocupado: true },
      { id: 21, codigo: '12B', precioExtra: 5000, avionId: 1, ocupado: false },
    ]);

    component['editNombre'].set('Juan Ignacio');
    component['editClase'].set('BUSINESS');
    component['editAsientoId'].set(21);
    component['editEquipajeIds'].set([1]);
    component['editAsistenciaId'].set(2);

    component['guardarEdicionPasaje']();

    const putReq = httpMock.expectOne(`${environment.apiUrl}/pasajes/201`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body.reservaId).toBe(50);
    expect(putReq.request.body.nombre).toBe('Juan Ignacio');
    expect(putReq.request.body.clasesVuelo).toBe('BUSINESS');
    expect(putReq.request.body.asientoId).toBe(21);
    putReq.flush({ ...pasaje, nombre: 'Juan Ignacio', clasesVuelo: 'BUSINESS' });

    // Recarga posterior de reservas
    httpMock.expectOne(`${environment.apiUrl}/reservas`).flush(mockReservas);
    expect(component['itemEnEdicion']()).toBeNull();
  });

  it('debería cancelar un pasaje asociado mediante DELETE /api/pasajes/{id}?reservaId={reservaId}', () => {
    const reserva = component['reservas']()[0];
    const pasaje = reserva.pasajes![0];

    component['abrirModalCancelacion'](reserva, pasaje);
    expect(component['itemParaCancelar']()?.pasaje.id).toBe(201);

    component['confirmarCancelacionPasaje']();

    const delReq = httpMock.expectOne(`${environment.apiUrl}/pasajes/201?reservaId=50`);
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush(null);

    httpMock.expectOne(`${environment.apiUrl}/reservas`).flush([]);
    expect(component['itemParaCancelar']()).toBeNull();
  });

  it('traduce los textos en español e inglés y soporta dark/light mode', async () => {
    i18n.setLang('es');
    theme.set('dark');
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('.section-title') as HTMLElement;
    expect(title.textContent).toContain('Pasajes por reserva');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    i18n.setLang('en');
    theme.set('light');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(title.textContent).toContain('Tickets by booking');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
