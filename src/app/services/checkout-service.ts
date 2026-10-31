import { Injectable, computed, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { CarritoItem } from '../Models/Carrito';
import { Vuelo } from '../Models/Vuelo';
import { Equipaje, TipoEquipaje } from '../Models/Equipaje';
import { Asistencia } from '../Models/Asistencia';
import { TipoDocumento } from '../Models/Perfil';
import { ReservaRequest } from '../Models/Reserva';
import { PagoRequest, PagoResponse } from '../Models/Pago';
import { CarritoService } from './carritoService';
import { VueloService } from './vuelo';
import { EquipajeService } from './equipajeService';
import { AsistenciaService } from './asistenciaService';
import { ConfigService, Tarifas } from './config';
import { MercadoPagoService } from './mercadoPagoService';
import { ReservaService } from './reservaService';

// Lo que guarda la página de asientos en sessionStorage.
interface AsientoSeleccionado {
  id: string;
  clase: string;
  precio: number;
}

// Modelo del formulario de un pasajero.
// Signal Forms no admite null en los campos, por eso asistenciaId es string ('' = sin asistencia).
export interface PasajeroFormulario {
  asiento: string;
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  fechaNacimiento: string;
  email: string;
  equipajeIds: number[];
  asistenciaId: string;
}

export interface LineaExtra {
  etiqueta: string;
  precio: number;
}

// Problemas del carrito al cargar. El texto de cada caso está en reserva.html.
export type ErrorCarrito = 'carritoVacio' | 'variosVuelos';

const CLAVE_ASIENTOS = 'asientos_seleccionados';

const ETIQUETAS_EQUIPAJE: Record<TipoEquipaje, string> = {
  CABINA: 'Cabina',
  BODEGA: 'Bodega',
  MANO: 'De mano',
};

// Orden en que se muestran los equipajes, del más chico al más grande.
const ORDEN_EQUIPAJE: TipoEquipaje[] = ['MANO', 'CABINA', 'BODEGA'];

export function etiquetaEquipaje(equipaje: Equipaje): string {
  return `${ETIQUETAS_EQUIPAJE[equipaje.tipo] ?? equipaje.tipo} (${equipaje.peso} kg)`;
}

// Estado compartido entre /checkoutReserva (pasajeros) y /checkoutReserva/pago (pago).
// Vive mientras dure la sesión de la app: si se recarga la página de pago, se pierde
// y el guard manda de vuelta a /checkoutReserva.
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  readonly item = signal<CarritoItem | null>(null);
  readonly vuelo = signal<Vuelo | null>(null);
  readonly equipajes = signal<Equipaje[]>([]);
  readonly asistencias = signal<Asistencia[]>([]);
  readonly tarifas = signal<Tarifas>({ tasaImpuesto: 0, tasaServicio: 0 });
  readonly publicKey = signal('');
  readonly pasajeros = signal<PasajeroFormulario[]>([]);

  // true cuando el formulario de pasajeros se envió válido. Lo usa el guard de la página de pago.
  readonly pasajerosListos = signal(false);

  // Si la reserva se creó pero el pago falló, se reintenta el pago sobre la misma reserva.
  // Se guardan los datos con los que se creó: si cambian, se crea una nueva con los datos correctos.
  private reservaPendiente: { id: number; datos: string } | null = null;

  readonly tarifaBase = computed(
    () => (this.vuelo()?.precioVuelo ?? 0) * this.pasajeros().length
  );

  readonly lineasExtras = computed(() => {
    const lineas: LineaExtra[] = [];

    this.pasajeros().forEach((pasajero, indice) => {
      this.equipajes()
        .filter((equipaje) => pasajero.equipajeIds.includes(equipaje.id))
        .forEach((equipaje) =>
          lineas.push({
            etiqueta: `Pasajero ${indice + 1} · ${etiquetaEquipaje(equipaje)}`,
            precio: equipaje.precio,
          })
        );

      const asistencia = this.asistencias().find(
        (opcion) => String(opcion.id) === pasajero.asistenciaId
      );
      if (asistencia) {
        lineas.push({
          etiqueta: `Pasajero ${indice + 1} · ${asistencia.nombrePlan}`,
          precio: asistencia.precio,
        });
      }
    });

    return lineas;
  });

  readonly totalExtras = computed(() =>
    this.lineasExtras().reduce((suma, linea) => suma + linea.precio, 0)
  );

  // Mismo cálculo que ReservaService.calcularTotal del backend, para mostrar lo mismo que se va a cobrar.
  readonly impuestos = computed(() =>
    Math.round(this.tarifaBase() * this.tarifas().tasaImpuesto)
  );

  readonly servicio = computed(() =>
    Math.round(
      (this.tarifaBase() + this.totalExtras() + this.impuestos()) * this.tarifas().tasaServicio
    )
  );

  readonly total = computed(
    () => this.tarifaBase() + this.totalExtras() + this.impuestos() + this.servicio()
  );

  readonly asientosTexto = computed(() => {
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

  // Carga el carrito y todo lo que hace falta para la reserva.
  // Si el carrito no cambió (por ejemplo, al volver desde la página de pago), mantiene lo que ya se cargó de los pasajeros.
  cargar(): Observable<ErrorCarrito | null> {
    return forkJoin({
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

        // El backend arma una reserva por vuelo y, al aprobarse el pago, vacía todo el carrito.
        // Por eso solo se permite pagar cuando el carrito tiene un único vuelo.
        const items = datos.carrito.items ?? [];
        if (items.length === 0) {
          return of<ErrorCarrito>('carritoVacio');
        }
        if (items.length > 1) {
          return of<ErrorCarrito>('variosVuelos');
        }

        const item = items[0];
        const anterior = this.item();
        const mismoCarrito =
          anterior?.vueloId === item.vueloId &&
          anterior?.cantidad === item.cantidad &&
          anterior?.claseVuelo === item.claseVuelo;

        this.item.set(item);
        if (!mismoCarrito) {
          this.pasajeros.set(this.crearPasajeros(item.cantidad));
          this.reservaPendiente = null;
        }

        return this.vueloService.obtenerPorId(item.vueloId).pipe(
          tap((vuelo) => this.vuelo.set(vuelo)),
          map(() => null)
        );
      })
    );
  }

  // Crea la reserva (o reusa la pendiente) y la paga con el token de la tarjeta.
  pagar(pago: PagoRequest): Observable<PagoResponse> {
    return this.obtenerReservaPendiente().pipe(
      switchMap((reservaId) => this.reservaService.pagarMiReserva(reservaId, pago)),
      tap((respuesta) => {
        if (respuesta.status === 'approved') {
          sessionStorage.removeItem(CLAVE_ASIENTOS);
          this.reservaPendiente = null;
          this.pasajerosListos.set(false);
        } else if (respuesta.status === 'rejected') {
          // El backend cancela la reserva rechazada: el próximo intento crea una nueva.
          this.reservaPendiente = null;
        }
        // in_process / pending: la reserva queda PROCESANDO hasta que Mercado Pago confirme el pago.
      })
    );
  }

  private obtenerReservaPendiente(): Observable<number> {
    const datos = JSON.stringify(this.pasajeros());

    if (this.reservaPendiente?.datos === datos) {
      return of(this.reservaPendiente.id);
    }

    return this.reservaService.crearMiReserva(this.armarReserva()).pipe(
      map((reserva) => {
        this.reservaPendiente = { id: reserva.id, datos };
        return reserva.id;
      })
    );
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
      asistenciaId: '',
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
        asistenciaId: pasajero.asistenciaId ? Number(pasajero.asistenciaId) : null,
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