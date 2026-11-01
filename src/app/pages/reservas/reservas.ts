import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EstadoReserva, Reserva } from '../../Models/Reserva';
import { ReservaService } from '../../services/reservaService';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

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
  imports: [RouterLink, TranslatePipe],
  templateUrl: './reservas.html',
  styleUrl: './reservas.css',
})
export class Reservas implements OnInit {
  private readonly reservaService = inject(ReservaService);
  protected readonly i18n = inject(I18nService);

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
        this.error.set(error.error?.message || this.i18n.t('common.error'));
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
    if (!confirm(this.i18n.isSpanish() ? '¿Confirmar la cancelación de esta reserva?' : 'Confirm cancellation of this booking?')) {
      return;
    }

    this.limpiarMensajes();

    this.reservaService.cancelar(reserva.id).subscribe({
      next: () => {
        this.cerrarDetalle();
        this.mostrarMensaje(this.mensajeExito, this.i18n.t('common.success'));
        this.cargarReservas();
      },
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || this.i18n.t('common.error'));
      }
    });
  }

  protected proximamente(funcion: string): void {
    this.limpiarMensajes();
    this.mostrarMensaje(this.mensajeExito, `${funcion} - ${this.i18n.isSpanish() ? 'Próximamente disponible' : 'Coming soon'}`);
  }

  protected etiquetaEstado(estado: EstadoReserva): string {
    if (estado === 'CONFIRMADO') return this.i18n.t('myBookings.statusConfirmed');
    if (estado === 'CANCELADA') return this.i18n.t('myBookings.statusCanceled');
    if (estado === 'PROCESANDO' || estado === 'ACTIVO') return this.i18n.t('myBookings.statusPending');
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  protected formatearPrecio(valor: number): string {
    return `$${valor.toLocaleString('es-AR')}`;
  }

  protected formatearDia(fecha: string): number {
    return new Date(fecha).getDate();
  }

  protected formatearMesAnio(fecha: string): string {
    const locale = this.i18n.currentLang() === 'es' ? 'es-AR' : 'en-US';
    return new Date(fecha).toLocaleString(locale, { month: 'short', year: 'numeric' });
  }

  protected formatearFecha(fecha: string): string {
    const locale = this.i18n.currentLang() === 'es' ? 'es-AR' : 'en-US';
    return new Date(fecha).toLocaleDateString(locale);
  }

  private mostrarMensaje(mensaje: typeof this.mensajeExito, texto: string): void {
    mensaje.set(texto);
    setTimeout(() => mensaje.set(''), 4000);
  }

  private limpiarMensajes(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
  }
}
