import { Component, ElementRef, OnInit, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EstadoReserva, Reserva } from '../../Models/Reserva';
import { ReservaService } from '../../services/reservaService';

const ESTADOS_ACTIVOS: EstadoReserva[] = ['CONFIRMADO', 'PROCESANDO', 'ACTIVO'];

const ETIQUETAS_ESTADO: Record<EstadoReserva, string> = {
  CONFIRMADO: 'Confirmado',
  ACTIVO: 'Activo',
  PROCESANDO: 'Procesando',
  CANCELADA: 'Cancelada',
};

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './reservas.html',
  styleUrl: './reservas.css',
})
export class Reservas implements OnInit {
  // Ventana de detalle (<dialog #detalle> del html).
  private readonly detalle = viewChild.required<ElementRef<HTMLDialogElement>>('detalle');

  protected readonly reservas = signal<Reserva[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');
  protected readonly pestania = signal<'activas' | 'historial'>('activas');
  protected readonly busqueda = signal('');
  protected readonly seleccionada = signal<Reserva | null>(null);

  protected readonly cantidadActivas = computed(
    () => this.reservas().filter((reserva) => ESTADOS_ACTIVOS.includes(reserva.estadoReserva)).length
  );

  // Reservas de la pestaña actual, filtradas por número de reserva o estado.
  protected readonly reservasVisibles = computed(() => {
    const verHistorial = this.pestania() === 'historial';
    const texto = this.busqueda().trim().toLowerCase();

    return this.reservas()
      .filter((reserva) => (reserva.estadoReserva === 'CANCELADA') === verHistorial)
      .filter((reserva) =>
        !texto ||
        String(reserva.id).includes(texto) ||
        reserva.estadoReserva.toLowerCase().includes(texto)
      );
  });

  constructor(private reservaService: ReservaService) {}

  ngOnInit(): void {
    this.cargarReservas();
  }

  protected cargarReservas(): void {
    this.cargando.set(true);
    this.error.set('');

    this.reservaService.obtenerMisReservas().subscribe({
      next: (reservas) => this.reservas.set(reservas ?? []),
      error: (error: HttpErrorResponse) => {
        this.reservas.set([]);
        this.error.set(error.error?.message || 'No se pudieron obtener tus reservas. Intentá nuevamente.');
      }
    }).add(() => this.cargando.set(false));
  }

  protected abrirDetalle(reserva: Reserva): void {
    this.seleccionada.set(reserva);
    this.detalle().nativeElement.showModal();
  }

  protected cerrarDetalle(): void {
    this.detalle().nativeElement.close();
  }

  protected cancelarReserva(reserva: Reserva): void {
    if (!confirm('¿Confirmar la cancelación de esta reserva?')) {
      return;
    }

    this.limpiarMensajes();

    this.reservaService.cancelar(reserva.id).subscribe({
      next: () => {
        this.cerrarDetalle();
        this.mostrarMensaje(this.mensajeExito, 'Reserva cancelada. El reembolso se procesará en 3-5 días hábiles.');
        this.cargarReservas();
      },
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || 'No se pudo cancelar la reserva.');
      }
    });
  }

  protected proximamente(funcion: string): void {
    this.limpiarMensajes();
    this.mostrarMensaje(this.mensajeExito, `${funcion} próximamente disponible`);
  }

  protected etiquetaEstado(estado: EstadoReserva): string {
    return ETIQUETAS_ESTADO[estado];
  }

  protected formatearPrecio(valor: number): string {
    return `$${valor.toLocaleString('es-AR')}`;
  }

  protected formatearDia(fecha: string): number {
    return new Date(fecha).getDate();
  }

  protected formatearMesAnio(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR', { month: 'short', year: 'numeric' });
  }

  protected formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR');
  }

  // Los mensajes se muestran como toast y se ocultan solos a los 4 segundos.
  private mostrarMensaje(mensaje: typeof this.mensajeExito, texto: string): void {
    mensaje.set(texto);
    setTimeout(() => mensaje.set(''), 4000);
  }

  private limpiarMensajes(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
  }
}
