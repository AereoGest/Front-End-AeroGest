import { Component, HostListener, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
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
type Toast = { texto: string; tipo: 'exito' | 'info' | 'error' };

// Debe coincidir con la duración de las animaciones overlay-out / modal-out del CSS (igual que vuelos-admin)
const DURACION_CIERRE_MS = 400;

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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CampoPasajero = 'nombre' | 'apellido' | 'fechaNacimiento' | 'documento' | 'email' | 'asiento';
type ErroresPasajero = Partial<Record<CampoPasajero, TranslationKey>>;

interface ErroresAlta {
  cliente?: TranslationKey;
  vuelo?: TranslationKey;
  pasajeros: ErroresPasajero[];
}

interface ErroresEdicion {
  cliente?: TranslationKey;
  valor?: TranslationKey;
}

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
    /** Se activa al intentar guardar: recién ahí se marcan los obligatorios vacíos (igual que vuelos-admin). */
  protected readonly intentoGuardarAlta = signal(false);

  // ── Modal Modificación ──
  protected readonly reservaEnEdicion = signal<Reserva | null>(null);
  protected readonly guardandoEdicion = signal(false);
  protected readonly errorFormularioEdicion = signal('');
  protected readonly edicionClienteId = signal<number | null>(null);
  protected readonly edicionEstado = signal<EstadoReserva>('PROCESANDO');
  protected readonly edicionValor = signal<number>(0);
  protected readonly intentoGuardarEdicion = signal(false);

  // ── Modal Baja (Confirmar cancelación lógica) ──
  protected readonly reservaParaBaja = signal<Reserva | null>(null);
  protected readonly procesandoBaja = signal(false);
  // Bandera de "cerrando": activa la animación de salida del aviso de baja
  protected readonly cerrandoBaja = signal(false);

  // ── Toast de la baja (se oculta solo a los 4 segundos, igual que vuelos-admin) ──
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

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

    /** Errores del alta, por campo y por pasajero. */
  protected readonly erroresAlta = computed<ErroresAlta>(() => {
    const intento = this.intentoGuardarAlta();
    const hoy = hoyLocal();
    const docsVistos = new Set<string>();
    const asientosVistos = new Set<number>();

    const pasajeros = this.altaPasajeros().map((p) => {
      const e: ErroresPasajero = {};

      // Nombre y apellido: formato en vivo, obligatorio al guardar
      const nombre = p.nombre.trim();
      if (nombre && !SOLO_LETRAS.test(nombre)) e.nombre = 'booking.namePattern';
      else if (!nombre && intento) e.nombre = 'booking.nameRequired';

      const apellido = p.apellido.trim();
      if (apellido && !SOLO_LETRAS.test(apellido)) e.apellido = 'booking.lastNamePattern';
      else if (!apellido && intento) e.apellido = 'booking.lastNameRequired';

      // Fecha de nacimiento: tiene que ser anterior a hoy
      if (p.fechaNacimiento && p.fechaNacimiento >= hoy) e.fechaNacimiento = 'booking.birthDateFuture';
      else if (!p.fechaNacimiento && intento) e.fechaNacimiento = 'booking.birthDateRequired';

      // Documento: formato según el tipo y que no se repita entre pasajeros
      const doc = normalizarDocumento(p.documento);
      if (doc) {
        const esDni = p.tipoDocumento === 'DNI';
        const valido = esDni ? DNI_REGEX.test(doc) : PASAPORTE_REGEX.test(doc);
        if (!valido) {
          e.documento = esDni ? 'booking.dniPattern' : 'booking.passportPattern';
        } else {
          const clave = `${p.tipoDocumento}-${doc}`;
          if (docsVistos.has(clave)) e.documento = 'adminBookings.validationDuplicateDoc';
          docsVistos.add(clave);
        }
      } else if (intento) {
        e.documento = 'booking.docRequired';
      }

      // Email: opcional, pero si se escribe tiene que ser válido
      const email = p.email.trim();
      if (email && !EMAIL_REGEX.test(email)) e.email = 'booking.emailInvalid';

      // Asiento: opcional, pero no puede repetirse
      if (p.asientoId !== null && p.asientoId !== undefined) {
        const n = Number(p.asientoId);
        if (asientosVistos.has(n)) e.asiento = 'adminBookings.validationDuplicateSeat';
        asientosVistos.add(n);
      }

      return e;
    });

    return {
      cliente: intento && !this.altaPersonaId() ? 'adminBookings.validationClientRequired' : undefined,
      vuelo: intento && !this.altaVueloId() ? 'adminBookings.validationFlightRequired' : undefined,
      pasajeros,
    };
  });

  protected readonly hayErroresAlta = computed(() => {
    const e = this.erroresAlta();
    return !!e.cliente || !!e.vuelo || e.pasajeros.some((p) => Object.keys(p).length > 0);
  });

  /** Errores de la modificación. */
  protected readonly erroresEdicion = computed<ErroresEdicion>(() => {
    const e: ErroresEdicion = {};
    if (this.intentoGuardarEdicion() && !this.edicionClienteId()) {
      e.cliente = 'adminBookings.validationClientRequired';
    }
    const valor = Number(this.edicionValor());
    if (Number.isNaN(valor) || valor < 0) e.valor = 'adminBookings.validationValueInvalid';
    return e;
  });

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
    this.intentoGuardarAlta.set(false);
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

    protected actualizarPasajero<K extends keyof PasajeroAdminForm>(
    index: number,
    campo: K,
    valor: PasajeroAdminForm[K]
  ): void {
    this.altaPasajeros.update((lista) =>
      lista.map((p, i) => (i === index ? { ...p, [campo]: valor } : p))
    );
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
    this.intentoGuardarAlta.set(true);

    // Los errores ya se muestran debajo de cada campo
    if (this.hayErroresAlta()) return;

    const pasajesPayload: PasajeRequest[] = this.altaPasajeros().map((p) => ({
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
      personaId: Number(this.altaPersonaId()),
      vueloId: Number(this.altaVueloId()),
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
          // Solo los errores del backend quedan arriba, como mensaje general
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
    this.intentoGuardarEdicion.set(false);
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
    this.intentoGuardarEdicion.set(true);
    if (Object.keys(this.erroresEdicion()).length > 0) return;

    const dto: ReservaUpdateDTO = {
      clienteId: Number(this.edicionClienteId()),
      estadoReserva: this.edicionEstado(),
      valor: Number(this.edicionValor()),
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
    this.cerrandoBaja.set(false);
    this.reservaParaBaja.set(reserva);
  }

  /** El usuario eligió no dar de baja: se cierra el aviso y se informa con un toast. */
  protected cancelarBaja(): void {
    const reserva = this.reservaParaBaja();
    if (!reserva || this.procesandoBaja() || this.cerrandoBaja()) return;
    this.cerrarAlertaBaja();
    this.mostrarToast(
      this.i18n.t('adminBookings.toastDeleteCancelled', { code: this.codigoReserva(reserva) }),
      'info'
    );
  }

  protected confirmarBajaReserva(): void {
    const reserva = this.reservaParaBaja();
    if (!reserva) return;

    this.procesandoBaja.set(true);

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
          this.cerrarAlertaBaja();
          this.mostrarToast(this.i18n.t('adminBookings.canceledSuccess'), 'exito');
        },
        error: (err: HttpErrorResponse) => {
          this.cerrarAlertaBaja();
          this.mostrarToast(err.error?.message || this.i18n.t('common.error'), 'error');
        },
      })
      .add(() => this.procesandoBaja.set(false));
  }

  private cerrarAlertaBaja(): void {
    this.cerrarConAnimacion(this.cerrandoBaja, () => this.reservaParaBaja.set(null));
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
      this.cancelarBaja();
    } else if (this.reservaEnEdicion()) {
      this.cerrarModalEdicion();
    } else if (this.modalAltaAbierto()) {
      this.cerrarModalAlta();
    } else if (this.reservaDetalle()) {
      this.cerrarDetalle();
    }
  }
}
