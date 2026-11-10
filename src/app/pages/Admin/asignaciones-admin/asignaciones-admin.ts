import { Component, HostListener, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AsignacionService } from '../../../services/asignacion-service';
import { VueloService } from '../../../services/vuelo';
import { Asignacion, EmpleadoAsignacion, RolEmpleado } from '../../../Models/Asignacion';
import { Vuelo } from '../../../Models/Vuelo';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { I18nService } from '../../../services/i18n';
import type { TranslationKey } from '../../../i18n/es';

type Pestania = 'proximas' | 'historial' | 'todas';
type Toast = { texto: string; tipo: 'exito' | 'info' | 'error' };

// Debe coincidir con la duración de las animaciones overlay-out / modal-out del CSS (igual que vuelos-admin)
const DURACION_CIERRE_MS = 400;

interface EmpleadoOpcion {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-asignaciones-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, TranslatePipe],
  templateUrl: './asignaciones-admin.html',
  styleUrl: './asignaciones-admin.css',
})
export class AsignacionesAdmin implements OnInit {
  private readonly asignacionService = inject(AsignacionService);
  private readonly vueloService = inject(VueloService);
  protected readonly i18n = inject(I18nService);

  readonly roles: RolEmpleado[] = ['PILOTO', 'COPILOTO', 'AZAFATA'];
  readonly estados = ['PROGRAMADO', 'BOARDING', 'ACTIVO', 'CANCELADO', 'REPROGRAMADO'];

  // ── Datos principales ──
  asignaciones = signal<Asignacion[]>([]);
  vuelos = signal<Vuelo[]>([]);
  empleadosDisponibles = signal<EmpleadoAsignacion[]>([]);
  cargando = signal(true);
  error = signal(false);

  // ── Alertas de operación ──
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  // ── Filtros ──
  pestania = signal<Pestania>('proximas');
  busqueda = signal('');
  empleadoId = signal<number | null>(null);
  rol = signal('');
  estado = signal('');
  desde = signal(''); // 'yyyy-MM-dd'
  hasta = signal('');

  // ── Modales y estado de formularios ──
  modalAltaAbierto = signal(false);
  modalEdicionAbierto = signal(false);
  modalBajaAbierto = signal(false);
  guardando = signal(false);
  eliminando = signal(false);
  formularioError = signal<string | null>(null);

  // Formulario Alta
  altaVueloId = signal<number | null>(null);
  altaEmpleadoId = signal<number | null>(null);
  altaRol = signal<RolEmpleado>('PILOTO');

  // Formulario Edición
  asignacionEnEdicion = signal<Asignacion | null>(null);
  edicionVueloId = signal<number | null>(null);
  edicionEmpleadoId = signal<number | null>(null);
  edicionRol = signal<RolEmpleado>('PILOTO');

  // Modal Baja
  asignacionAEliminar = signal<Asignacion | null>(null);
  // Bandera de "cerrando": activa la animación de salida del aviso de baja
  cerrandoBaja = signal(false);

  // ── Toast de la baja (se oculta solo a los 4 segundos, igual que vuelos-admin) ──
  toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  /** Lista de empleados para el select de filtros (incluye asignados y catálogo). */
  empleados = computed<EmpleadoOpcion[]>(() => {
    const mapa = new Map<number, string>();
    for (const a of this.asignaciones()) {
      if (a.empleado) mapa.set(a.empleado.id, this.nombreEmpleado(a));
    }
    for (const e of this.empleadosDisponibles()) {
      mapa.set(e.id, `${e.apellido}, ${e.nombre}`);
    }
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre));
  });

  /** Asignaciones filtradas por todo menos la pestaña (para contadores). */
  filtradas = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const empleadoId = this.empleadoId();
    const rol = this.rol();
    const estado = this.estado();
    const desde = this.desde();
    const hasta = this.hasta();

    return this.asignaciones()
      .filter((a) => !empleadoId || a.empleado?.id === empleadoId)
      .filter((a) => !rol || a.rolEmpleado === rol)
      .filter((a) => !estado || a.vuelo.estado === estado)
      .filter((a) => !desde || a.vuelo.fechaSalida >= desde)
      .filter((a) => !hasta || a.vuelo.fechaSalida <= hasta)
      .filter((a) => !texto || this.normalizar(this.textoBuscable(a)).includes(texto))
      .sort((x, y) => this.salida(x).getTime() - this.salida(y).getTime());
  });

  proximas = computed(() => this.filtradas().filter((a) => !this.terminada(a)));
  historial = computed(() => this.filtradas().filter((a) => this.terminada(a)).reverse());

  visibles = computed(() => {
    switch (this.pestania()) {
      case 'proximas':
        return this.proximas();
      case 'historial':
        return this.historial();
      default:
        return this.filtradas();
    }
  });

  hayFiltros = computed(
    () =>
      !!(
        this.busqueda() ||
        this.empleadoId() ||
        this.rol() ||
        this.estado() ||
        this.desde() ||
        this.hasta()
      )
  );

  ngOnInit(): void {
    this.cargar();
    this.cargarCatalogos();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalAltaAbierto()) this.cerrarModalAlta();
    if (this.modalEdicionAbierto()) this.cerrarModalEdicion();
    if (this.modalBajaAbierto()) this.cancelarBaja();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.asignacionService.getTodas().subscribe({
      next: (lista) => {
        this.asignaciones.set(lista ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  cargarCatalogos(): void {
    this.vueloService.obtenerTodos().subscribe({
      next: (v) => this.vuelos.set(v ?? []),
      error: () => this.vuelos.set([]),
    });

    this.asignacionService.getEmpleadosDisponibles().subscribe({
      next: (e) => this.empleadosDisponibles.set(e ?? []),
      error: () => this.empleadosDisponibles.set([]),
    });
  }

  limpiarAlertas(): void {
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.empleadoId.set(null);
    this.rol.set('');
    this.estado.set('');
    this.desde.set('');
    this.hasta.set('');
  }

  // ---- Handlers de inputs ----
  valor(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  onEmpleado(event: Event): void {
    const v = this.valor(event);
    this.empleadoId.set(v ? Number(v) : null);
  }

  // ================= Alta de Asignación =================

  abrirModalAlta(): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.altaVueloId.set(null);
    this.altaEmpleadoId.set(null);
    this.altaRol.set('PILOTO');
    if (this.vuelos().length === 0 || this.empleadosDisponibles().length === 0) {
      this.cargarCatalogos();
    }
    this.modalAltaAbierto.set(true);
  }

  cerrarModalAlta(): void {
    this.modalAltaAbierto.set(false);
    this.formularioError.set(null);
  }

  guardarAlta(): void {
    const vueloId = this.altaVueloId();
    const empleadoId = this.altaEmpleadoId();
    const rolEmpleado = this.altaRol();

    if (!vueloId) {
      this.formularioError.set(this.i18n.t('adminAssignments.errFlightRequired'));
      return;
    }
    if (!empleadoId) {
      this.formularioError.set(this.i18n.t('adminAssignments.errEmployeeRequired'));
      return;
    }
    if (!rolEmpleado) {
      this.formularioError.set(this.i18n.t('adminAssignments.errRoleRequired'));
      return;
    }

    this.guardando.set(true);
    this.formularioError.set(null);

    this.asignacionService
      .crearAsignacion({
        vueloId: Number(vueloId),
        empleadoId: Number(empleadoId),
        rolEmpleado,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModalAlta();
          this.mensajeExito.set(this.i18n.t('adminAssignments.successCreated'));
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          const msg =
            err.error?.message ||
            (err.status === 409
              ? 'Ya existe una asignación o existe un conflicto horario para este empleado.'
              : this.i18n.t('common.error'));
          this.formularioError.set(msg);
        },
      });
  }

  // ================= Modificación de Asignación =================

  abrirModalEdicion(a: Asignacion): void {
    this.limpiarAlertas();
    this.formularioError.set(null);
    this.asignacionEnEdicion.set(a);
    this.edicionVueloId.set(a.vuelo.id);
    this.edicionEmpleadoId.set(a.empleado?.id ?? null);
    this.edicionRol.set(a.rolEmpleado);
    if (this.vuelos().length === 0 || this.empleadosDisponibles().length === 0) {
      this.cargarCatalogos();
    }
    this.modalEdicionAbierto.set(true);
  }

  cerrarModalEdicion(): void {
    this.modalEdicionAbierto.set(false);
    this.asignacionEnEdicion.set(null);
    this.formularioError.set(null);
  }

  guardarEdicion(): void {
    const a = this.asignacionEnEdicion();
    if (!a) return;

    const vueloId = this.edicionVueloId();
    const empleadoId = this.edicionEmpleadoId();
    const rolEmpleado = this.edicionRol();

    if (!vueloId) {
      this.formularioError.set(this.i18n.t('adminAssignments.errFlightRequired'));
      return;
    }
    if (!empleadoId) {
      this.formularioError.set(this.i18n.t('adminAssignments.errEmployeeRequired'));
      return;
    }
    if (!rolEmpleado) {
      this.formularioError.set(this.i18n.t('adminAssignments.errRoleRequired'));
      return;
    }

    this.guardando.set(true);
    this.formularioError.set(null);

    this.asignacionService
      .actualizarAsignacion(a.id, {
        vueloId: Number(vueloId),
        empleadoId: Number(empleadoId),
        rolEmpleado,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModalEdicion();
          this.mensajeExito.set(this.i18n.t('adminAssignments.successUpdated'));
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          const msg =
            err.error?.message ||
            (err.status === 409
              ? 'Ya existe una asignación o existe un conflicto horario para este empleado.'
              : this.i18n.t('common.error'));
          this.formularioError.set(msg);
        },
      });
  }

  // ================= Baja de Asignación =================

  abrirModalBaja(a: Asignacion): void {
    this.limpiarAlertas();
    this.cerrandoBaja.set(false);
    this.asignacionAEliminar.set(a);
    this.modalBajaAbierto.set(true);
  }

  /** El usuario eligió no dar de baja: se cierra el aviso y se informa con un toast. */
  cancelarBaja(): void {
    const a = this.asignacionAEliminar();
    if (!a || this.eliminando() || this.cerrandoBaja()) return;
    this.cerrarAlertaBaja();
    this.mostrarToast(this.i18n.t('adminAssignments.toastDeleteCancelled', { id: a.id }), 'info');
  }

  confirmarBaja(): void {
    const a = this.asignacionAEliminar();
    if (!a) return;

    this.eliminando.set(true);
    this.asignacionService.eliminarAsignacion(a.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.cerrarAlertaBaja();
        this.mostrarToast(this.i18n.t('adminAssignments.successDeleted'), 'exito');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        const msg = err.error?.message || this.i18n.t('common.error');
        this.cerrarAlertaBaja();
        this.mostrarToast(msg, 'error');
      },
    });
  }

  private cerrarAlertaBaja(): void {
    this.cerrarConAnimacion(this.cerrandoBaja, () => {
      this.modalBajaAbierto.set(false);
      this.asignacionAEliminar.set(null);
    });
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

  // ---- Toast ----
  private mostrarToast(texto: string, tipo: Toast['tipo']): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ texto, tipo });
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }

  cerrarToast(): void {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  // ---- Helpers ----
  salida(a: Asignacion): Date {
    return new Date(`${a.vuelo.fechaSalida}T${a.vuelo.horaSalida}`);
  }

  llegada(a: Asignacion): Date {
    return new Date(`${a.vuelo.fechaLlegada}T${a.vuelo.horaLlegada}`);
  }

  terminada(a: Asignacion): boolean {
    return a.vuelo.estado === 'CANCELADO' || this.llegada(a) < new Date();
  }

  hora(h: string): string {
    return h?.substring(0, 5) ?? '';
  }

  nombreEmpleado(a: Asignacion): string {
    return a.empleado ? `${a.empleado.apellido}, ${a.empleado.nombre}` : '—';
  }

  formatoVueloOpcion(v: Vuelo): string {
    const origen = v.aeropuertoOrigen?.codigoIata ?? '—';
    const destino = v.aeropuertoDestino?.codigoIata ?? '—';
    const salida = v.fechaSalida ? `${v.fechaSalida} ${this.hora(v.horaSalida ?? '')}` : '';
    const estado = v.estado ? `[${v.estado}]` : '';
    return `#${v.id} · ${origen} → ${destino} (${salida}) ${estado}`;
  }

  formatoEmpleadoOpcion(e: EmpleadoAsignacion): string {
    const doc = e.numeroIdentificador ? ` · DOC: ${e.numeroIdentificador}` : '';
    return `${e.apellido}, ${e.nombre}${doc} (#${e.id})`;
  }

  rolKey(rol: string): TranslationKey {
    return `myAssignments.role.${rol}` as TranslationKey;
  }

  estadoKey(estado: string): TranslationKey {
    return `myAssignments.status.${estado}` as TranslationKey;
  }

  private textoBuscable(a: Asignacion): string {
    const v = a.vuelo;
    return [
      a.empleado?.nombre,
      a.empleado?.apellido,
      a.empleado?.numeroIdentificador,
      v.id,
      v.aeropuertoOrigen?.codigoIata,
      v.aeropuertoOrigen?.ciudad,
      v.aeropuertoDestino?.codigoIata,
      v.aeropuertoDestino?.ciudad,
      v.avion?.identificador,
    ].join(' ');
  }

  private normalizar(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}
