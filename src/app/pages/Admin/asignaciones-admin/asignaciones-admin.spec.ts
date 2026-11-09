import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { AsignacionesAdmin } from './asignaciones-admin';
import { Asignacion, EmpleadoAsignacion } from '../../../Models/Asignacion';
import { Vuelo } from '../../../Models/Vuelo';
import { environment } from '../../../../environments/environment';

describe('AsignacionesAdmin', () => {
  let component: AsignacionesAdmin;
  let fixture: ComponentFixture<AsignacionesAdmin>;
  let httpMock: HttpTestingController;

  const mockAsignaciones: Asignacion[] = [
    {
      id: 1,
      rolEmpleado: 'PILOTO',
      vuelo: {
        id: 101,
        fechaSalida: '2026-12-01',
        horaSalida: '10:00:00',
        fechaLlegada: '2026-12-01',
        horaLlegada: '12:00:00',
        estado: 'PROGRAMADO',
        aeropuertoOrigen: { id: 1, nombre: 'Ezeiza', codigoIata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina' },
        aeropuertoDestino: { id: 2, nombre: 'Bariloche', codigoIata: 'BRC', ciudad: 'Bariloche', pais: 'Argentina' },
        avion: { id: 1, identificador: 'LV-ARG', modelo: 'Boeing 737', capacidadPasajeros: 150 },
      },
      empleado: { id: 10, nombre: 'Carlos', apellido: 'Gómez', identificador: 'DNI', numeroIdentificador: '30111222' },
    },
    {
      id: 2,
      rolEmpleado: 'AZAFATA',
      vuelo: {
        id: 102,
        fechaSalida: '2026-10-01',
        horaSalida: '08:00:00',
        fechaLlegada: '2026-10-01',
        horaLlegada: '10:00:00',
        estado: 'CANCELADO',
        aeropuertoOrigen: { id: 1, nombre: 'Ezeiza', codigoIata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina' },
        aeropuertoDestino: { id: 3, nombre: 'Mendoza', codigoIata: 'MDZ', ciudad: 'Mendoza', pais: 'Argentina' },
        avion: { id: 2, identificador: 'LV-MZA', modelo: 'Airbus A320', capacidadPasajeros: 180 },
      },
      empleado: { id: 20, nombre: 'Laura', apellido: 'Pérez', identificador: 'DNI', numeroIdentificador: '35222333' },
    },
  ];

  const mockVuelos: Vuelo[] = [
    {
      id: '101',
      fechaSalida: '2026-12-01',
      horaSalida: '10:00',
      fechaLlegada: '2026-12-01',
      horaLlegada: '12:00',
      estado: 'PROGRAMADO',
      aeropuertoOrigen: { id: 1, nombre: 'Ezeiza', codigoIata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina' },
      aeropuertoDestino: { id: 2, nombre: 'Bariloche', codigoIata: 'BRC', ciudad: 'Bariloche', pais: 'Argentina' },
      avion: { id: 1, identificador: 'LV-ARG', modelo: 'Boeing 737', capacidadPasajeros: 150 } as any,
      precioVuelo: 120000,
      escala: false,
    },
  ];

  const mockEmpleados: EmpleadoAsignacion[] = [
    { id: 10, nombre: 'Carlos', apellido: 'Gómez', numeroIdentificador: '30111222' },
    { id: 30, nombre: 'Martín', apellido: 'Fernández', numeroIdentificador: '28333444' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsignacionesAdmin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AsignacionesAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Resolver llamadas de inicialización
    httpMock.expectOne(`${environment.apiUrl}/asignacion`).flush(mockAsignaciones);
    httpMock.expectOne(`${environment.apiUrl}/vuelos`).flush(mockVuelos);
    httpMock.expectOne(`${environment.apiUrl}/asignacion/empleados`).flush(mockEmpleados);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe crearse e inicializar la lista de asignaciones y catálogos', () => {
    expect(component).toBeTruthy();
    expect(component.asignaciones().length).toBe(2);
    expect(component.cargando()).toBe(false);
    expect(component.vuelos().length).toBe(1);
    expect(component.empleadosDisponibles().length).toBe(2);
  });

  it('debe filtrar asignaciones por pestaña (proximas / historial / todas)', () => {
    component.pestania.set('proximas');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].id).toBe(1);

    component.pestania.set('historial');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].id).toBe(2);

    component.pestania.set('todas');
    expect(component.visibles().length).toBe(2);
  });

  it('debe filtrar por texto de búsqueda', () => {
    component.busqueda.set('Carlos');
    component.pestania.set('todas');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].empleado?.nombre).toBe('Carlos');
  });

  it('debe abrir y cerrar modal de alta limpiando campos', () => {
    component.abrirModalAlta();
    expect(component.modalAltaAbierto()).toBe(true);
    expect(component.altaVueloId()).toBeNull();
    expect(component.altaEmpleadoId()).toBeNull();
    expect(component.altaRol()).toBe('PILOTO');

    component.cerrarModalAlta();
    expect(component.modalAltaAbierto()).toBe(false);
  });

  it('debe validar campos obligatorios antes de enviar el alta', () => {
    component.abrirModalAlta();
    component.guardarAlta();
    expect(component.formularioError()).toBeTruthy();

    component.altaVueloId.set(101);
    component.guardarAlta();
    expect(component.formularioError()).toBeTruthy();
  });

  it('debe crear asignación exitosamente y recargar listado', () => {
    const nueva: Asignacion = {
      id: 3,
      rolEmpleado: 'COPILOTO',
      vuelo: mockAsignaciones[0].vuelo,
      empleado: mockEmpleados[1],
    };

    component.abrirModalAlta();
    component.altaVueloId.set(101);
    component.altaEmpleadoId.set(30);
    component.altaRol.set('COPILOTO');

    component.guardarAlta();

    const req = httpMock.expectOne(`${environment.apiUrl}/asignacion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      vueloId: 101,
      empleadoId: 30,
      rolEmpleado: 'COPILOTO',
    });
    req.flush(nueva);

    // Recarga la lista
    httpMock.expectOne(`${environment.apiUrl}/asignacion`).flush([...mockAsignaciones, nueva]);

    expect(component.modalAltaAbierto()).toBe(false);
    expect(component.mensajeExito()).toBeTruthy();
  });

  it('debe manejar error al fallar creación de asignación', () => {
    component.abrirModalAlta();
    component.altaVueloId.set(101);
    component.altaEmpleadoId.set(30);
    component.altaRol.set('PILOTO');

    component.guardarAlta();

    const req = httpMock.expectOne(`${environment.apiUrl}/asignacion`);
    req.flush({ message: 'El empleado tiene conflicto horario' }, { status: 409, statusText: 'Conflict' });

    expect(component.formularioError()).toBe('El empleado tiene conflicto horario');
    expect(component.guardando()).toBe(false);
    expect(component.modalAltaAbierto()).toBe(true);
  });

  it('debe abrir modal de edición con datos de la asignación seleccionada', () => {
    const seleccionada = mockAsignaciones[0];
    component.abrirModalEdicion(seleccionada);

    expect(component.modalEdicionAbierto()).toBe(true);
    expect(component.asignacionEnEdicion()).toEqual(seleccionada);
    expect(component.edicionVueloId()).toBe(101);
    expect(component.edicionEmpleadoId()).toBe(10);
    expect(component.edicionRol()).toBe('PILOTO');
  });

  it('debe actualizar asignación exitosamente', () => {
    const actualizada: Asignacion = {
      ...mockAsignaciones[0],
      rolEmpleado: 'COPILOTO',
    };

    component.abrirModalEdicion(mockAsignaciones[0]);
    component.edicionRol.set('COPILOTO');
    component.guardarEdicion();

    const req = httpMock.expectOne(`${environment.apiUrl}/asignacion/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      vueloId: 101,
      empleadoId: 10,
      rolEmpleado: 'COPILOTO',
    });
    req.flush(actualizada);

    // Recarga la lista
    httpMock.expectOne(`${environment.apiUrl}/asignacion`).flush([actualizada, mockAsignaciones[1]]);

    expect(component.modalEdicionAbierto()).toBe(false);
    expect(component.mensajeExito()).toBeTruthy();
  });

  it('debe abrir modal de baja y confirmar eliminación', () => {
    component.abrirModalBaja(mockAsignaciones[0]);
    expect(component.modalBajaAbierto()).toBe(true);
    expect(component.asignacionAEliminar()).toEqual(mockAsignaciones[0]);

    component.confirmarBaja();

    const req = httpMock.expectOne(`${environment.apiUrl}/asignacion/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    // Recarga la lista
    httpMock.expectOne(`${environment.apiUrl}/asignacion`).flush([mockAsignaciones[1]]);

    expect(component.modalBajaAbierto()).toBe(false);
    expect(component.mensajeExito()).toBeTruthy();
  });
  // ── Pruebas específicas de filtros (Tarea 5) ──
  it('debe filtrar asignaciones por empleado seleccionado', () => {
    component.pestania.set('todas');
    component.empleadoId.set(10);
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].empleado?.id).toBe(10);

    component.empleadoId.set(999);
    expect(component.visibles().length).toBe(0);
  });

  it('debe filtrar asignaciones por rol del empleado', () => {
    component.pestania.set('todas');
    component.rol.set('PILOTO');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].rolEmpleado).toBe('PILOTO');

    component.rol.set('AZAFATA');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].rolEmpleado).toBe('AZAFATA');

    component.rol.set('COPILOTO');
    expect(component.visibles().length).toBe(0);
  });

  it('debe filtrar asignaciones por estado de vuelo', () => {
    component.pestania.set('todas');
    component.estado.set('PROGRAMADO');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].vuelo.estado).toBe('PROGRAMADO');

    component.estado.set('CANCELADO');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].vuelo.estado).toBe('CANCELADO');
  });

  it('debe filtrar por rango de fechas (desde y hasta)', () => {
    component.pestania.set('todas');
    // Vuelo 1: 2026-12-01 · Vuelo 2: 2026-10-01
    component.desde.set('2026-11-01');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].id).toBe(1);

    component.desde.set('');
    component.hasta.set('2026-10-15');
    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].id).toBe(2);

    component.desde.set('2026-09-01');
    component.hasta.set('2026-12-31');
    expect(component.visibles().length).toBe(2);
  });

  it('debe combinar múltiples filtros simultáneamente', () => {
    component.pestania.set('todas');
    component.rol.set('PILOTO');
    component.estado.set('PROGRAMADO');
    component.busqueda.set('EZE');
    component.desde.set('2026-11-01');

    expect(component.visibles().length).toBe(1);
    expect(component.visibles()[0].id).toBe(1);

    // Si agregamos un filtro incompatible, el resultado debe ser vacío
    component.rol.set('AZAFATA');
    expect(component.visibles().length).toBe(0);
  });

  it('debe limpiar todos los filtros aplicados', () => {
    component.busqueda.set('Carlos');
    component.empleadoId.set(10);
    component.rol.set('PILOTO');
    component.estado.set('PROGRAMADO');
    component.desde.set('2026-01-01');
    component.hasta.set('2026-12-31');

    expect(component.hayFiltros()).toBe(true);

    component.limpiarFiltros();

    expect(component.busqueda()).toBe('');
    expect(component.empleadoId()).toBeNull();
    expect(component.rol()).toBe('');
    expect(component.estado()).toBe('');
    expect(component.desde()).toBe('');
    expect(component.hasta()).toBe('');
    expect(component.hayFiltros()).toBe(false);
  });
});
