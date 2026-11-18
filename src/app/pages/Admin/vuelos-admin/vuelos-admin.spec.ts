import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Aeropuerto } from '../../../Models/Aeropuerto';
import { Avion } from '../../../Models/Avion';
import { Vuelo } from '../../../Models/Vuelo';
import { I18nService } from '../../../services/i18n';
import { VueloService } from '../../../services/vuelo';
import { VuelosAdmin } from './vuelos-admin';

describe('VuelosAdmin', () => {
  let component: VuelosAdmin;
  let fixture: ComponentFixture<VuelosAdmin>;
  let vueloService: VueloService;
  let i18n: I18nService;

  const aeropuertosMock: Aeropuerto[] = [
    { id: 1, nombre: 'Ezeiza', codigoIata: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina' },
    { id: 2, nombre: 'Córdoba', codigoIata: 'COR', ciudad: 'Córdoba', pais: 'Argentina' },
  ];

  const avionesMock: Avion[] = [
    { id: 10, identificador: 'LV-AAA', modelo: 'Embraer E190', capacidadPasajeros: 10, capacidadBodega: 1000, estado: 'DISPONIBLE' },
  ];

  const futuroFecha = (diasExtra = 2): string => {
    const d = new Date(Date.now() + diasExtra * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VuelosAdmin],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    vueloService = TestBed.inject(VueloService);
    i18n = TestBed.inject(I18nService);
    i18n.setLang('es');

    vi.spyOn(vueloService, 'obtenerTodos').mockReturnValue(of([]));
    vi.spyOn(vueloService, 'obtenerAeropuertos').mockReturnValue(of(aeropuertosMock));
    vi.spyOn(vueloService, 'obtenerAviones').mockReturnValue(of(avionesMock));
    vi.spyOn(vueloService, 'validar').mockReturnValue(of({ valido: true, mensaje: null }));

    fixture = TestBed.createComponent(VuelosAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('valida suma total de asientos contra mínimo 1 y capacidad máxima del avión', () => {
    (component as any).abrirAlta();
    fixture.detectChanges();

    const selectAvion = fixture.nativeElement.querySelector('#f-avion') as HTMLSelectElement;
    expect(selectAvion).toBeTruthy();

    // Asignar avión y superar capacidad (6 + 5 = 11 > 10)
    (component as any).fAvionId.set(10);
    (component as any).fAsientosPrimera.set(6);
    (component as any).fAsientosEjecutiva.set(5);
    (component as any).fAsientosEconomica.set(0);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'La suma de asientos supera la capacidad máxima del avión.'
    );

    // 0 en todas las categorías es inválido
    (component as any).fAsientosPrimera.set(0);
    (component as any).fAsientosEjecutiva.set(0);
    (component as any).fAsientosEconomica.set(0);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Debe haber al menos 1 asiento configurado entre las categorías.'
    );

    // Permitir 0 en Primera cuando el total es válido (0 + 2 + 8 = 10 <= 10)
    (component as any).fAsientosEjecutiva.set(2);
    (component as any).fAsientosEconomica.set(8);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Configurados: 10 / 10 máx.');
    expect((component as any).errores().asientos).toBeUndefined();
  });

  it('envía asientosPrimera, asientosEjecutiva y asientosEconomica al crear un vuelo', () => {
    const crearSpy = vi.spyOn(vueloService, 'crear').mockReturnValue(
      of({
        id: '99',
        aeropuertoOrigen: aeropuertosMock[0],
        aeropuertoDestino: aeropuertosMock[1],
        avion: avionesMock[0],
        fechaSalida: futuroFecha(2),
        fechaLlegada: futuroFecha(2),
        horaSalida: '10:00',
        horaLlegada: '12:00',
        estado: 'PROGRAMADO',
        precioVuelo: 95000,
        escala: false,
        asientosPrimera: 0,
        asientosEjecutiva: 2,
        asientosEconomica: 8,
      })
    );

    (component as any).abrirAlta();
    (component as any).fOrigenId.set(1);
    (component as any).fDestinoId.set(2);
    (component as any).fAvionId.set(10);
    (component as any).fAsientosPrimera.set(0);
    (component as any).fAsientosEjecutiva.set(2);
    (component as any).fAsientosEconomica.set(8);
    (component as any).fFechaSalida.set(futuroFecha(2));
    (component as any).fSalidaHora.set('10');
    (component as any).fSalidaMin.set('00');
    (component as any).fFechaLlegada.set(futuroFecha(2));
    (component as any).fLlegadaHora.set('12');
    (component as any).fLlegadaMin.set('00');
    (component as any).fPrecio.set(95000);
    fixture.detectChanges();

    (component as any).guardar();
    fixture.detectChanges();

    expect(crearSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        aeropuertoOrigenId: 1,
        aeropuertoDestinoId: 2,
        avionId: 10,
        asientosPrimera: 0,
        asientosEjecutiva: 2,
        asientosEconomica: 8,
      })
    );
  });

  it('muestra desglose en detalle y precarga asientos en edición (con fallback legado)', () => {
    const vueloConfigurado: Vuelo = {
      id: '50',
      aeropuertoOrigen: aeropuertosMock[0],
      aeropuertoDestino: aeropuertosMock[1],
      avion: avionesMock[0],
      fechaSalida: futuroFecha(3),
      fechaLlegada: futuroFecha(3),
      horaSalida: '14:00',
      horaLlegada: '16:00',
      estado: 'PROGRAMADO',
      precioVuelo: 70000,
      escala: false,
      asientosPrimera: 2,
      asientosEjecutiva: 3,
      asientosEconomica: 5,
    };

    (component as any).vueloDetalle.set(vueloConfigurado);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Primera: 2 · Ejecutiva: 3 · Económica: 5'
    );

    (component as any).abrirEdicion(vueloConfigurado);
    expect((component as any).fAsientosPrimera()).toBe(2);
    expect((component as any).fAsientosEjecutiva()).toBe(3);
    expect((component as any).fAsientosEconomica()).toBe(5);

    const vueloLegado: Vuelo = {
      ...vueloConfigurado,
      asientosPrimera: null,
      asientosEjecutiva: null,
      asientosEconomica: null,
    };
    (component as any).abrirEdicion(vueloLegado);
    expect((component as any).fAsientosPrimera()).toBe(0);
    expect((component as any).fAsientosEjecutiva()).toBe(0);
    expect((component as any).fAsientosEconomica()).toBe(10);
  });
});
