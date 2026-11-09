import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReservaService } from '../../../services/reservaService';
import { VueloService } from '../../../services/vuelo';
import { Asiento, AsientoService } from '../../../services/asiento';
import { EquipajeService } from '../../../services/equipajeService';
import { AsistenciaService } from '../../../services/asistenciaService';
import {
  EstadoReserva,
  PasajeRequest,
  PersonaResumen,
  Reserva,
  ReservaAdminRequest,
  ReservaUpdateDTO,
} from '../../../Models/Reserva';
import { Vuelo } from '../../../Models/Vuelo';
import { Equipaje } from '../../../Models/Equipaje';
import { Asistencia } from '../../../Models/Asistencia';
import { ClaseVuelo } from '../../../Models/Carrito';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../../../Models/Perfil';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { I18nService } from '../../../services/i18n';
import type { TranslationKey } from '../../../i18n/es';

type FiltroTab = 'TODAS' | 'ACTIVAS' | 'CONFIRMADAS' | 'PROCESANDO' | 'CANCELADAS';

export interface PasajeroAdminForm {
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  fechaNacimiento: string;
  email: string;
  clasesVuelo: ClaseVuelo;
  asientoId: number | null;
  asistenciaId: number | null;
  equipajeIds: number[];
}

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
  selector: 'app-reservas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './reservas-admin.html',
  styleUrl: './reservas-admin.css',
})
export class ReservasAdmin implements OnInit {
  private readonly reservaService = inject(ReservaService);
  private readonly vueloService = inject(VueloService);
  private readonly asientoService = inject(AsientoService);
  private readonly equipajeService = inject(EquipajeService);
  private readonly asistenciaService = inject(AsistenciaService);
  protected readonly i18n = inject(I18nService);

  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly clasesVuelo: readonly ClaseVuelo[] = ['ECONOMICA', 'TURISTA', 'BUSINESS', 'PRIMERA'];
  protected readonly estadosReserva: readonly EstadoReserva[] = ['PROCESANDO', 'CONFIRMADO', 'ACTIVO', 'CANCELADA'];

  // ── Estado principal del listado ──
  protected readonly reservas = signal<Reserva[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');

  // ── Filtros y búsqueda ──
  protected readonly tabActiva = signal<FiltroTab>('TODAS');
  protected readonly busqueda = signal('');

  // ── Catálogos auxiliares para alta y modificación ──
  protected readonly clientes = signal<PersonaResumen[]>([]);
  protected readonly vuelosDisponibles = signal<Vuelo[]>([]);
  protected readonly asientosAvion = signal<Asiento[]>([]);
  protected readonly equipajesCatalogo = signal<Equipaje[]>([]);
  protected readonly asistenciasCatalogo = signal<Asistencia[]>([]);

  // ── Modal Detalle ──
  protected readonly reservaDetalle = signal<Reserva | null>(null);

  // ── Modal Alta (Crear reserva) ──
  protected readonly modalAltaAbierto = signal(false);
  protected readonly creando = signal(false);
  protected readonly errorFormularioAlta = signal('');
  protected readonly altaPersonaId = signal<number | null>(null);
  protected readonly altaVueloId = signal<number | null>(null);
  protected readonly altaPasajeros = signal<PasajeroAdminForm[]>([this.crearPasajeroVacio()]);

  // ── Modal Modificación ──
  protected readonly reservaEnEdicion = signal<Reserva | null>(null);
  protected readonly guardandoEdicion = signal(false);
  protected readonly errorFormularioEdicion = signal('');
  protected readonly edicionClienteId = signal<number | null>(null);
  protected readonly edicionEstado = signal<EstadoReserva>('PROCESANDO');
  protected readonly edicionValor = signal<number>(0);

  // ── Modal Baja (Confirmar cancelación lógica) ──
  protected readonly reservaParaBaja = signal<Reserva | null>(null);
  protected readonly procesandoBaja = signal(false);
  protected readonly errorBaja = signal('');

  // ── Contadores y filtrado reactivo ──
  protected readonly reservasBuscadas = computed(() => {
    const q = this.normalizarTexto(this.busqueda());
    if (!q) return this.reservas();

    return this.reservas().filter((r) => {
      const codigo = this.normalizarTexto(r.codigoReserva ?? '');
      const idStr = String(r.id);
      const titular = this.normalizarTexto(`${r.persona?.nombre ?? ''} ${r.persona?.apellido ?? ''}`);
      const email = this.normalizarTexto(r.persona?.email ?? '');
      const doc = this.normalizarTexto(r.persona?.numeroIdentificador ?? '');
      const estado = this.normalizarTexto(r.estadoReserva);
      return (
        codigo.includes(q) ||
        idStr.includes(q) ||
        titular.includes(q) ||
        email.includes(q) ||
        doc.includes(q) ||
        estado.includes(q)
      );
    });
  });

  protected readonly totalTodas = computed(() => this.reservasBuscadas().length);
  protected readonly totalActivas = computed(
    () => this.reservasBuscadas().filter((r) => r.estadoReserva !== 'CANCELADA').length
  );
  protected readonly totalConfirmadas = computed(
    () => this.reservasBuscadas().filter((r) => r.estadoReserva === 'CONFIRMADO' || r.estadoReserva === 'ACTIVO').length
  );
  protected readonly totalProcesando = computed(
    () => this.reservasBuscadas().filter((r) => r.estadoReserva === 'PROCESANDO').length
  );
  protected readonly totalCanceladas = computed(
    () => this.reservasBuscadas().filter((r) => r.estadoReserva === 'CANCELADA').length
  );

  protected readonly reservasFiltradas = computed(() => {
    const tab = this.tabActiva();
    const base = this.reservasBuscadas();
    const filtradas = base.filter((r) => {
      switch (tab) {
        case 'ACTIVAS':
          return r.estadoReserva !== 'CANCELADA';
        case 'CONFIRMADAS':
          return r.estadoReserva === 'CONFIRMADO' || r.estadoReserva === 'ACTIVO';
        case 'PROCESANDO':
          return r.estadoReserva === 'PROCESANDO';
        case 'CANCELADAS':
          return r.estadoReserva === 'CANCELADA';
        default:
          return true;
      }
    });

    return [...filtradas].sort(
      (a, b) => (new Date(b.fechaReserva).getTime() || 0) - (new Date(a.fechaReserva).getTime() || 0)
    );
  });

  protected readonly asientosDisponibles = computed(() =>
    this.asientosAvion().filter((a) => !a.ocupado)
  );

  ngOnInit(): void {
    this.cargarReservas();
    this.cargarCatalogosAuxiliares();
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
          this.errorCarga.set(err.error?.message || this.i18n.t('adminBookings.loadError'));
        },
      })
      .add(() => this.cargando.set(false));
  }

  protected cargarCatalogosAuxiliares(): void {
    this.reservaService.obtenerClientes().subscribe({
      next: (clientes) => {
        const filtrados = (clientes ?? []).filter(
          (c) => c.nombre && c.nombre.toLowerCase() !== 'pendiente'
        );
        this.clientes.set(filtrados.length > 0 ? filtrados : (clientes ?? []));
      },
      error: () => this.clientes.set([]),
    });

    this.vueloService.obtenerDisponibles().subscribe({
      next: (vuelos) => this.vuelosDisponibles.set(vuelos ?? []),
      error: () => this.vuelosDisponibles.set([]),
    });

    this.equipajeService.obtenerTodos().subscribe({
      next: (equipajes) => this.equipajesCatalogo.set(equipajes ?? []),
      error: () => this.equipajesCatalogo.set([]),
    });

    this.asistenciaService.obtenerTodas().subscribe({
      next: (asistencias) => this.asistenciasCatalogo.set(asistencias ?? []),
      error: () => this.asistenciasCatalogo.set([]),
    });
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.tabActiva.set('TODAS');
  }

  // ===================== Alta de reserva =====================

  protected abrirModalAlta(): void {
    this.limpiarMensajes();
    this.errorFormularioAlta.set('');
    this.altaPersonaId.set(null);
    this.altaVueloId.set(null);
    this.asientosAvion.set([]);
    this.altaPasajeros.set([this.crearPasajeroVacio()]);
    this.modalAltaAbierto.set(true);
  }

  protected cerrarModalAlta(): void {
    if (this.creando()) return;
    this.modalAltaAbierto.set(false);
  }

  protected alCambiarVueloAlta(vueloIdValor: string | number | null): void {
    const id = vueloIdValor ? Number(vueloIdValor) : null;
    this.altaVueloId.set(id);
    this.asientosAvion.set([]);

    // Limpiar asientos seleccionados al cambiar de avión/vuelo
    this.altaPasajeros.update((lista) => lista.map((p) => ({ ...p, asientoId: null })));

    if (!id) return;
    const vuelo = this.vuelosDisponibles().find((v) => Number(v.id) === id);
    const avionId = vuelo?.avion?.id;
    if (avionId) {
      this.asientoService.obtenerPorAvion(avionId).subscribe({
        next: (asientos) => this.asientosAvion.set(asientos ?? []),
        error: () => this.asientosAvion.set([]),
      });
    }
  }

  protected agregarPasajeroAlta(): void {
    this.altaPasajeros.update((lista) => [...lista, this.crearPasajeroVacio()]);
  }

  protected quitarPasajeroAlta(index: number): void {
    if (this.altaPasajeros().length <= 1) return;
    this.altaPasajeros.update((lista) => lista.filter((_, i) => i !== index));
  }

  protected alternarEquipajePasajero(index: number, equipajeId: number, checked: boolean): void {
    this.altaPasajeros.update((lista) =>
      lista.map((p, i) => {
        if (i !== index) return p;
        const sinActual = p.equipajeIds.filter((id) => id !== equipajeId);
        return {
          ...p,
          equipajeIds: checked ? [...sinActual, equipajeId] : sinActual,
        };
      })
    );
  }

  protected guardarNuevaReserva(): void {
    this.errorFormularioAlta.set('');

    const personaId = this.altaPersonaId();
    if (!personaId) {
      this.errorFormularioAlta.set(this.i18n.t('adminBookings.validationClientRequired'));
      return;
    }

    const vueloId = this.altaVueloId();
    if (!vueloId) {
      this.errorFormularioAlta.set(this.i18n.t('adminBookings.validationFlightRequired'));
      return;
    }

    const pasajeros = this.altaPasajeros();
    const hoy = hoyLocal();
    const docsVistos = new Set<string>();
    const asientosVistos = new Set<number>();

    for (const p of pasajeros) {
      const nombreValido = SOLO_LETRAS.test(p.nombre);
      const apellidoValido = SOLO_LETRAS.test(p.apellido);
      const docNorm = normalizarDocumento(p.documento);
      const docValido =
        p.tipoDocumento === 'DNI' ? DNI_REGEX.test(docNorm) : PASAPORTE_REGEX.test(docNorm);
      const fechaValida = !!p.fechaNacimiento && p.fechaNacimiento < hoy;

      if (!nombreValido || !apellidoValido || !docValido || !fechaValida) {
        this.errorFormularioAlta.set(this.i18n.t('adminBookings.validationPassengerFields'));
        return;
      }

      const claveDoc = `${p.tipoDocumento}-${docNorm}`;
      if (docsVistos.has(claveDoc)) {
        this.errorFormularioAlta.set(this.i18n.t('adminBookings.validationDuplicateDoc'));
        return;
      }
      docsVistos.add(claveDoc);

      if (p.asientoId !== null && p.asientoId !== undefined) {
        const asientoNum = Number(p.asientoId);
        if (asientosVistos.has(asientoNum)) {
          this.errorFormularioAlta.set(this.i18n.t('adminBookings.validationDuplicateSeat'));
          return;
        }
        asientosVistos.add(asientoNum);
      }
    }

    const pasajesPayload: PasajeRequest[] = pasajeros.map((p) => ({
      clasesVuelo: p.clasesVuelo,
      asientoId: p.asientoId ? Number(p.asientoId) : undefined,
      equipajeIds: p.equipajeIds,
      asistenciaId: p.asistenciaId ? Number(p.asistenciaId) : null,
      nombre: p.nombre.trim(),
      apellido: p.apellido.trim(),
      tipoDocumento: p.tipoDocumento,
      documento: normalizarDocumento(p.documento),
      fechaNacimiento: p.fechaNacimiento,
      email: p.email.trim(),
    }));

    const payload: ReservaAdminRequest = {
      personaId: Number(personaId),
      vueloId: Number(vueloId),
      cantidadPasajes: pasajesPayload.length,
      pasajes: pasajesPayload,
    };

    this.creando.set(true);
    this.reservaService
      .crearReservaAdmin(payload)
      .subscribe({
        next: (creada) => {
          this.reservas.update((actuales) => [creada, ...actuales]);
          this.modalAltaAbierto.set(false);
          this.mostrarExito(this.i18n.t('adminBookings.createdSuccess'));
        },
        error: (err: HttpErrorResponse) => {
          this.errorFormularioAlta.set(err.error?.message || this.i18n.t('common.error'));
        },
      })
      .add(() => this.creando.set(false));
  }

  private crearPasajeroVacio(): PasajeroAdminForm {
    return {
      nombre: '',
      apellido: '',
      tipoDocumento: 'DNI',
      documento: '',
      fechaNacimiento: '',
      email: '',
      clasesVuelo: 'ECONOMICA',
      asientoId: null,
      asistenciaId: null,
      equipajeIds: [],
    };
  }

  // ===================== Modificación de reserva =====================

  protected abrirModalEdicion(reserva: Reserva, event?: Event): void {
    event?.stopPropagation();
    if (reserva.estadoReserva === 'CANCELADA') return;

    this.limpiarMensajes();
    this.errorFormularioEdicion.set('');
    this.reservaEnEdicion.set(reserva);
    this.edicionClienteId.set(reserva.persona?.id ?? null);
    this.edicionEstado.set(reserva.estadoReserva);
    this.edicionValor.set(reserva.valor);
  }

  protected cerrarModalEdicion(): void {
    if (this.guardandoEdicion()) return;
    this.reservaEnEdicion.set(null);
  }

  protected guardarEdicionReserva(): void {
    const reserva = this.reservaEnEdicion();
    if (!reserva) return;

    this.errorFormularioEdicion.set('');
    const clienteId = this.edicionClienteId();
    if (!clienteId) {
      this.errorFormularioEdicion.set(this.i18n.t('adminBookings.validationClientRequired'));
      return;
    }

    const valor = Number(this.edicionValor());
    if (Number.isNaN(valor) || valor < 0) {
      this.errorFormularioEdicion.set(this.i18n.t('adminBookings.validationValueInvalid'));
      return;
    }

    const dto: ReservaUpdateDTO = {
      clienteId: Number(clienteId),
      estadoReserva: this.edicionEstado(),
      valor,
      cantidadPasajes: reserva.pasajes?.length ?? reserva.cantidadPasajes,
      fechaReserva: reserva.fechaReserva,
    };

    this.guardandoEdicion.set(true);
    this.reservaService
      .actualizarReserva(reserva.id, dto)
      .subscribe({
        next: (actualizada) => {
          this.reservas.update((lista) =>
            lista.map((r) => (r.id === actualizada.id ? actualizada : r))
          );
          this.reservaEnEdicion.set(null);
          this.mostrarExito(this.i18n.t('adminBookings.updatedSuccess'));
        },
        error: (err: HttpErrorResponse) => {
          this.errorFormularioEdicion.set(err.error?.message || this.i18n.t('common.error'));
        },
      })
      .add(() => this.guardandoEdicion.set(false));
  }

  // ===================== Baja lógica de reserva =====================

  protected abrirModalBaja(reserva: Reserva, event?: Event): void {
    event?.stopPropagation();
    if (reserva.estadoReserva === 'CANCELADA') return;

    this.limpiarMensajes();
    this.errorBaja.set('');
    this.reservaParaBaja.set(reserva);
  }

  protected cerrarModalBaja(): void {
    if (this.procesandoBaja()) return;
    this.reservaParaBaja.set(null);
  }

  protected confirmarBajaReserva(): void {
    const reserva = this.reservaParaBaja();
    if (!reserva) return;

    this.procesandoBaja.set(true);
    this.errorBaja.set('');

    this.reservaService
      .darDeBajaReserva(reserva.id)
      .subscribe({
        next: () => {
          this.reservas.update((lista) =>
            lista.map((r) =>
              r.id === reserva.id
                ? {
                    ...r,
                    estadoReserva: 'CANCELADA' as EstadoReserva,
                    pasajes: r.pasajes?.map((p) => ({ ...p, asiento: null })),
                  }
                : r
            )
          );
          this.reservaParaBaja.set(null);
          this.mostrarExito(this.i18n.t('adminBookings.canceledSuccess'));
        },
        error: (err: HttpErrorResponse) => {
          this.errorBaja.set(err.error?.message || this.i18n.t('common.error'));
        },
      })
      .add(() => this.procesandoBaja.set(false));
  }

  // ===================== Detalle de reserva =====================

  protected abrirDetalle(reserva: Reserva): void {
    this.reservaDetalle.set(reserva);
  }

  protected cerrarDetalle(): void {
    this.reservaDetalle.set(null);
  }

  // ===================== Helpers de formato =====================

  protected codigoReserva(reserva: Reserva): string {
    return reserva.codigoReserva ?? `#${reserva.id}`;
  }

  protected estadoKey(estado: EstadoReserva): TranslationKey {
    return `adminBookings.status.${estado}` as TranslationKey;
  }

  protected formatearPrecio(valor: number): string {
    return `$${(valor ?? 0).toLocaleString('es-AR')}`;
  }

  protected formatearFecha(fecha: string): string {
    if (!fecha) return '-';
    const locale = this.i18n.currentLang() === 'es' ? 'es-AR' : 'en-US';
    return new Date(fecha).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected etiquetaCliente(c: PersonaResumen): string {
    const nombreCompleto = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
    const doc = c.numeroIdentificador ? ` · ${c.identificador ?? 'DOC'} ${c.numeroIdentificador}` : '';
    const email = c.email ? ` (${c.email})` : '';
    return `${nombreCompleto || `#${c.id}`}${doc}${email}`;
  }

  protected etiquetaVuelo(v: Vuelo): string {
    const orig = `${v.aeropuertoOrigen?.ciudad ?? ''} (${v.aeropuertoOrigen?.codigoIata ?? ''})`;
    const dest = `${v.aeropuertoDestino?.ciudad ?? ''} (${v.aeropuertoDestino?.codigoIata ?? ''})`;
    const hora = v.horaSalida ? v.horaSalida.slice(0, 5) : '';
    return `#${v.id} · ${orig} → ${dest} · ${v.fechaSalida} ${hora} ($${v.precioVuelo})`;
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
    if (this.reservaParaBaja()) {
      this.cerrarModalBaja();
    } else if (this.reservaEnEdicion()) {
      this.cerrarModalEdicion();
    } else if (this.modalAltaAbierto()) {
      this.cerrarModalAlta();
    } else if (this.reservaDetalle()) {
      this.cerrarDetalle();
    }
  }
}
