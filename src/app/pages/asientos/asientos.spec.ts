import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../services/i18n';
import { Asientos } from './asientos';

describe('Asientos', () => {
  let component: Asientos;
  let fixture: ComponentFixture<Asientos>;
  let httpMock: HttpTestingController;
  let i18n: I18nService;

  const mockVuelo = {
    id: '10',
    aeropuertoOrigen: { id: 1, nombre: 'Ezeiza', codigoIata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina' },
    aeropuertoDestino: { id: 2, nombre: 'Ambrosio Taravella', codigoIata: 'COR', ciudad: 'Córdoba', pais: 'Argentina' },
    avion: { id: 1, matricula: 'LV-AAA', modelo: 'Boeing 737', capacidadPasajeros: 10 },
    fechaSalida: '2026-12-20',
    fechaLlegada: '2026-12-20',
    horaSalida: '10:00',
    horaLlegada: '11:30',
    estado: 'PROGRAMADO',
    precioVuelo: 80000,
    escala: false,
    asientosPrimera: 0,
    asientosEjecutiva: 2,
    asientosEconomica: 3,
  };

  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Asientos],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    i18n = TestBed.inject(I18nService);
    i18n.setLang('es');

    fixture = TestBed.createComponent(Asientos);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('carga los asientos reales del vuelo desde la BD y oculta categorías con 0 asientos', () => {
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/carrito`).flush({
      id: 1,
      items: [{ id: 1, vueloId: 10, cantidad: 2, claseVuelo: 'ECONOMICA' }],
    });
    httpMock.expectOne(`${environment.apiUrl}/vuelos/10`).flush(mockVuelo);
    httpMock.expectOne(`${environment.apiUrl}/asientos/vuelo/10`).flush([
      { id: 101, codigo: '1A', precioExtra: 18500, avionId: 1, vueloId: 10, categoria: 'BUSINESS', ocupado: false },
      { id: 102, codigo: '1B', precioExtra: 18500, avionId: 1, vueloId: 10, categoria: 'BUSINESS', ocupado: true },
      { id: 103, codigo: '2A', precioExtra: 0, avionId: 1, vueloId: 10, categoria: 'ECONOMICA', ocupado: false },
      { id: 104, codigo: '2B', precioExtra: 0, avionId: 1, vueloId: 10, categoria: 'ECONOMICA', ocupado: false },
      { id: 105, codigo: '2C', precioExtra: 0, avionId: 1, vueloId: 10, categoria: 'ECONOMICA', ocupado: true },
    ]);

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('.cabin-section-label')).map((n) => n.textContent);

    expect(labels.some((t) => t?.includes('Primera clase'))).toBe(false);
    expect(labels.some((t) => t?.includes('Clase ejecutiva'))).toBe(true);
    expect(labels.some((t) => t?.includes('Clase turista'))).toBe(true);

    const botones = Array.from(el.querySelectorAll('button.seat')) as HTMLButtonElement[];
    expect(botones.length).toBe(5);
    expect(botones.filter((b) => b.disabled).length).toBe(2);

    const asiento1A = botones.find((b) => b.textContent?.trim() === '1A')!;
    asiento1A.click();
    fixture.detectChanges();

    expect(component.selectedSeats.length).toBe(1);
    expect(component.selectedSeats[0]).toEqual({
      id: '1A',
      backendId: 101,
      clase: 'Ejecutiva',
      categoria: 'BUSINESS',
      precio: 18500,
    });
    expect(component.totalExtra).toBe(18500);
    expect(component.total).toBe(80000 * 2 + 18500);
    expect(sessionStorage.getItem('asientos_vuelo_id')).toBe('10');
    expect(JSON.parse(sessionStorage.getItem('asientos_seleccionados') ?? '[]')).toHaveLength(1);
  });

  it('filtra asientos ya ocupados y actualiza precios reales al restaurar selección previa', () => {
    sessionStorage.setItem('asientos_vuelo_id', '10');
    sessionStorage.setItem(
      'asientos_seleccionados',
      JSON.stringify([
        { id: '1A', backendId: 101, clase: 'Ejecutiva', precio: 999 },
        { id: '1B', backendId: 102, clase: 'Ejecutiva', precio: 999 },
      ])
    );

    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/carrito`).flush({
      id: 1,
      items: [{ id: 1, vueloId: 10, cantidad: 2, claseVuelo: 'ECONOMICA' }],
    });
    httpMock.expectOne(`${environment.apiUrl}/vuelos/10`).flush(mockVuelo);
    httpMock.expectOne(`${environment.apiUrl}/asientos/vuelo/10`).flush([
      { id: 101, codigo: '1A', precioExtra: 18500, avionId: 1, vueloId: 10, categoria: 'BUSINESS', ocupado: false },
      { id: 102, codigo: '1B', precioExtra: 18500, avionId: 1, vueloId: 10, categoria: 'BUSINESS', ocupado: true },
    ]);

    fixture.detectChanges();

    expect(component.selectedSeats).toEqual([
      { id: '1A', backendId: 101, clase: 'Ejecutiva', categoria: 'BUSINESS', precio: 18500 },
    ]);
  });

  it('muestra estado de carrito vacío cuando no hay vuelos en el carrito', () => {
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/carrito`).flush({
      id: 1,
      items: [],
    });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Tu carrito está vacío');
    expect(el.querySelectorAll('button.seat').length).toBe(0);
  });
});
