import { Component, DestroyRef, HostListener, OnInit, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, forkJoin, of, switchMap, tap } from 'rxjs';
import { VueloService } from '../../../services/vuelo';
import { EstadoVuelo, ValidacionVuelo, Vuelo, VueloRequest } from '../../../Models/Vuelo';
import { Aeropuerto } from '../../../Models/Aeropuerto';
import { Avion } from '../../../Models/Avion';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { I18nService } from '../../../services/i18n';
import type { TranslationKey } from '../../../i18n/es';

type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';
type ModoFormulario = 'ALTA' | 'EDICION';
type CampoVuelo = 'origen' | 'destino' | 'avion' | 'salida' | 'llegada' | 'precio';
type Toast = { texto: string; tipo: 'exito' | 'info' | 'error' };

// Mismas reglas que valida el backend (VueloService)
const MAX_HORAS_DIRECTO = 18;
const MAX_HORAS_ESCALA = 36;

// Estados que el panel considera "inactivos" además de los vuelos que ya finalizaron.
const ESTADOS_INACTIVOS = ['INACTIVO', 'CANCELADO', 'FINALIZADO'];

// Debe coincidir con la duración de las animaciones overlay-out / modal-out del CSS
const DURACION_CIERRE_MS = 400;

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

@Component({
  selector: 'app-vuelos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './vuelos-admin.html',
  styleUrl: './vuelos-admin.css',
})
export class VuelosAdmin implements OnInit {
  private readonly vueloService = inject(VueloService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly vuelos = signal<Vuelo[]>([]);
  protected readonly vueloDetalle = signal<Vuelo | null>(null);
  protected readonly cargando = signal(false);
  // null = sin error · '' = error sin mensaje del backend (se muestra el texto traducido por defecto)
  protected readonly error = signal<string | null>(null);
  // Banderas de "cerrando": activan la animación de salida (fade-out) de cada modal
  protected readonly cerrando = signal(false);
  protected readonly cerrandoFormulario = signal(false);
  protected readonly cerrandoBaja = signal(false);

  // ── ABM ──
  protected readonly estados: EstadoVuelo[] = ['PROGRAMADO', 'BOARDING', 'ACTIVO', 'REPROGRAMADO', 'CANCELADO'];
  protected readonly horas = HORAS;
  protected readonly aeropuertos = signal<Aeropuerto[]>([]);
  protected readonly aviones = signal<Avion[]>([]);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly modoFormulario = signal<ModoFormulario | null>(null);
  protected readonly vueloEditado = signal<Vuelo | null>(null);
  protected readonly vueloABajar = signal<Vuelo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly formularioError = signal<string | null>(null);
  /** Se activa al intentar guardar: recién ahí se marcan los campos obligatorios vacíos. */
  protected readonly intentoGuardar = signal(false);

  // Campos del formulario (compartido entre alta y edición)
  protected readonly fOrigenId = signal<number | null>(null);
  protected readonly fDestinoId = signal<number | null>(null);
  protected readonly fAvionId = signal<number | null>(null);
  protected readonly fFechaSalida = signal('');
  protected readonly fSalidaHora = signal('');
  protected readonly fSalidaMin = signal('');
  protected readonly fFechaLlegada = signal('');
  protected readonly fLlegadaHora = signal('');
  protected readonly fLlegadaMin = signal('');
  protected readonly fPrecio = signal<number | null>(null);
  protected readonly fEscala = signal(false);
  protected readonly fEstado = signal<EstadoVuelo>('PROGRAMADO');

  // Validación contra el backend (ej. avión ocupado en ese horario)
  protected readonly validandoServidor = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  private readonly validacion$ = new Subject<{ payload: VueloRequest; vueloId?: number } | null>();

  // Filtros (se aplican en el front, sin volver a pedir al backend)
  protected readonly filtroEstado = signal<FiltroEstado>('ACTIVOS');
  protected readonly origen = signal('');
  protected readonly destino = signal('');
  protected readonly fechaIda = signal('');

  // Vuelos que cumplen origen/destino/fecha (sin mirar el estado)
  private readonly vuelosBuscados = computed(() => {
    const origen = this.normalizar(this.origen());
    const destino = this.normalizar(this.destino());
    const fecha = this.fechaIda();

    return this.vuelos().filter((v) => {
      const coincideOrigen =
        !origen ||
        this.normalizar(v.aeropuertoOrigen?.ciudad ?? '').includes(origen) ||
        this.normalizar(v.aeropuertoOrigen?.codigoIata ?? '').includes(origen);
      const coincideDestino =
        !destino ||
        this.normalizar(v.aeropuertoDestino?.ciudad ?? '').includes(destino) ||
        this.normalizar(v.aeropuertoDestino?.codigoIata ?? '').includes(destino);
      const coincideFecha = !fecha || v.fechaSalida === fecha;
      return coincideOrigen && coincideDestino && coincideFecha;
    });
  });

  protected readonly cantidadActivos = computed(
    () => this.vuelosBuscados().filter((v) => this.esActivo(v)).length
  );
  protected readonly cantidadInactivos = computed(
    () => this.vuelosBuscados().length - this.cantidadActivos()
  );

  protected readonly vuelosFiltrados = computed(() => {
    const filtro = this.filtroEstado();
    if (filtro === 'TODOS') return this.vuelosBuscados();
    const queremosActivos = filtro === 'ACTIVOS';
    return this.vuelosBuscados().filter((v) => this.esActivo(v) === queremosActivos);
  });

  /** En el alta solo se ofrecen aviones operativos; en la edición se mantiene además el avión actual. */
  protected readonly avionesSeleccionables = computed(() => {
    const actualId = this.vueloEditado()?.avion?.id;
    return this.aviones().filter(
      (a) => a.estado === 'DISPONIBLE' || a.estado === 'ACTIVO' || a.id === actualId
    );
  });

  private readonly horaSalida = computed(() =>
    this.fSalidaHora() && this.fSalidaMin() ? `${this.fSalidaHora()}:${this.fSalidaMin()}` : ''
  );
  private readonly horaLlegada = computed(() =>
    this.fLlegadaHora() && this.fLlegadaMin() ? `${this.fLlegadaHora()}:${this.fLlegadaMin()}` : ''
  );

  /**
   * Errores por campo, calculados en vivo mientras se completa el formulario.
   * Las reglas de negocio se avisan apenas se pueden evaluar; los obligatorios vacíos,
   * recién cuando se intenta guardar.
   */
  protected readonly errores = computed<Partial<Record<CampoVuelo, TranslationKey>>>(() => {
    const e: Partial<Record<CampoVuelo, TranslationKey>> = {};
    const origen = this.aeropuertoPorId(this.fOrigenId());
    const destino = this.aeropuertoPorId(this.fDestinoId());

    if (origen && destino) {
      if (origen.id === destino.id) e.destino = 'adminFlights.errorSameAirport';
      else if (this.mismaCiudad(origen, destino)) e.destino = 'adminFlights.errorSameCity';
    }

    const precio = this.fPrecio();
    if (precio !== null && precio !== undefined && String(precio) !== '' && Number(precio) <= 0) {
      e.precio = 'adminFlights.errorPrice';
    }

    // Con solo las fechas ya se pueden detectar algunos errores, sin esperar a la hora
    const fechaSalida = this.fFechaSalida();
    const fechaLlegada = this.fFechaLlegada();
    if (fechaSalida && this.modoFormulario() === 'ALTA' && fechaSalida < this.hoy()) {
      e.salida = 'adminFlights.errorPastDeparture';
    }
    if (fechaSalida && fechaLlegada && fechaLlegada < fechaSalida) {
      e.llegada = 'adminFlights.errorArrivalBeforeDeparture';
    }

    const salida = this.fechaHora(fechaSalida, this.horaSalida());
    const llegada = this.fechaHora(fechaLlegada, this.horaLlegada());
    if (!e.salida && salida && this.modoFormulario() === 'ALTA' && salida.getTime() <= Date.now()) {
      e.salida = 'adminFlights.errorPastDeparture';
    }
    if (!e.llegada && salida && llegada) {
      if (llegada.getTime() <= salida.getTime()) {
        e.llegada = 'adminFlights.errorArrivalBeforeDeparture';
      } else {
        const horas = (llegada.getTime() - salida.getTime()) / 3600000;
        const maximo = this.fEscala() ? MAX_HORAS_ESCALA : MAX_HORAS_DIRECTO;
        if (horas > maximo) {
          e.llegada = this.fEscala() ? 'adminFlights.errorDurationLayover' : 'adminFlights.errorDurationDirect';
        }
      }
    }

    if (this.intentoGuardar()) {
      if (!this.fOrigenId()) e.origen ??= 'adminFlights.errorFieldRequired';
      if (!this.fDestinoId()) e.destino ??= 'adminFlights.errorFieldRequired';
      if (!this.fAvionId()) e.avion ??= 'adminFlights.errorFieldRequired';
      if (!this.fFechaSalida() || !this.horaSalida()) e.salida ??= 'adminFlights.errorFieldRequired';
      if (!this.fFechaLlegada() || !this.horaLlegada()) e.llegada ??= 'adminFlights.errorFieldRequired';
      if (precio === null || precio === undefined || String(precio) === '') e.precio ??= 'adminFlights.errorFieldRequired';
    }
    return e;
  });

  protected readonly hayErroresLocales = computed(() => Object.keys(this.errores()).length > 0);

  /** Payload completo, o null mientras falte algún dato. */
  private readonly payloadCompleto = computed<VueloRequest | null>(() => {
    const precio = this.fPrecio();
    if (
      !this.fOrigenId() || !this.fDestinoId() || !this.fAvionId() ||
      !this.fFechaSalida() || !this.horaSalida() ||
      !this.fFechaLlegada() || !this.horaLlegada() ||
      precio === null || precio === undefined || String(precio) === ''
    ) {
      return null;
    }
    const payload: VueloRequest = {
      aeropuertoOrigenId: Number(this.fOrigenId()),
      aeropuertoDestinoId: Number(this.fDestinoId()),
      avionId: Number(this.fAvionId()),
      fechaSalida: this.fFechaSalida(),
      horaSalida: this.horaSalida(),
      fechaLlegada: this.fFechaLlegada(),
      horaLlegada: this.horaLlegada(),
      precioVuelo: Number(precio),
      escala: this.fEscala(),
    };
    if (this.modoFormulario() === 'EDICION') payload.estado = this.fEstado();
    return payload;
  });

  protected readonly puedeGuardar = computed(
    () =>
      !this.guardando() &&
      !this.validandoServidor() &&
      !this.hayErroresLocales() &&
      !this.errorServidor()
  );

  constructor() {
    // Cuando el formulario está completo y sin errores locales, se le pregunta al backend
    // (con una pequeña espera para no disparar una petición por cada tecla).
    this.validacion$
      .pipe(
        tap((req) => {
          this.errorServidor.set(null);
          this.validandoServidor.set(!!req);
        }),
        debounceTime(400),
        switchMap((req) => {
          if (!req) return of<ValidacionVuelo | null>(null);
          return this.vueloService.validar(req.payload, req.vueloId).pipe(
            catchError(() => of<ValidacionVuelo | null>(null))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((resultado) => {
        this.validandoServidor.set(false);
        this.errorServidor.set(resultado && !resultado.valido ? resultado.mensaje : null);
      });

    effect(() => {
      const modo = this.modoFormulario();
      const payload = this.payloadCompleto();
      const conErrores = this.hayErroresLocales();
      const editado = this.vueloEditado();
      if (!modo || !payload || conErrores) {
        this.validacion$.next(null);
        return;
      }
      this.validacion$.next({
        payload,
        vueloId: modo === 'EDICION' && editado ? Number(editado.id) : undefined,
      });
    });
  }

  ngOnInit(): void {
    this.cargar();
    this.cargarCatalogos();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.vueloService.obtenerTodos().subscribe({
      next: (vuelos) => this.vuelos.set(vuelos ?? []),
      error: (error: HttpErrorResponse) => {
        this.vuelos.set([]);
        this.error.set(error.error?.message ?? '');
      },
    }).add(() => this.cargando.set(false));
  }

  /** Aeropuertos y aviones para los selects del formulario. */
  private cargarCatalogos(): void {
    forkJoin({
      aeropuertos: this.vueloService.obtenerAeropuertos(),
      aviones: this.vueloService.obtenerAviones(),
    }).subscribe({
      next: ({ aeropuertos, aviones }) => {
        this.aeropuertos.set(
          [...(aeropuertos ?? [])].sort((a, b) => a.ciudad.localeCompare(b.ciudad))
        );
        this.aviones.set(aviones ?? []);
      },
      error: () => {
        // El listado sigue funcionando; el formulario queda con los selects vacíos
        this.aeropuertos.set([]);
        this.aviones.set([]);
      },
    });
  }

  protected onBuscar(event: Event): void {
    event.preventDefault(); // el filtrado ya es en vivo; solo evitamos el submit
  }

  protected limpiarFiltros(): void {
    this.origen.set('');
    this.destino.set('');
    this.fechaIda.set('');
  }

  /** Un vuelo está activo si su estado no es inactivo y todavía no aterrizó. */
  protected esActivo(vuelo: Vuelo): boolean {
    return (
      !ESTADOS_INACTIVOS.includes(String(vuelo.estado ?? '').toUpperCase()) &&
      !this.estaFinalizado(vuelo)
    );
  }

  /** El vuelo ya se hizo: su fecha y hora de llegada quedaron en el pasado. */
  protected estaFinalizado(vuelo: Vuelo): boolean {
    const llegada = this.fechaHora(vuelo.fechaLlegada, this.formatearHora(vuelo.horaLlegada));
    return !!llegada && llegada.getTime() < Date.now();
  }

  protected estaCancelado(vuelo: Vuelo): boolean {
    return String(vuelo.estado ?? '').toUpperCase() === 'CANCELADO';
  }

  /** Solo se pueden modificar o dar de baja los vuelos que todavía no finalizaron. */
  protected esGestionable(vuelo: Vuelo): boolean {
    return !this.estaFinalizado(vuelo);
  }

  protected etiquetaEstado(vuelo: Vuelo): TranslationKey {
    if (this.estaFinalizado(vuelo) && !this.estaCancelado(vuelo)) return 'adminFlights.finished';
    return this.esActivo(vuelo) ? 'adminFlights.active' : 'adminFlights.inactive';
  }

  protected formatearHora(hora: string): string {
    return hora ? hora.substring(0, 5) : '';
  }

  protected duracion(vuelo: Vuelo): string {
    const salida = new Date(`${vuelo.fechaSalida}T${vuelo.horaSalida}`);
    const llegada = new Date(`${vuelo.fechaLlegada}T${vuelo.horaLlegada}`);
    const minutos = Math.max(0, Math.round((llegada.getTime() - salida.getTime()) / 60000));
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return `${horas}h ${resto.toString().padStart(2, '0')}m`;
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)/g, '')
      .toLowerCase()
      .trim();
  }

  protected abrirDetalle(vuelo: Vuelo) {
    this.cerrando.set(false);
    this.vueloDetalle.set(vuelo);
  }

  protected cerrarDetalle() {
    if (!this.vueloDetalle()) return;
    this.cerrarConAnimacion(this.cerrando, () => this.vueloDetalle.set(null));
  }

  /**
   * Marca el modal como "cerrando" para que corra el fade-out (clase .cerrando)
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

  // ── Alta / Edición ──
  protected abrirAlta(): void {
    this.prepararFormulario(null);
    this.modoFormulario.set('ALTA');
  }

  protected abrirEdicion(vuelo: Vuelo, event?: Event): void {
    event?.stopPropagation();
    this.vueloDetalle.set(null);
    this.prepararFormulario(vuelo);
    this.modoFormulario.set('EDICION');
  }

  private prepararFormulario(vuelo: Vuelo | null): void {
    this.formularioError.set(null);
    this.errorServidor.set(null);
    this.intentoGuardar.set(false);
    this.vueloEditado.set(vuelo);

    const [sh, sm] = this.partesHora(vuelo?.horaSalida);
    const [lh, lm] = this.partesHora(vuelo?.horaLlegada);
    this.fOrigenId.set(vuelo?.aeropuertoOrigen?.id ?? null);
    this.fDestinoId.set(vuelo?.aeropuertoDestino?.id ?? null);
    this.fAvionId.set(vuelo?.avion?.id ?? null);
    this.fFechaSalida.set(vuelo?.fechaSalida ?? '');
    this.fSalidaHora.set(sh);
    this.fSalidaMin.set(sm);
    this.fFechaLlegada.set(vuelo?.fechaLlegada ?? '');
    this.fLlegadaHora.set(lh);
    this.fLlegadaMin.set(lm);
    this.fPrecio.set(vuelo?.precioVuelo ?? null);
    this.fEscala.set(!!vuelo?.escala);
    this.fEstado.set(vuelo?.estado ?? 'PROGRAMADO');
  }

  protected cerrarFormulario(): void {
    if (this.guardando() || !this.modoFormulario()) return;
    this.cerrarConAnimacion(this.cerrandoFormulario, () => {
      this.modoFormulario.set(null);
      this.vueloEditado.set(null);
      this.formularioError.set(null);
      this.errorServidor.set(null);
    });
  }

  /** Al elegir la hora sin minutos, se completa con :00 para no obligar a dos clics. */
  protected elegirHora(campo: 'salida' | 'llegada', hora: string): void {
    const [h, m] = campo === 'salida' ? [this.fSalidaHora, this.fSalidaMin] : [this.fLlegadaHora, this.fLlegadaMin];
    h.set(hora);
    if (hora && !m()) m.set('00');
  }

  /** Minutos cada 5; si el vuelo editado tiene otro minuto, se agrega para no perderlo. */
  protected minutosPara(actual: string): string[] {
    return actual && !MINUTOS.includes(actual) ? [...MINUTOS, actual].sort() : MINUTOS;
  }

  protected guardar(): void {
    this.intentoGuardar.set(true);
    const payload = this.payloadCompleto();
    // Los errores locales y los del backend ya se muestran en vivo en el formulario
    if (!payload || this.hayErroresLocales() || this.errorServidor()) return;

    const editado = this.vueloEditado();
    const esEdicion = this.modoFormulario() === 'EDICION' && !!editado;
    const peticion = esEdicion
      ? this.vueloService.actualizar(Number(editado!.id), payload)
      : this.vueloService.crear(payload);

    this.guardando.set(true);
    this.formularioError.set(null);

    peticion.subscribe({
      next: (vuelo) => {
        this.guardando.set(false);
        this.cerrarFormulario();
        this.mostrarToast(
          this.i18n.t(esEdicion ? 'adminFlights.toastUpdated' : 'adminFlights.toastCreated', { id: vuelo?.id ?? editado?.id }),
          'exito'
        );
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.formularioError.set(err.error?.message || err.error?.error || 'adminFlights.errorGeneric');
      },
    });
  }

  // ── Baja lógica ──
  protected abrirBaja(vuelo: Vuelo, event?: Event): void {
    event?.stopPropagation();
    this.vueloDetalle.set(null);
    this.formularioError.set(null);
    this.vueloABajar.set(vuelo);
  }

  /** El usuario eligió no dar de baja: se cierra el aviso y se informa con un toast. */
  protected cancelarBaja(): void {
    const vuelo = this.vueloABajar();
    if (!vuelo || this.guardando() || this.cerrandoBaja()) return;
    this.cerrarAlertaBaja();
    this.mostrarToast(this.i18n.t('adminFlights.toastDeleteCancelled', { id: vuelo.id }), 'info');
  }

  protected confirmarBaja(): void {
    const vuelo = this.vueloABajar();
    if (!vuelo) return;

    this.guardando.set(true);
    this.formularioError.set(null);

    this.vueloService.darDeBaja(Number(vuelo.id)).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarAlertaBaja();
        this.mostrarToast(this.i18n.t('adminFlights.toastDeleted', { id: vuelo.id }), 'exito');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.cerrarAlertaBaja();
        this.mostrarToast(err.error?.message || this.i18n.t('adminFlights.errorGeneric'), 'error');
      },
    });
  }

  private cerrarAlertaBaja(): void {
    this.cerrarConAnimacion(this.cerrandoBaja, () => {
      this.vueloABajar.set(null);
      this.formularioError.set(null);
    });
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

  // ── Helpers del formulario ──
  /** Deshabilita aeropuertos de la misma ciudad que el elegido en el otro select (ej. EZE / AEP). */
  protected aeropuertoBloqueado(a: Aeropuerto, otroId: number | null): boolean {
    const otro = this.aeropuertoPorId(otroId);
    return !!otro && (otro.id === a.id || this.mismaCiudad(a, otro));
  }

  private aeropuertoPorId(id: number | null): Aeropuerto | undefined {
    if (id === null || id === undefined) return undefined;
    return this.aeropuertos().find((a) => a.id === Number(id));
  }

  private mismaCiudad(a: Aeropuerto, b: Aeropuerto): boolean {
    const ciudad = (c: string) => this.normalizar(c ?? '').replace(/\s+/g, ' ');
    return !!ciudad(a.ciudad) && ciudad(a.ciudad) === ciudad(b.ciudad);
  }

  /** Fecha de hoy en formato yyyy-MM-dd (hora local), comparable con el valor de los input date. */
  protected hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private fechaHora(fecha: string, hora: string): Date | null {
    if (!fecha || !hora) return null;
    const d = new Date(`${fecha}T${hora}`);
    return isNaN(d.getTime()) ? null : d;
  }

  private partesHora(hora?: string): [string, string] {
    if (!hora) return ['', ''];
    const [h, m] = hora.split(':');
    return [h ?? '', m ?? ''];
  }

  protected etiquetaAeropuerto(a: Aeropuerto): string {
    return `${a.ciudad} (${a.codigoIata}) · ${a.nombre}`;
  }

  protected etiquetaAvion(a: Avion): string {
    return `${a.identificador} · ${a.modelo} · ${a.capacidadPasajeros} pax`;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.modoFormulario()) this.cerrarFormulario();
    else if (this.vueloABajar()) this.cancelarBaja();
    else this.cerrarDetalle();
  }
}
