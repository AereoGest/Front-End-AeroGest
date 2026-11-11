import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { Pago } from './pago';

describe('Pago', () => {
  let component: Pago;
  let fixture: ComponentFixture<Pago>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pago],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Pago);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format price and dates correctly', () => {
    const precio = (component as any).formatearPrecio(150000);
    expect(precio).toContain('150.000');

    const fecha = (component as any).formatearFecha('2026-11-20');
    expect(fecha).toBeTruthy();
  });

  it('should handle response states in procesarRespuesta', () => {
    const dialogMock = {
      showModal: () => {}
    };
    (component as any).confirmacion = () => ({ nativeElement: dialogMock });

    (component as any).procesarRespuesta({
      status: 'approved',
      codigoReserva: 'RES-TEST-001',
      estadoReserva: 'CONFIRMADO',
      statusDetail: 'accredited'
    });
    expect((component as any).codigoReserva()).toBe('RES-TEST-001');

    (component as any).procesarRespuesta({
      status: 'rejected',
      codigoReserva: 'RES-TEST-002',
      estadoReserva: 'CANCELADA',
      statusDetail: 'cc_rejected_other_reason'
    });
    expect((component as any).estadoPago()).toBe('rechazado');

    (component as any).procesarRespuesta({
      status: 'in_process',
      codigoReserva: 'RES-TEST-003',
      estadoReserva: 'PROCESANDO',
      statusDetail: 'pending_contingency'
    });
    expect((component as any).estadoPago()).toBe('enProceso');
  });
});
