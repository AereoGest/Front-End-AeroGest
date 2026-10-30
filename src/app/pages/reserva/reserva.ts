import {
  Component,
  ElementRef,
  OnInit,
  computed,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { CarritoItem } from '../../Models/Carrito';
import { Vuelo } from '../../Models/Vuelo';
import { Equipaje, TipoEquipaje } from '../../Models/Equipaje';
import { Asistencia } from '../../Models/Asistencia';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../../Models/Perfil';
import { ReservaRequest } from '../../Models/Reserva';
import { PagoRequest, PagoResponse } from '../../Models/Pago';
import { CarritoService } from '../../services/carritoService';
import { VueloService } from '../../services/vuelo';
import { EquipajeService } from '../../services/equipajeService';
import { AsistenciaService } from '../../services/asistenciaService';
import { ConfigService, Tarifas } from '../../services/config';
import { MercadoPagoService } from '../../services/mercadoPagoService';
import { ReservaService } from '../../services/reservaService';
import { Pago } from '../pago/pago';

// Lo que guarda la página de asientos en sessionStorage.
interface AsientoSeleccionado {
  id: string;
  clase: string;
  precio: number;
}

// Datos de un pasajero mientras se completa el formulario.
interface PasajeroFormulario {
  asiento: string;
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  fechaNacimiento: string;
  email: string;
  equipajeIds: number[];
  asistenciaId: number | null;
}

interface LineaExtra {
  etiqueta: string;
  precio: number;
}

const CLAVE_ASIENTOS = 'asientos_seleccionados';

const ETIQUETAS_EQUIPAJE: Record<TipoEquipaje, string> = {
  CABINA: 'Cabina',
  BODEGA: 'Bodega',
  MANO: 'De mano',
};

// Orden en que se muestran los equipajes, del más chico al más grande.
const ORDEN_EQUIPAJE: TipoEquipaje[] = ['MANO', 'CABINA', 'BODEGA'];

const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [RouterLink, Pago],
  templateUrl: './reserva.html',
  styleUrl: './reserva.css',
})
export class Reserva implements OnInit {
  // Ventana de confirmación (<dialog #confirmacion> del html).
  private readonly confirmacion = viewChild.required<ElementRef<HTMLDialogElement>>('confirmacion');

  protected readonly tiposDocumento = TIPOS_DOCUMENTO;

  protected readonly item = signal<CarritoItem | null>(null);
  protected readonly vuelo = signal<Vuelo | null>(null);
  protected readonly equipajes = signal<Equipaje[]>([]);
  protected readonly asistencias = signal<Asistencia[]>([]);
  protected readonly tarifas = signal<Tarifas>({ tasaImpuesto: 0, tasaServicio: 0 });
  protected readonly pasajeros = signal<PasajeroFormulario[]>([]);
  protected readonly publicKey = signal('');

  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly procesando = signal(false);
  protected readonly errorPago = signal('');
  protected readonly codigoReserva = signal('');
  protected readonly mostrarPago = signal(false);
  protected readonly errorPasajeros = signal('');

protected continuarAlPago(): void {
  const mensaje = this.validarPasajeros();
  this.errorPasajeros.set(mensaje ?? '');

  if (!mensaje) {
    this.mostrarPago.set(true);
  }
}

  // Si la reserva se creó pero el pago falló, se reintenta el pago sobre la misma reserva.
  // Se descarta si cambian los datos de los pasajeros, para que se cree una nueva con los datos correctos.
  private reservaPendiente: number | null = null;

  protected readonly tarifaBase = computed(
    () => (this.vuelo()?.precioVuelo ?? 0) * this.pasajeros().length
  );

  protected readonly lineasExtras = computed(() => {
    const lineas: LineaExtra[] = [];

    this.pasajeros().forEach((pasajero, indice) => {
      this.equipajes()
        .filter((equipaje) => pasajero.equipajeIds.includes(equipaje.id))
        .forEach((equipaje) =>
          lineas.push({
            etiqueta: `Pasajero ${indice + 1} · ${this.etiquetaEquipaje(equipaje)}`,
            precio: equipaje.precio,
          })
        );

      const asistencia = this.asistencias().find((opcion) => opcion.id === pasajero.asistenciaId);
      if (asistencia) {
        lineas.push({
          etiqueta: `Pasajero ${indice + 1} · ${asistencia.nombrePlan}`,
          precio: asistencia.precio,
        });
      }
    });

    return lineas;
  });

  protected readonly totalExtras = computed(() =>
    this.lineasExtras().reduce((suma, linea) => suma + linea.precio, 0)
  );

  // Mismo cálculo que ReservaService.calcularTotal del backend, para mostrar lo mismo que se va a cobrar.
  protected readonly impuestos = computed(() =>
    Math.round(this.tarifaBase() * this.tarifas().tasaImpuesto)
  );

  protected readonly servicio = computed(() =>
    Math.round(
      (this.tarifaBase() + this.totalExtras() + this.impuestos()) * this.tarifas().tasaServicio
    )
  );

  protected readonly total = computed(
    () => this.tarifaBase() + this.totalExtras() + this.impuestos() + this.servicio()
  );

  protected readonly asientosTexto = computed(() => {
    const asientos = this.pasajeros()
      .map((pasajero) => pasajero.asiento)
      .filter((asiento) => asiento);
    return asientos.length ? asientos.join(', ') : '—';
  });

  constructor(
    private carritoService: CarritoService,
    private vueloService: VueloService,
    private equipajeService: EquipajeService,
    private asistenciaService: AsistenciaService,
    private configService: ConfigService,
    private mercadoPagoService: MercadoPagoService,
    private reservaService: ReservaService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  protected cargarDatos(): void {
    this.cargando.set(true);
    this.error.set('');

    forkJoin({
      carrito: this.carritoService.obtenerMiCarrito(),
      equipajes: this.equipajeService.obtenerTodos(),
      asistencias: this.asistenciaService.obtenerTodas(),
      tarifas: this.configService.obtenerTarifas(),
      publicKey: this.mercadoPagoService.obtenerPublicKey(),
    }).pipe(
      switchMap((datos) => {
        this.equipajes.set(
          (datos.equipajes ?? []).sort(
            (a, b) => ORDEN_EQUIPAJE.indexOf(a.tipo) - ORDEN_EQUIPAJE.indexOf(b.tipo)
          )
        );
        this.asistencias.set(datos.asistencias ?? []);
        this.tarifas.set(datos.tarifas);
        this.publicKey.set(datos.publicKey);
        return this.cargarVuelo(datos.carrito.items ?? []);
      })
    ).subscribe({
      next: (vuelo) => this.vuelo.set(vuelo),
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'No se pudo cargar tu reserva. Intentá nuevamente.');
      }
    }).add(() => this.cargando.set(false));
  }

  protected actualizarPasajero<K extends keyof PasajeroFormulario>(
    indice: number,
    campo: K,
    valor: PasajeroFormulario[K]
  ): void {
    this.pasajeros.update((pasajeros) =>
      pasajeros.map((pasajero, i) => (i === indice ? { ...pasajero, [campo]: valor } : pasajero))
    );
    this.reservaPendiente = null;
  }

  protected alternarEquipaje(indice: number, equipajeId: number, marcado: boolean): void {
    const equipajeIds = this.pasajeros()[indice].equipajeIds.filter((id) => id !== equipajeId);
    this.actualizarPasajero(indice, 'equipajeIds', marcado ? [...equipajeIds, equipajeId] : equipajeIds);
  }

  // "Sin equipaje" no se desmarca a mano: se desmarca solo cuando se elige algún equipaje.
  protected elegirSinEquipaje(indice: number, casilla: HTMLInputElement): void {
    casilla.checked = true;
    this.actualizarPasajero(indice, 'equipajeIds', []);
  }

  protected etiquetaEquipaje(equipaje: Equipaje): string {
    return `${ETIQUETAS_EQUIPAJE[equipaje.tipo] ?? equipaje.tipo} (${equipaje.peso} kg)`;
  }

  protected formatearPrecio(valor: number): string {
    return `$${valor.toLocaleString('es-AR')}`;
  }

  protected formatearPorcentaje(tasa: number): string {
    return `${(tasa * 100).toLocaleString('es-AR')}%`;
  }

  protected formatearFecha(fecha: string): string {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // Lo emite <app-pago> cuando el token de la tarjeta ya está generado.
  protected pagar(pago: PagoRequest): void {
    this.errorPago.set('');
    this.procesando.set(true);

    this.obtenerReservaPendiente().pipe(
      switchMap((reservaId) => this.reservaService.pagarMiReserva(reservaId, pago))
    ).subscribe({
      next: (respuesta) => this.procesarRespuesta(respuesta),
      error: (error: unknown) => {
        this.errorPago.set(
          (error instanceof HttpErrorResponse && error.error?.message) ||
            'No se pudo procesar el pago. Revisá los datos de la tarjeta e intentá nuevamente.'
        );
      }
    }).add(() => this.procesando.set(false));
  }

  // <app-pago> la llama antes de generar el token, así no se cobra si los pasajeros están mal.
  // Es arrow function para que mantenga el `this` al llamarla desde el otro componente.
  protected readonly validarPasajeros = (): string | null => {
    const hoy = new Date().toISOString().slice(0, 10);

    for (const [indice, pasajero] of this.pasajeros().entries()) {
      const numero = indice + 1;
      const documento = pasajero.documento.replace(/[\s.\-]/g, '').toUpperCase();

      if (!SOLO_LETRAS.test(pasajero.nombre.trim())) {
        return `Pasajero ${numero}: el nombre solo puede contener letras.`;
      }
      if (!SOLO_LETRAS.test(pasajero.apellido.trim())) {
        return `Pasajero ${numero}: el apellido solo puede contener letras.`;
      }
      if (pasajero.tipoDocumento === 'DNI' && !/^\d{7,8}$/.test(documento)) {
        return `Pasajero ${numero}: el DNI debe tener entre 7 y 8 dígitos.`;
      }
      if (pasajero.tipoDocumento === 'PASAPORTE' && !/^[A-Z0-9]{6,20}$/.test(documento)) {
        return `Pasajero ${numero}: el pasaporte debe tener entre 6 y 20 letras o números.`;
      }
      if (!pasajero.fechaNacimiento || pasajero.fechaNacimiento >= hoy) {
        return `Pasajero ${numero}: ingresá una fecha de nacimiento válida.`;
      }
      if (pasajero.email.trim() && !EMAIL_REGEX.test(pasajero.email.trim())) {
        return `Pasajero ${numero}: el email no es válido.`;
      }
    }

    return null;
  };

  private procesarRespuesta(respuesta: PagoResponse): void {
    if (respuesta.status === 'approved') {
      sessionStorage.removeItem(CLAVE_ASIENTOS);
      this.reservaPendiente = null;
      this.codigoReserva.set(respuesta.codigoReserva);
      this.confirmacion().nativeElement.showModal();
      return;
    }

    if (respuesta.status === 'rejected') {
      // El backend cancela la reserva rechazada: el próximo intento crea una nueva.
      this.reservaPendiente = null;
      this.errorPago.set('El pago fue rechazado. Revisá los datos de la tarjeta o probá con otra.');
      return;
    }

    // in_process / pending: la reserva queda PROCESANDO hasta que Mercado Pago confirme el pago.
    this.errorPago.set(
      `Tu pago está en proceso. Podés ver el estado de la reserva ${respuesta.codigoReserva} en Mis reservas.`
    );
  }

  private obtenerReservaPendiente(): Observable<number> {
    if (this.reservaPendiente !== null) {
      return of(this.reservaPendiente);
    }

    return this.reservaService.crearMiReserva(this.armarReserva()).pipe(
      map((reserva) => {
        this.reservaPendiente = reserva.id;
        return reserva.id;
      })
    );
  }

  // El backend arma una reserva por vuelo y, al aprobarse el pago, vacía todo el carrito.
  // Por eso solo se permite pagar cuando el carrito tiene un único vuelo.
  private cargarVuelo(items: CarritoItem[]): Observable<Vuelo | null> {
    if (items.length === 0) {
      this.error.set('Tu carrito está vacío. Elegí un vuelo para continuar.');
      return of(null);
    }

    if (items.length > 1) {
      this.error.set('Por ahora solo podés reservar un vuelo a la vez. Dejá un único vuelo en el carrito para continuar.');
      return of(null);
    }

    const item = items[0];
    this.item.set(item);
    this.pasajeros.set(this.crearPasajeros(item.cantidad));
    return this.vueloService.obtenerPorId(item.vueloId);
  }

  private crearPasajeros(cantidad: number): PasajeroFormulario[] {
    const asientos = this.leerAsientosSeleccionados();

    return Array.from({ length: cantidad }, (_, indice) => ({
      asiento: asientos[indice]?.id ?? '',
      nombre: '',
      apellido: '',
      tipoDocumento: 'DNI',
      documento: '',
      fechaNacimiento: '',
      email: '',
      equipajeIds: [],
      asistenciaId: null,
    }));
  }

  private leerAsientosSeleccionados(): AsientoSeleccionado[] {
    try {
      return JSON.parse(sessionStorage.getItem(CLAVE_ASIENTOS) ?? '[]');
    } catch {
      return [];
    }
  }
  
  

  // Los asientos de la página de asientos todavía no tienen el id del backend, así que no se envía asientoId:
  // el backend lo permite y el asiento se puede asignar en el check-in.
  private armarReserva(): ReservaRequest {
    const item = this.item()!;

    return {
      vueloId: item.vueloId,
      cantidadPasajes: this.pasajeros().length,
      pasajes: this.pasajeros().map((pasajero) => ({
        clasesVuelo: item.claseVuelo,
        equipajeIds: pasajero.equipajeIds,
        asistenciaId: pasajero.asistenciaId,
        nombre: pasajero.nombre.trim(),
        apellido: pasajero.apellido.trim(),
        tipoDocumento: pasajero.tipoDocumento,
        documento: pasajero.documento,
        fechaNacimiento: pasajero.fechaNacimiento,
        email: pasajero.email.trim(),
      })),
    };
  }
}