import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CheckoutService } from './checkout-service';

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CheckoutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('envía ECONOMICA y sin asientoId cuando el pasajero no seleccionó asiento (random)', () => {
    service.item.set({ id: 1, carritoId: 1, vueloId: 10, cantidad: 1, claseVuelo: 'PRIMERA' });
    service.pasajeros.set([
      {
        asiento: '',
        claseAsiento: '',
        categoriaAsiento: undefined,
        precioAsiento: 0,
        asientoBackendId: null,
        nombre: 'Juan',
        apellido: 'Pérez',
        tipoDocumento: 'DNI',
        documento: '35123456',
        fechaNacimiento: '1990-05-15',
        email: 'juan@test.com',
        equipajeIds: [],
        asistenciaId: '',
      },
    ]);

    const req = (service as any).armarReserva();
    expect(req.pasajes[0].asientoId).toBeUndefined();
    expect(req.pasajes[0].clasesVuelo).toBe('ECONOMICA');
  });
});
