import { Component, HostListener, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReservaService } from '../../../services/reservaService';
import { Asiento, AsientoService } from '../../../services/asiento';
import { EquipajeService } from '../../../services/equipajeService';
import { AsistenciaService } from '../../../services/asistenciaService';
import {
  EstadoReserva,
  PasajeReserva,
  PasajeUpdateDTO,
  Reserva,
} from '../../../Models/Reserva';
import { Equipaje } from '../../../Models/Equipaje';
import { Asistencia } from '../../../Models/Asistencia';
import { ClaseVuelo } from '../../../Models/Carrito';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../../../Models/Perfil';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { I18nService } from '../../../services/i18n';
import type { TranslationKey } from '../../../i18n/es';

export interface PasajeConReserva {
  reserva: Reserva;
  pasaje: PasajeReserva;
}

type Toast = { texto: string; tipo: 'exito' | 'info' | 'error' };

// Debe coincidir con la duración de las animaciones overlay-out / modal-out del CSS (igual que vuelos-admin)
const DURACION_CIERRE_MS = 400;

const SOLO_LETRAS = /^\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*\s*$/;
const DNI_REGEX = /^\d{7,8}$/;
const PASAPORTE_REGEX = /^[A-Z0-9]{6,20}$/;

function normalizarDocumento(doc: string): string {
  return doc.replace(/[\s.\-]/g, '').toUpperCase();
}

function hoyLocal(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

@Component({
  selector: 'app-pasajes-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './pasajes-admin.html',
  styleUrl: './pasajes-admin.css',
})
export class PasajesAdmin implements OnInit {
  private readonly reservaService = inject(ReservaService);
  private readonly asientoService = inject(AsientoService);
  private readonly equipajeService = inject(EquipajeService);
  private readonly asistenciaService = inject(AsistenciaService);
  protected readonly i18n = inject(I18nService);

  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly clasesVuelo: readonly ClaseVuelo[] = ['ECONOMICA', 'TURISTA', 'BUSINESS', 'PRIMERA'];

  // ── Estado general ──
  protected readonly reservas = signal<Reserva[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');

  // ── Filtros ──
  protected readonly busqueda = signal('');
  protected readonly reservaSeleccionadaId = signal<number | null>(null);

  // ── Catálogos auxiliares ──
  protected readonly asientosAvion = signal<Asiento[]>([]);
  protected readonly equipajesCatalogo = signal<Equipaje[]>([]);
  protected readonly asistenciasCatalogo = signal<Asistencia[]>([]);

  // ── Modal Modificación de pasaje ──
  protected readonly itemEnEdicion = signal<PasajeConReserva | null>(null);
  protected readonly guardandoEdicion = signal(false);
  protected readonly errorEdicion = signal('');
  protected readonly editNombre = signal('');
  protected readonly editApellido = signal('');
  protected readonly editTipoDocumento = signal<TipoDocumento>('DNI');
  protected readonly editDocumento = signal('');
  protected readonly editFechaNacimiento = signal('');
  protected readonly editEmail = signal('');
  protected readonly editClase = signal<ClaseVuelo>('ECONOMICA');
  protected readonly editAsientoId = signal<number | null>(null);
  protected readonly editAsistenciaId = signal<number | null>(null);
  protected readonly editEquipajeIds = signal<number[]>([]);

  // ── Modal Cancelación de pasaje ──
  protected readonly itemParaCancelar = signal<PasajeConReserva | null>(null);
  protected readonly procesandoCancelacion = signal(false);
  // Bandera de "cerrando": activa la animación de salida del aviso de baja
  protected readonly cerrandoBaja = signal(false);

  // ── Toast de la baja (se oculta solo a los 4 segundos, igual que vuelos-admin) ──
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly reservasConPasajes = computed(() =>
    this.reservas().filter((r) => r.pasajes && r.pasajes.length > 0)
  );

  protected readonly reservasFiltradas = computed(() => {
    const q = this.normalizarTexto(this.busqueda());
    const idFiltro = this.reservaSeleccionadaId();

    return this.reservasConPasajes()
      .filter((r) => (idFiltro === null ? true : r.id === idFiltro))
      .map((r) => {
        if (!q) return r;
        const coincideReserva =
          this.normalizarTexto(r.codigoReserva ?? '').includes(q) ||
          String(r.id).includes(q) ||
          this.normalizarTexto(`${r.persona?.nombre ?? ''} ${r.persona?.apellido ?? ''}`).includes(q);

        if (coincideReserva) return r;

        const pasajesCoincidentes = (r.pasajes ?? []).filter((p) => {
          const nombre = this.normalizarTexto(`${p.nombre ?? ''} ${p.apellido ?? ''}`);
          const doc = this.normalizarTexto(p.documento ?? '');
          const cod = this.normalizarTexto(p.codigoPasaje ?? '');
          return nombre.includes(q) || doc.includes(q) || cod.includes(q);
        });

        return { ...r, pasajes: pasajesCoincidentes };
      })
      .filter((r) => r.pasajes && r.pasajes.length > 0);
  });

  protected readonly asientosOpcionesEdicion = computed(() => {
    const actualAsiento = this.itemEnEdicion()?.pasaje.asiento;
    return this.asientosAvion().filter(
      (a) => !a.ocupado || (actualAsiento && a.id === actualAsiento.id)
    );
  });

  ngOnInit(): void {
    this.cargarReservas();
    this.cargarCatalogos();
  }

  protected cargarReservas(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);

    this.reservaService
      .obtenerTodas()
      .subscribe({
        next: (data) => this.reservas.set(data ?? []),
        error: (err: HttpErrorResponse) => {
          this.reservas.set([]);
          this.errorCarga.set(err.error?.message || this.i18n.t('adminTickets.loadError'));
        },
      })
      .add(() => this.cargando.set(false));
  }

  protected cargarCatalogos(): void {
    this.equipajeService.obtenerTodos().subscribe({
      next: (eq) => this.equipajesCatalogo.set(eq ?? []),
      error: () => this.equipajesCatalogo.set([]),
    });

    this.asistenciaService.obtenerTodas().subscribe({
      next: (asist) => this.asistenciasCatalogo.set(asist ?? []),
      error: () => this.asistenciasCatalogo.set([]),
    });
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.reservaSeleccionadaId.set(null);
  }

  // ===================== Modificación de pasaje =====================

  protected abrirModalEdicion(reserva: Reserva, pasaje: PasajeReserva): void {
    if (reserva.estadoReserva === 'CANCELADA') return;

    this.limpiarMensajes();
    this.errorEdicion.set('');
    this.itemEnEdicion.set({ reserva, pasaje });

    this.editNombre.set(pasaje.nombre ?? '');
    this.editApellido.set(pasaje.apellido ?? '');
    this.editTipoDocumento.set(pasaje.tipoDocumento ?? 'DNI');
    this.editDocumento.set(pasaje.documento ?? '');
    this.editFechaNacimiento.set(pasaje.fechaNacimiento ?? '');
    this.editEmail.set(pasaje.email ?? '');
    this.editClase.set(pasaje.clasesVuelo ?? 'ECONOMICA');
    this.editAsientoId.set(pasaje.asiento?.id ?? null);
    this.editAsistenciaId.set(pasaje.asistenciaAlViajero?.id ?? null);
    this.editEquipajeIds.set((pasaje.equipajes ?? []).map((e) => e.id));

    this.asientosAvion.set([]);
    const avionId = pasaje.vuelo?.avion?.id;
    if (avionId) {
      this.asientoService.obtenerPorAvion(avionId).subscribe({
        next: (asientos) => this.asientosAvion.set(asientos ?? []),
        error: () => this.asientosAvion.set([]),
      });
    }
  }

  protected cerrarModalEdicion(): void {
    if (this.guardandoEdicion()) return;
    this.itemEnEdicion.set(null);
  }

  protected alternarEquipajeEdicion(equipajeId: number, checked: boolean): void {
    this.editEquipajeIds.update((actuales) => {
      const sinEste = actuales.filter((id) => id !== equipajeId);
      return checked ? [...sinEste, equipajeId] : sinEste;
    });
  }

  protected guardarEdicionPasaje(): void {
    const item = this.itemEnEdicion();
    if (!item) return;

    this.errorEdicion.set('');
    const nombre = this.editNombre().trim();
    const apellido = this.editApellido().trim();
    const tipoDoc = this.editTipoDocumento();
    const docNorm = normalizarDocumento(this.editDocumento());
    const fechaNac = this.editFechaNacimiento();

    const nombreValido = SOLO_LETRAS.test(nombre);
    const apellidoValido = SOLO_LETRAS.test(apellido);
    const docValido = tipoDoc === 'DNI' ? DNI_REGEX.test(docNorm) : PASAPORTE_REGEX.test(docNorm);
    const fechaValida = !fechaNac || fechaNac < hoyLocal();

    if (!nombreValido || !apellidoValido || !docValido || !fechaValida) {
      this.errorEdicion.set(this.i18n.t('adminTickets.validationFields'));
      return;
    }

    const dto: PasajeUpdateDTO = {
      codigoPasaje: item.pasaje.codigoPasaje,
      reservaId: item.reserva.id,
      vueloId: item.pasaje.vuelo.id,
      asientoId: this.editAsientoId() ? Number(this.editAsientoId()) : null,
      clasesVuelo: this.editClase(),
      equipajeIds: this.editEquipajeIds(),
      asistenciaId: this.editAsistenciaId() ? Number(this.editAsistenciaId()) : null,
      nombre,
      apellido,
      tipoDocumento: tipoDoc,
      documento: docNorm,
      fechaNacimiento: fechaNac || null,
      email: this.editEmail().trim() || null,
    };

    this.guardandoEdicion.set(true);
    this.reservaService
      .actualizarPasaje(item.pasaje.id, dto)
      .subscribe({
        next: () => {
          this.itemEnEdicion.set(null);
          this.mostrarExito(this.i18n.t('adminTickets.updatedSuccess'));
          this.cargarReservas();
        },
        error: (err: HttpErrorResponse) => {
          this.errorEdicion.set(err.error?.message || this.i18n.t('common.error'));
        },
      })
      .add(() => this.guardandoEdicion.set(false));
  }

  // ===================== Cancelación de pasaje =====================

  protected abrirModalCancelacion(reserva: Reserva, pasaje: PasajeReserva): void {
    if (reserva.estadoReserva === 'CANCELADA') return;

    this.limpiarMensajes();
    this.cerrandoBaja.set(false);
    this.itemParaCancelar.set({ reserva, pasaje });
  }

  /** El usuario eligió no dar de baja: se cierra el aviso y se informa con un toast. */
  protected cancelarBaja(): void {
    const item = this.itemParaCancelar();
    if (!item || this.procesandoCancelacion() || this.cerrandoBaja()) return;
    this.cerrarAlertaBaja();
    this.mostrarToast(
      this.i18n.t('adminTickets.toastDeleteCancelled', { code: item.pasaje.codigoPasaje }),
      'info'
    );
  }

  protected confirmarCancelacionPasaje(): void {
    const item = this.itemParaCancelar();
    if (!item) return;

    this.procesandoCancelacion.set(true);

    this.reservaService
      .cancelarPasaje(item.pasaje.id, item.reserva.id)
      .subscribe({
        next: () => {
          this.cerrarAlertaBaja();
          this.mostrarToast(this.i18n.t('adminTickets.canceledSuccess'), 'exito');
          this.cargarReservas();
        },
        error: (err: HttpErrorResponse) => {
          this.cerrarAlertaBaja();
          this.mostrarToast(err.error?.message || this.i18n.t('common.error'), 'error');
        },
      })
      .add(() => this.procesandoCancelacion.set(false));
  }

  private cerrarAlertaBaja(): void {
    this.cerrarConAnimacion(this.cerrandoBaja, () => this.itemParaCancelar.set(null));
  }

  /**
   * Marca el aviso como "cerrando" para que corra el fade-out (clase .cerrando)
   * y recién cuando termina la animación lo saca del DOM.
   */
  private cerrarConAnimacion(cerrando: WritableSignal<boolean>, quitar: () => void): void {
    if (cerrando()) return;
    cerrando.set(true);
    setTimeout(() => {
      quitar();
      cerrando.set(false);
    }, DURACION_CIERRE_MS);
  }

  // ── Toast ──
  private mostrarToast(texto: string, tipo: Toast['tipo']): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ texto, tipo });
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }

  protected cerrarToast(): void {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  // ===================== Helpers =====================

  protected codigoReserva(reserva: Reserva): string {
    return reserva.codigoReserva ?? `#${reserva.id}`;
  }

  protected estadoReservaKey(estado: EstadoReserva): TranslationKey {
    return `adminBookings.status.${estado}` as TranslationKey;
  }

  protected formatearPrecio(valor: number): string {
    return `$${(valor ?? 0).toLocaleString('es-AR')}`;
  }

  protected describirExtras(pasaje: PasajeReserva): string {
    const partes: string[] = [];
    if (pasaje.equipajes && pasaje.equipajes.length > 0) {
      partes.push(pasaje.equipajes.map((e) => `${e.tipo}${e.peso ? ` (${e.peso}kg)` : ''}`).join(', '));
    }
    if (pasaje.asistenciaAlViajero?.nombrePlan) {
      partes.push(pasaje.asistenciaAlViajero.nombrePlan);
    }
    return partes.join(' · ');
  }

  private normalizarTexto(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private mostrarExito(texto: string): void {
    this.mensajeExito.set(texto);
    setTimeout(() => this.mensajeExito.set(''), 4000);
  }

  private limpiarMensajes(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.itemParaCancelar()) {
      this.cancelarBaja();
    } else if (this.itemEnEdicion()) {
      this.cerrarModalEdicion();
    }
  }
}
