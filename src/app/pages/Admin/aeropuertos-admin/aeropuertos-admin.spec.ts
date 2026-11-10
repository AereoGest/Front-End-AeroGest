import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AeropuertosAdmin } from './aeropuertos-admin';
import { Aeropuerto } from '../../../Models/Aeropuerto';
import { I18nService } from '../../../services/i18n';
import { environment } from '../../../../environments/environment';

describe('AeropuertosAdmin', () => {
  let component: AeropuertosAdmin;
  let fixture: ComponentFixture<AeropuertosAdmin>;
  let httpMock: HttpTestingController;

  const mockAeropuertos: Aeropuerto[] = [
    { id: 1, nombre: 'Ezeiza', codigoIata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina' },
    { id: 2, nombre: 'Bariloche', codigoIata: 'BRC', ciudad: 'Bariloche', pais: 'Argentina' },
    { id: 3, nombre: 'Guarulhos', codigoIata: 'GRU', ciudad: 'São Paulo', pais: 'Brasil' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AeropuertosAdmin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AeropuertosAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Resolver la carga inicial
    httpMock.expectOne(`${environment.apiUrl}/aeropuertos`).flush(mockAeropuertos);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe crearse e inicializar la lista de aeropuertos', () => {
    expect(component).toBeTruthy();
    expect(component.aeropuertos().length).toBe(3);
    expect(component.cargando()).toBe(false);
  });

  it('debe filtrar por nombre, IATA, ciudad y país (sin importar tildes ni mayúsculas)', () => {
    component.pais.set('argentina');
    expect(component.filtrados().length).toBe(2);

    component.limpiarFiltros();
    component.ciudad.set('sao');
    expect(component.filtrados().length).toBe(1);
    expect(component.filtrados()[0].codigoIata).toBe('GRU');

    component.limpiarFiltros();
    component.codigoIata.set('ez');
    component.nombre.set('Ezeiza');
    expect(component.filtrados().length).toBe(1);
    expect(component.hayFiltros()).toBe(true);

    component.limpiarFiltros();
    expect(component.hayFiltros()).toBe(false);
    expect(component.filtrados().length).toBe(3);
  });

  it('debe validar el formulario antes de enviar el alta', () => {
    component.abrirModalAlta();
    component.guardar();
    expect(component.formularioError()).toBeTruthy();

    component.formNombre.set('Aeroparque');
    component.formCodigoIata.set('AE');
    component.guardar();
    expect(component.formularioError()).toBeTruthy();
  });

  it('debe crear un aeropuerto y recargar el listado', () => {
    component.abrirModalAlta();
    component.formNombre.set('Aeroparque');
    component.formCodigoIata.set('aep');
    component.formCiudad.set('Buenos Aires');
    component.formPais.set('Argentina');

    component.guardar();

    const req = httpMock.expectOne(`${environment.apiUrl}/aeropuertos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombre: 'Aeroparque',
      codigoIata: 'AEP',
      ciudad: 'Buenos Aires',
      pais: 'Argentina',
    });
    req.flush({ id: 4, ...req.request.body });

    // Recarga la lista
    httpMock.expectOne(`${environment.apiUrl}/aeropuertos`).flush(mockAeropuertos);

    expect(component.modalFormularioAbierto()).toBe(false);
    expect(component.mensajeExito()).toBeTruthy();
  });

  it('debe mostrar el mensaje del backend si falla el alta', () => {
    component.abrirModalAlta();
    component.formNombre.set('Otro Ezeiza');
    component.formCodigoIata.set('EZE');
    component.formCiudad.set('Buenos Aires');
    component.formPais.set('Argentina');

    component.guardar();

    httpMock
      .expectOne(`${environment.apiUrl}/aeropuertos`)
      .flush({ message: 'Ya existe un aeropuerto con el código IATA: EZE' }, { status: 404, statusText: 'Not Found' });

    expect(component.formularioError()).toBe('Ya existe un aeropuerto con el código IATA: EZE');
    expect(component.modalFormularioAbierto()).toBe(true);
  });

  it('debe abrir la edición con los datos cargados y guardar con PUT', () => {
    component.abrirModalEdicion(mockAeropuertos[0]);
    expect(component.formNombre()).toBe('Ezeiza');
    expect(component.formCodigoIata()).toBe('EZE');

    component.formNombre.set('Ministro Pistarini');
    component.guardar();

    const req = httpMock.expectOne(`${environment.apiUrl}/aeropuertos/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.nombre).toBe('Ministro Pistarini');
    req.flush({ ...mockAeropuertos[0], nombre: 'Ministro Pistarini' });

    httpMock.expectOne(`${environment.apiUrl}/aeropuertos`).flush(mockAeropuertos);

    expect(component.modalFormularioAbierto()).toBe(false);
    expect(component.mensajeExito()).toBeTruthy();
  });

  it('debe dar de baja un aeropuerto, cerrar el aviso con animación y mostrar un toast', () => {
    vi.useFakeTimers();
    component.abrirModalBaja(mockAeropuertos[1]);
    expect(component.modalBajaAbierto()).toBe(true);

    component.confirmarBaja();

    const req = httpMock.expectOne(`${environment.apiUrl}/aeropuertos/2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    httpMock.expectOne(`${environment.apiUrl}/aeropuertos`).flush([mockAeropuertos[0], mockAeropuertos[2]]);

    // El aviso queda "cerrando" mientras corre la animación de salida
    expect(component.cerrandoBaja()).toBe(true);
    expect(component.toast()?.tipo).toBe('exito');

    vi.advanceTimersByTime(400);
    expect(component.modalBajaAbierto()).toBe(false);
    expect(component.cerrandoBaja()).toBe(false);
    vi.useRealTimers();
  });

  it('debe mostrar un toast informativo si se cancela la baja', () => {
    component.abrirModalBaja(mockAeropuertos[0]);
    component.cancelarBaja();

    expect(component.toast()?.tipo).toBe('info');
    expect(component.cerrandoBaja()).toBe(true);
  });

  it('debe avisar con un toast de error que no se puede dar de baja si hay vuelos que lo usan (409)', () => {
    component.abrirModalBaja(mockAeropuertos[0]);
    component.confirmarBaja();

    httpMock
      .expectOne(`${environment.apiUrl}/aeropuertos/1`)
      .flush({ message: 'Ya existe un registro con esos datos' }, { status: 409, statusText: 'Conflict' });

    expect(component.toast()).toEqual({
      texto: TestBed.inject(I18nService).t('adminAirports.errInUse'),
      tipo: 'error',
    });
  });
});
