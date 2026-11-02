import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EstadoReserva, Reserva } from '../../Models/Reserva';
import { ReservaService } from '../../services/reservaService';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

const ESTADOS_ACTIVOS: EstadoReserva[] = ['CONFIRMADO', 'PROCESANDO', 'ACTIVO'];

type FiltroEstado = 'TODOS' | 'CONFIRMADO' | 'PENDIENTE';
type Orden = 'recientes' | 'antiguas' | 'mayorValor' | 'menorValor';

const ESTADOS_PENDIENTES: EstadoReserva[] = ['PROCESANDO', 'ACTIVO'];

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
  protected readonly filtroEstado = signal<FiltroEstado>('TODOS');
  protected readonly fechaDesde = signal('');
  protected readonly fechaHasta = signal('');
  protected readonly orden = signal<Orden>('recientes');
  protected readonly seleccionada = signal<Reserva | null>(null);

  protected readonly cantidadActivas = computed(
    () => this.reservas().filter((reserva) => ESTADOS_ACTIVOS.includes(reserva.estadoReserva)).length
  );

  // true si hay algún filtro aplicado además de la pestaña (para mostrar "Limpiar filtros")
  protected readonly hayFiltros = computed(
    () =>
      !!this.busqueda().trim() ||
      this.filtroEstado() !== 'TODOS' ||
      !!this.fechaDesde() ||
      !!this.fechaHasta() ||
      this.orden() !== 'recientes'
  );

  protected readonly reservasVisibles = computed(() => {
    const verHistorial = this.pestania() === 'historial';
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();

    const filtradas = this.reservas()
      // Pestaña: activas / historial (canceladas)
      .filter((reserva) => (reserva.estadoReserva === 'CANCELADA') === verHistorial)
      // Búsqueda: número de reserva, estado del backend o etiqueta traducida
      .filter((reserva) =>
        !texto ||
        String(reserva.id).includes(texto) ||
        reserva.estadoReserva.toLowerCase().includes(texto) ||
        this.etiquetaEstado(reserva.estadoReserva).toLowerCase().includes(texto)
      )
      // Estado (solo aplica en la pestaña de activas)
      .filter((reserva) => {
        if (verHistorial || estado === 'TODOS') return true;
        if (estado === 'CONFIRMADO') return reserva.estadoReserva === 'CONFIRMADO';
        return ESTADOS_PENDIENTES.includes(reserva.estadoReserva);
      })
      // Rango de fechas de la reserva (se compara solo la parte yyyy-mm-dd)
      .filter((reserva) => {
        const dia = this.diaReserva(reserva.fechaReserva);
        return (!desde || dia >= desde) && (!hasta || dia <= hasta);
      });

    return [...filtradas].sort((a, b) => {
      switch (this.orden()) {
        case 'antiguas':
          return this.timestamp(a.fechaReserva) - this.timestamp(b.fechaReserva);
        case 'mayorValor':
          return b.valor - a.valor;
        case 'menorValor':
          return a.valor - b.valor;
        default:
          return this.timestamp(b.fechaReserva) - this.timestamp(a.fechaReserva);
      }
    });
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

  protected cambiarPestania(pestania: 'activas' | 'historial'): void {
    this.pestania.set(pestania);
    this.filtroEstado.set('TODOS'); // el filtro de estado no aplica al historial
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroEstado.set('TODOS');
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.orden.set('recientes');
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

  // Fecha local en formato yyyy-mm-dd, para comparar con los <input type="date">
  private diaReserva(fecha: string): string {
    const d = new Date(fecha);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private timestamp(fecha: string): number {
    return new Date(fecha).getTime() || 0;
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