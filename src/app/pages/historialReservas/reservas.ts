import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CheckInResponse, EstadoReserva, PasajeReserva, Reserva } from '../../Models/Reserva';
import { ReservaService } from '../../services/reservaService';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';
import type { TranslationKey } from '../../i18n/es';
import { Checkinonline } from '../check-in-online/check-in-online';

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

// Motivos de cancelación que guarda el back (mismos textos que CancelacionVueloService y ReservaService)
const MOTIVOS_CANCELACION: Record<string, TranslationKey> = {
  'Vuelo cancelado por la aerolínea': 'myBookings.reasonFlightCancelled',
  'Cancelada por el cliente': 'myBookings.reasonCustomer',
  'Cancelada por la aerolínea': 'myBookings.reasonAirline',
};

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Checkinonline],
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

  // ── Check-in ──
  // id de la reserva cuyo check-in se está procesando (para deshabilitar el botón)
  protected readonly checkInEnCurso = signal<number | null>(null);
  // Reserva para la que está abierto el modal de confirmación de check-in
  protected readonly reservaCheckin = signal<Reserva | null>(null);
  protected readonly errorCheckin = signal('');
  // Pasajes a los que el sistema les asignó asiento al azar en el último check-in
  protected readonly asientosAutomaticos = signal<number[]>([]);

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
      // Búsqueda: código o número de reserva, estado del backend o etiqueta traducida
      .filter((reserva) =>
        !texto ||
        String(reserva.id).includes(texto) ||
        (reserva.codigoReserva ?? '').toLowerCase().includes(texto) ||
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

  // ===================== Detalle =====================

  protected abrirDetalle(reserva: Reserva): void {
    this.seleccionada.set(reserva);
    this.detalle().nativeElement.showModal();
  }

  protected cerrarDetalle(): void {
    this.detalle().nativeElement.close();
  }

  // Se llama cuando el <dialog> del detalle se cierra, por cualquier motivo
  protected alCerrarDetalle(): void {
    this.seleccionada.set(null);
    this.asientosAutomaticos.set([]);
  }

  // Imprime solo el detalle de la reserva (ver estilos de impresión en styles.css)
  protected imprimirPasajes(): void {
    window.print();
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

  // ===================== Check-in online =====================

  protected abrirCheckIn(reserva: Reserva): void {
    if (reserva.fechaCheckIn || this.checkInEnCurso() !== null) return;
    this.limpiarMensajes();
    this.errorCheckin.set('');
    this.reservaCheckin.set(reserva);
  }

  protected cerrarConfirmacion(): void {
    if (this.checkInEnCurso() !== null) return; // no cerrar mientras se procesa
    this.reservaCheckin.set(null);
  }

  protected confirmarCheckIn(): void {
    const reserva = this.reservaCheckin();
    if (!reserva || this.checkInEnCurso() !== null) return;

    this.errorCheckin.set('');
    this.checkInEnCurso.set(reserva.id);

    this.reservaService.checkIn(reserva.id).subscribe({
      next: (respuesta) => {
        const actualizada = this.aplicarCheckIn(reserva, respuesta);
        this.reservas.update((reservas) => reservas.map((r) => (r.id === reserva.id ? actualizada : r)));

        this.checkInEnCurso.set(null);
        this.reservaCheckin.set(null);

        // Abrir el detalle con los asientos ya asignados
        this.asientosAutomaticos.set(
          respuesta.pasajes.filter((p) => p.asignadoAutomaticamente).map((p) => p.pasajeId)
        );
        this.abrirDetalle(actualizada);
      },
      error: (error: HttpErrorResponse) => {
        this.checkInEnCurso.set(null);
        this.errorCheckin.set(error.error?.message || this.i18n.t('common.error'));
      }
    });
  }

  // Copia en la reserva la fecha de check-in y los asientos que devolvió el back.
  // El id 0 del asiento no se usa (el detalle solo muestra el código); al recargar viene el real.
  private aplicarCheckIn(reserva: Reserva, respuesta: CheckInResponse): Reserva {
    return {
      ...reserva,
      fechaCheckIn: respuesta.fechaCheckIn,
      pasajes: reserva.pasajes?.map((pasaje) => {
        const r = respuesta.pasajes.find((x) => x.pasajeId === pasaje.id);
        if (!r?.asiento || pasaje.asiento) return pasaje;
        return { ...pasaje, asiento: { id: 0, codigo: r.asiento, precioExtra: null } };
      }),
    };
  }

  // ===================== Formato =====================

  protected codigo(reserva: Reserva): string {
    return reserva.codigoReserva ?? `#${reserva.id}`;
  }

  protected etiquetaEstado(estado: EstadoReserva): string {
    if (estado === 'CONFIRMADO') return this.i18n.t('myBookings.statusConfirmed');
    if (estado === 'CANCELADA') return this.i18n.t('myBookings.statusCanceled');
    if (estado === 'PROCESANDO' || estado === 'ACTIVO') return this.i18n.t('myBookings.statusPending');
    return ETIQUETAS_ESTADO[estado] ?? estado;
  }

  /** El back guarda el motivo en español; los conocidos se traducen. */
  protected textoMotivo(motivo: string): string {
    const clave = MOTIVOS_CANCELACION[motivo];
    return clave ? this.i18n.t(clave) : motivo;
  }

  protected textoReembolso(monto: number): string {
    return monto > 0
      ? this.i18n.t('myBookings.refundAmount', { amount: this.formatearPrecio(monto) })
      : this.i18n.t('myBookings.refundNone');
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

  // Fecha de vuelo "yyyy-mm-dd" (LocalDate del back). Se arma a mano porque
  // new Date('2026-11-20') la toma como UTC y en Argentina mostraría el día anterior.
  protected formatearFechaVuelo(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const locale = this.i18n.currentLang() === 'es' ? 'es-AR' : 'en-US';
    return new Date(anio, mes - 1, dia).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // "14:30:00" -> "14:30"
  protected formatearHora(hora: string): string {
    return hora?.slice(0, 5) ?? '';
  }

  protected etiquetaClase(clase: string): string {
    if (clase === 'BUSINESS') return this.i18n.t('seats.businessClass');
    if (clase === 'PRIMERA') return this.i18n.t('seats.firstClass');
    return this.i18n.t('seats.economyClass');
  }

  protected describirEquipajes(pasaje: PasajeReserva): string {
    const es = this.i18n.isSpanish();
    const nombres: Record<string, string> = es
      ? { CABINA: 'Cabina', BODEGA: 'Bodega', MANO: 'De mano' }
      : { CABINA: 'Cabin', BODEGA: 'Checked', MANO: 'Carry-on' };
    return pasaje.equipajes
      .map((e) => `${nombres[e.tipo] ?? e.tipo}${e.peso ? ` (${e.peso} kg)` : ''}`)
      .join(', ');
  }

  // ===================== Auxiliares =====================

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