import { Component, HostListener, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';
import { AvionService } from '../../../services/avion-service';
import { VueloService } from '../../../services/vuelo';
import { Avion, AvionRequest, EstadoAvion } from '../../../Models/Avion';
import { Vuelo } from '../../../Models/Vuelo';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { I18nService } from '../../../services/i18n';
import type { TranslationKey } from '../../../i18n/es';

type FiltroEstado = 'OPERATIVOS' | 'MANTENIMIENTO' | 'BAJA' | 'TODOS';
type ModoFormulario = 'ALTA' | 'EDICION';
type CampoAvion = 'identificador' | 'modelo' | 'pasajeros' | 'bodega' | 'estado';
type Toast = { texto: string; tipo: 'exito' | 'info' | 'error' };

// Mismas reglas que valida el backend (AvionService)
// Matrícula argentina (LV- + 3 letras, ej. LV-KFX) o formato interno (LV-A + números, ej. LV-A25)
const PATRON_IDENTIFICADOR = /^LV-(A\d+|[A-Z]{3})$/;
const MAX_CAPACIDAD_PASAJEROS = 900;
const MAX_LARGO_MODELO = 100;

// Vuelos que todavía ocupan al avión (si no finalizaron)
const ESTADOS_VUELO_PENDIENTES = ['PROGRAMADO', 'REPROGRAMADO', 'BOARDING', 'ACTIVO'];

// Debe coincidir con la duración de las animaciones overlay-out / modal-out del CSS
const DURACION_CIERRE_MS = 400;

@Component({
  selector: 'app-aviones-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './aviones-admin.html',
  styleUrl: './aviones-admin.css',
})
export class AvionesAdmin implements OnInit {
  private readonly avionService = inject(AvionService);
  private readonly vueloService = inject(VueloService);
  private readonly i18n = inject(I18nService);

  protected readonly estados: EstadoAvion[] = ['DISPONIBLE', 'ACTIVO', 'MANTENIMIENTO', 'BAJA'];
  protected readonly maxPasajeros = MAX_CAPACIDAD_PASAJEROS;
  protected readonly maxLargoModelo = MAX_LARGO_MODELO;

  protected readonly aviones = signal<Avion[]>([]);
  /** Vuelos pendientes (no finalizados) agrupados por id de avión. */
  private readonly vuelosPendientesPorAvion = signal<Map<number, Vuelo[]>>(new Map());
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  // ── Filtros (se aplican en el front) ──
  protected readonly filtroEstado = signal<FiltroEstado>('OPERATIVOS');
  protected readonly busqueda = signal('');

  private readonly avionesBuscados = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const lista = !texto
      ? this.aviones()
      : this.aviones().filter((a) => this.normalizar(`${a.identificador} ${a.modelo}`).includes(texto));
    return [...lista].sort((a, b) => a.identificador.localeCompare(b.identificador, undefined, { numeric: true }));
  });

  protected readonly avionesFiltrados = computed(() => {
    const filtro = this.filtroEstado();
    return this.avionesBuscados().filter((a) => this.coincideFiltro(a, filtro));
  });

  protected cantidad(filtro: FiltroEstado): number {
    return this.avionesBuscados().filter((a) => this.coincideFiltro(a, filtro)).length;
  }

  // ── Modales (con fade-in / fade-out) ──
  protected readonly modoFormulario = signal<ModoFormulario | null>(null);
  protected readonly avionEditado = signal<Avion | null>(null);
  protected readonly avionABajar = signal<Avion | null>(null);
  protected readonly cerrandoFormulario = signal(false);
  protected readonly cerrandoBaja = signal(false);
  protected readonly guardando = signal(false);
  protected readonly formularioError = signal<string | null>(null);
  /** Se activa al intentar guardar: recién ahí se marcan los campos obligatorios vacíos. */
  protected readonly intentoGuardar = signal(false);

  protected readonly toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Campos del formulario (compartido entre alta y edición)
  protected readonly fIdentificador = signal('');
  protected readonly fModelo = signal('');
  protected readonly fPasajeros = signal<number | null>(null);
  protected readonly fBodega = signal<number | null>(null);
  protected readonly fEstado = signal<EstadoAvion>('DISPONIBLE');

  /** Estados que se pueden elegir en el alta (no tiene sentido crear un avión dado de baja). */
  protected readonly estadosAlta: EstadoAvion[] = ['DISPONIBLE', 'ACTIVO', 'MANTENIMIENTO'];

  /** Errores por campo, calculados en vivo mientras se completa el formulario. */
  protected readonly errores = computed<Partial<Record<CampoAvion, TranslationKey>>>(() => {
    const e: Partial<Record<CampoAvion, TranslationKey>> = {};
    const editado = this.avionEditado();

    const identificador = this.fIdentificador().trim().toUpperCase();
    // "LV-" es el prefijo precargado del alta: se considera vacío hasta que se escriba el resto
    const identificadorCargado = !!identificador && identificador !== 'LV-';
    if (identificadorCargado) {
      if (!PATRON_IDENTIFICADOR.test(identificador)) {
        e.identificador = 'adminPlanes.errorIdFormat';
      } else if (
        this.aviones().some((a) => a.identificador.toUpperCase() === identificador && a.id !== editado?.id)
      ) {
        e.identificador = 'adminPlanes.errorIdDuplicated';
      }
    }

    if (this.fModelo().trim().length > MAX_LARGO_MODELO) e.modelo = 'adminPlanes.errorModelLength';

    const pasajeros = this.fPasajeros();
    if (this.tieneValor(pasajeros)) {
      if (!Number.isInteger(Number(pasajeros)) || Number(pasajeros) <= 0) e.pasajeros = 'adminPlanes.errorPassengers';
      else if (Number(pasajeros) > MAX_CAPACIDAD_PASAJEROS) e.pasajeros = 'adminPlanes.errorPassengersMax';
    }

    const bodega = this.fBodega();
    if (this.tieneValor(bodega) && Number(bodega) <= 0) e.bodega = 'adminPlanes.errorCargo';

    // Sacar de servicio un avión que todavía tiene vuelos asignados
    const estado = this.fEstado();
    if (
      editado &&
      estado !== editado.estado &&
      (estado === 'MANTENIMIENTO' || estado === 'BAJA') &&
      this.pendientes(editado).length > 0
    ) {
      e.estado = 'adminPlanes.errorStateWithFlights';
    }

    if (this.intentoGuardar()) {
      if (!identificadorCargado) e.identificador ??= 'adminPlanes.errorFieldRequired';
      if (!this.fModelo().trim()) e.modelo ??= 'adminPlanes.errorFieldRequired';
      if (!this.tieneValor(pasajeros)) e.pasajeros ??= 'adminPlanes.errorFieldRequired';
      if (!this.tieneValor(bodega)) e.bodega ??= 'adminPlanes.errorFieldRequired';
    }
    return e;
  });

  protected readonly hayErrores = computed(() => Object.keys(this.errores()).length > 0);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      aviones: this.avionService.obtenerTodos(),
      // Si los vuelos no cargan, el ABM sigue funcionando (el backend igual valida)
      vuelos: this.vueloService.obtenerTodos().pipe(catchError(() => of([] as Vuelo[]))),
    }).subscribe({
      next: ({ aviones, vuelos }) => {
        this.aviones.set(aviones ?? []);
        this.vuelosPendientesPorAvion.set(this.agruparPendientes(vuelos ?? []));
      },
      error: (err: HttpErrorResponse) => {
        this.aviones.set([]);
        this.error.set(err.error?.message ?? '');
      },
    }).add(() => this.cargando.set(false));
  }

  // ── Helpers de la lista ──
  protected pendientes(avion: Avion): Vuelo[] {
    return this.vuelosPendientesPorAvion().get(avion.id) ?? [];
  }

  protected estadoKey(estado: EstadoAvion): TranslationKey {
    return `adminPlanes.state.${estado}` as TranslationKey;
  }

  protected tabKey(filtro: FiltroEstado): TranslationKey {
    return `adminPlanes.tab.${filtro}` as TranslationKey;
  }

  protected readonly filtros: FiltroEstado[] = ['OPERATIVOS', 'MANTENIMIENTO', 'BAJA', 'TODOS'];

  private coincideFiltro(a: Avion, filtro: FiltroEstado): boolean {
    switch (filtro) {
      case 'OPERATIVOS': return a.estado === 'DISPONIBLE' || a.estado === 'ACTIVO';
      case 'MANTENIMIENTO': return a.estado === 'MANTENIMIENTO';
      case 'BAJA': return a.estado === 'BAJA';
      default: return true;
    }
  }

  private agruparPendientes(vuelos: Vuelo[]): Map<number, Vuelo[]> {
    const ahora = Date.now();
    const mapa = new Map<number, Vuelo[]>();
    for (const v of vuelos) {
      const avionId = v.avion?.id;
      if (avionId == null || !ESTADOS_VUELO_PENDIENTES.includes(String(v.estado))) continue;
      const llegada = new Date(`${v.fechaLlegada}T${v.horaLlegada}`).getTime();
      if (!isNaN(llegada) && llegada < ahora) continue; // ya finalizó
      mapa.set(avionId, [...(mapa.get(avionId) ?? []), v]);
    }
    return mapa;
  }

  // ── Alta / Edición ──
  protected abrirAlta(): void {
    this.prepararFormulario(null);
    this.modoFormulario.set('ALTA');
  }

  protected abrirEdicion(avion: Avion): void {
    this.prepararFormulario(avion);
    this.modoFormulario.set('EDICION');
  }

  private prepararFormulario(avion: Avion | null): void {
    this.formularioError.set(null);
    this.intentoGuardar.set(false);
    this.avionEditado.set(avion);
    this.fIdentificador.set(avion?.identificador ?? 'LV-');
    this.fModelo.set(avion?.modelo ?? '');
    this.fPasajeros.set(avion?.capacidadPasajeros ?? null);
    this.fBodega.set(avion?.capacidadBodega ?? null);
    this.fEstado.set(avion?.estado ?? 'DISPONIBLE');
  }

  protected cerrarFormulario(): void {
    if (this.guardando() || !this.modoFormulario()) return;
    this.cerrarConAnimacion(this.cerrandoFormulario, () => {
      this.modoFormulario.set(null);
      this.avionEditado.set(null);
      this.formularioError.set(null);
    });
  }

  protected guardar(): void {
    this.intentoGuardar.set(true);
    if (this.hayErrores()) return; // ya se muestran en vivo debajo de cada campo

    const editado = this.avionEditado();
    const esEdicion = this.modoFormulario() === 'EDICION' && !!editado;
    const payload: AvionRequest = {
      identificador: this.fIdentificador().trim().toUpperCase(),
      modelo: this.fModelo().trim().replace(/\s+/g, ' '),
      capacidadPasajeros: Number(this.fPasajeros()),
      capacidadBodega: Number(this.fBodega()),
      estado: this.fEstado(),
    };

    const peticion = esEdicion
      ? this.avionService.actualizar(editado!.id, payload)
      : this.avionService.crear(payload);

    this.guardando.set(true);
    this.formularioError.set(null);

    peticion.subscribe({
      next: (avion) => {
        this.guardando.set(false);
        this.cerrarFormulario();
        this.mostrarToast(
          this.i18n.t(esEdicion ? 'adminPlanes.toastUpdated' : 'adminPlanes.toastCreated', {
            id: avion?.identificador ?? payload.identificador,
          }),
          'exito'
        );
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.formularioError.set(err.error?.message || err.error?.error || 'adminPlanes.errorGeneric');
      },
    });
  }

  // ── Baja lógica ──
  protected abrirBaja(avion: Avion): void {
    this.formularioError.set(null);
    this.avionABajar.set(avion);
  }

  /** El usuario eligió no dar de baja: se cierra el aviso y se informa con un toast. */
  protected cancelarBaja(): void {
    const avion = this.avionABajar();
    if (!avion || this.guardando() || this.cerrandoBaja()) return;
    this.cerrarAlertaBaja();
    this.mostrarToast(this.i18n.t('adminPlanes.toastDeleteCancelled', { id: avion.identificador }), 'info');
  }

  protected confirmarBaja(): void {
    const avion = this.avionABajar();
    if (!avion) return;

    this.guardando.set(true);
    this.avionService.darDeBaja(avion.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarAlertaBaja();
        this.mostrarToast(this.i18n.t('adminPlanes.toastDeleted', { id: avion.identificador }), 'exito');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.cerrarAlertaBaja();
        this.mostrarToast(err.error?.message || this.i18n.t('adminPlanes.errorGeneric'), 'error');
      },
    });
  }

  private cerrarAlertaBaja(): void {
    this.cerrarConAnimacion(this.cerrandoBaja, () => {
      this.avionABajar.set(null);
      this.formularioError.set(null);
    });
  }

  /** Marca el modal como "cerrando" para que corra el fade-out y recién después lo saca del DOM. */
  private cerrarConAnimacion(cerrando: WritableSignal<boolean>, quitar: () => void): void {
    if (cerrando()) return;
    cerrando.set(true);
    setTimeout(() => {
      quitar();
      cerrando.set(false);
    }, DURACION_CIERRE_MS);
  }

  // ── Toast (se oculta solo a los 4 segundos) ──
  private mostrarToast(texto: string, tipo: Toast['tipo']): void {
    clearTimeout(this.toastTimer);
    this.toast.set({ texto, tipo });
    this.toastTimer = setTimeout(() => this.toast.set(null), 4000);
  }

  protected cerrarToast(): void {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  // ── Utilidades ──
  private tieneValor(valor: number | null | undefined): boolean {
    return valor !== null && valor !== undefined && String(valor) !== '';
  }

  private normalizar(valor: string): string {
    return (valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modoFormulario()) this.cerrarFormulario();
    else if (this.avionABajar()) this.cancelarBaja();
  }
}
