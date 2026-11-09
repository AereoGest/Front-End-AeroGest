import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Checkinonline } from './check-in-online';
import { Reserva } from '../../Models/Reserva';

describe('CheckInOnline', () => {
  let component: Checkinonline;
  let fixture: ComponentFixture<Checkinonline>;

  const mockReserva: Reserva = {
    id: 1,
    codigoReserva: 'AC-2026-0001',
    persona: { nombre: 'Juan', apellido: 'Pérez' },
    valor: 100000,
    cantidadPasajes: 1,
    estadoReserva: 'CONFIRMADO',
    fechaReserva: '2026-10-10T10:00:00',
    pasajes: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkinonline],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkinonline);
    fixture.componentRef.setInput('reserva', mockReserva);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
