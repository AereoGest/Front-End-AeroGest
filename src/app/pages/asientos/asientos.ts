import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import AsientoModel from '../../Models/AsientoModel';
import AsientoVista from '../../Models/AsientoVista';
import { ClaseVuelo } from '../../Models/Carrito';
import FilaAsientos from '../../Models/FilaAsientos';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Asiento, AsientoService } from '../../services/asiento';
import { CarritoService } from '../../services/carritoService';
import { I18nService } from '../../services/i18n';
import { VueloService } from '../../services/vuelo';

export type ErrorAsientos = 'carritoVacio' | 'variosVuelos' | 'servidor' | 'sinAsientos';

export interface SeccionCabina {
  categoria: ClaseVuelo;
  tituloKey: string;
  claseTexto: string;
  zona: 'first-class' | 'biz' | 'eco';
  filas: FilaAsientos[];
  disponibles: number;
  total: number;
  precioDesde: number;
}

interface ConfigCategoria {
  categoria: ClaseVuelo;
  tituloKey: string;
  claseTexto: string;
  zona: 'first-class' | 'biz' | 'eco';
}

const CONFIG_CATEGORIAS: ConfigCategoria[] = [
  { categoria: 'PRIMERA', tituloKey: 'seats.firstClass', claseTexto: 'Primera', zona: 'first-class' },
  { categoria: 'BUSINESS', tituloKey: 'seats.businessClass', claseTexto: 'Ejecutiva', zona: 'biz' },
  { categoria: 'ECONOMICA', tituloKey: 'seats.economyClass', claseTexto: 'Económica', zona: 'eco' },
];

const CLAVE_ASIENTOS = 'asientos_seleccionados';
const CLAVE_ASIENTOS_VUELO = 'asientos_vuelo_id';

@Component({
  selector: 'app-asientos',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './asientos.html',
  styleUrl: './asientos.css',
})
export class Asientos implements OnInit {
  private readonly carritoService = inject(CarritoService);
  private readonly vueloService = inject(VueloService);
  private readonly asientoService = inject(AsientoService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly i18n = inject(I18nService);

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<ErrorAsientos | null>(null);

  vueloIdActual: number | null = null;
  basePrice = 0;
  seatsNeeded = 1;
  selectedSeats: AsientoModel[] = [];

  origen = '—';
  destino = '—';

  seccionesCabina: SeccionCabina[] = [];

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.seccionesCabina = [];
    this.vueloIdActual = null;

    this.carritoService.obtenerMiCarrito().subscribe({
      next: (carrito) => {
        const items = carrito?.items ?? [];

        if (items.length === 0) {
          this.limpiarSeleccion(null);
          this.cargando.set(false);
          this.errorCarga.set('carritoVacio');
          this.cdr.detectChanges();
          return;
        }

        if (items.length > 1) {
          this.cargando.set(false);
          this.errorCarga.set('variosVuelos');
          this.cdr.detectChanges();
          return;
        }

        const item = items[0];
        this.vueloIdActual = item.vueloId;
        this.seatsNeeded = Math.max(1, item.cantidad || 1);

        forkJoin({
          vuelo: this.vueloService.obtenerPorId(item.vueloId),
          asientos: this.asientoService.obtenerPorVuelo(item.vueloId),
        }).subscribe({
          next: ({ vuelo, asientos }) => {
            this.basePrice = Number(vuelo?.precioVuelo ?? 0);
            this.origen = vuelo?.aeropuertoOrigen?.ciudad
              ? `${vuelo.aeropuertoOrigen.ciudad} (${vuelo.aeropuertoOrigen.codigoIata})`
              : '—';
            this.destino = vuelo?.aeropuertoDestino?.ciudad
              ? `${vuelo.aeropuertoDestino.ciudad} (${vuelo.aeropuertoDestino.codigoIata})`
              : '—';

            const lista = asientos ?? [];
            if (lista.length === 0) {
              this.limpiarSeleccion(item.vueloId);
              this.cargando.set(false);
              this.errorCarga.set('sinAsientos');
              this.cdr.detectChanges();
              return;
            }

            this.seccionesCabina = this.construirSecciones(lista);
            this.restaurarSeleccion(item.vueloId, lista);
            this.cargando.set(false);
            this.cdr.detectChanges();
          },
          error: () => {
            this.cargando.set(false);
            this.errorCarga.set('servidor');
            this.cdr.detectChanges();
          },
        });
      },
      error: () => {
        this.cargando.set(false);
        this.errorCarga.set('servidor');
        this.cdr.detectChanges();
      },
    });
  }

  private construirSecciones(asientos: Asiento[]): SeccionCabina[] {
    const porCategoria = new Map<ClaseVuelo, Asiento[]>();

    for (const asiento of asientos) {
      const cat = this.categoriaEfectiva(asiento);
      const grupo = porCategoria.get(cat) ?? [];
      grupo.push(asiento);
      porCategoria.set(cat, grupo);
    }

    const secciones: SeccionCabina[] = [];

    for (const cfg of CONFIG_CATEGORIAS) {
      const grupo = porCategoria.get(cfg.categoria);
      if (!grupo?.length) {
        continue;
      }

      const disponibles = grupo.filter((a) => !a.ocupado).length;
      const precios = grupo.map((a) => Number(a.precioExtra ?? 0));

      secciones.push({
        categoria: cfg.categoria,
        tituloKey: cfg.tituloKey,
        claseTexto: cfg.claseTexto,
        zona: cfg.zona,
        filas: this.construirFilasCategoria(grupo, cfg),
        disponibles,
        total: grupo.length,
        precioDesde: precios.length ? Math.min(...precios) : 0,
      });
    }

    return secciones;
  }

  private construirFilasCategoria(asientos: Asiento[], cfg: ConfigCategoria): FilaAsientos[] {
    const parsed = asientos
      .map((asiento) => ({
        asiento,
        ...this.parsearCodigo(asiento.codigo),
      }))
      .sort((a, b) => a.fila - b.fila || a.columna.localeCompare(b.columna));

    // El punto de pasillo se calcula sobre todas las columnas de la categoría para
    // alinear correctamente tanto filas completas como la última fila parcial.
    const columnasOrdenadas = Array.from(new Set(parsed.map((p) => p.columna))).sort((a, b) =>
      a.localeCompare(b)
    );
    const corteIzquierda = Math.ceil(columnasOrdenadas.length / 2);
    const columnasIzquierda = new Set(columnasOrdenadas.slice(0, corteIzquierda));

    const porFila = new Map<number, typeof parsed>();
    for (const item of parsed) {
      const filaActual = porFila.get(item.fila) ?? [];
      filaActual.push(item);
      porFila.set(item.fila, filaActual);
    }

    return Array.from(porFila.entries())
      .sort(([a], [b]) => a - b)
      .map(([numero, items]) => {
        const asientosIzquierda: AsientoVista[] = [];
        const asientosDerecha: AsientoVista[] = [];

        for (const item of items) {
          const vista: AsientoVista = {
            id: item.asiento.codigo,
            backendId: item.asiento.id,
            clase: cfg.claseTexto,
            categoria: cfg.categoria,
            precio: Number(item.asiento.precioExtra ?? 0),
            zona: cfg.zona,
            ocupado: Boolean(item.asiento.ocupado),
          };

          if (columnasIzquierda.has(item.columna)) {
            asientosIzquierda.push(vista);
          } else {
            asientosDerecha.push(vista);
          }
        }

        return { numero, asientosIzquierda, asientosDerecha };
      });
  }

  private parsearCodigo(codigo: string): { fila: number; columna: string } {
    const match = /^(\d+)\s*([A-Za-z]+)$/.exec(codigo.trim());
    if (match) {
      return { fila: Number(match[1]), columna: match[2].toUpperCase() };
    }
    return { fila: 0, columna: codigo.trim().toUpperCase() };
  }

  private categoriaEfectiva(asiento: Asiento): ClaseVuelo {
    if (
      asiento.categoria === 'PRIMERA' ||
      asiento.categoria === 'BUSINESS' ||
      asiento.categoria === 'ECONOMICA'
    ) {
      return asiento.categoria;
    }

    const extra = Number(asiento.precioExtra ?? 0);
    if (extra >= 40000) {
      return 'PRIMERA';
    }
    if (extra > 0) {
      return 'BUSINESS';
    }
    return 'ECONOMICA';
  }

  private restaurarSeleccion(vueloId: number, asientosVuelo: Asiento[]): void {
    const vueloGuardado = sessionStorage.getItem(CLAVE_ASIENTOS_VUELO);
    if (vueloGuardado !== String(vueloId)) {
      this.limpiarSeleccion(vueloId);
      return;
    }

    let guardados: Partial<AsientoModel>[] = [];
    try {
      guardados = JSON.parse(sessionStorage.getItem(CLAVE_ASIENTOS) ?? '[]');
      if (!Array.isArray(guardados)) {
        guardados = [];
      }
    } catch {
      guardados = [];
    }

    const reconstruidos: AsientoModel[] = [];
    const vistos = new Set<number>();

    for (const saved of guardados) {
      if (reconstruidos.length >= this.seatsNeeded) {
        break;
      }

      const backend = asientosVuelo.find(
        (a) =>
          (saved.backendId != null && a.id === saved.backendId) ||
          (saved.id != null && a.codigo === saved.id)
      );

      if (!backend || backend.ocupado || vistos.has(backend.id)) {
        continue;
      }

      vistos.add(backend.id);
      const categoria = this.categoriaEfectiva(backend);
      const cfg = CONFIG_CATEGORIAS.find((c) => c.categoria === categoria) ?? CONFIG_CATEGORIAS[2];

      reconstruidos.push({
        id: backend.codigo,
        backendId: backend.id,
        clase: cfg.claseTexto,
        categoria,
        precio: Number(backend.precioExtra ?? 0),
      });
    }

    this.selectedSeats = reconstruidos;
    this.guardarSeleccion(vueloId);
  }

  private limpiarSeleccion(vueloId: number | null): void {
    this.selectedSeats = [];
    if (vueloId === null) {
      sessionStorage.removeItem(CLAVE_ASIENTOS);
      sessionStorage.removeItem(CLAVE_ASIENTOS_VUELO);
      return;
    }
    this.guardarSeleccion(vueloId);
  }

  private guardarSeleccion(vueloId: number | null = this.vueloIdActual): void {
    sessionStorage.setItem(CLAVE_ASIENTOS, JSON.stringify(this.selectedSeats));
    if (vueloId !== null) {
      sessionStorage.setItem(CLAVE_ASIENTOS_VUELO, String(vueloId));
    }
  }

  toggleSeat(asiento: AsientoVista): void {
    if (asiento.ocupado) {
      return;
    }

    const yaSeleccionado = this.estaSeleccionado(asiento.id);

    if (yaSeleccionado) {
      this.selectedSeats = this.selectedSeats.filter(
        (seleccionado) => seleccionado.id !== asiento.id
      );
    } else {
      if (this.selectedSeats.length >= this.seatsNeeded) {
        return;
      }

      this.selectedSeats = [
        ...this.selectedSeats,
        {
          id: asiento.id,
          backendId: asiento.backendId,
          clase: asiento.clase,
          categoria: asiento.categoria,
          precio: Number(asiento.precio ?? 0),
        },
      ];
    }

    this.guardarSeleccion();
    this.cdr.detectChanges();
  }

  estaSeleccionado(id: string): boolean {
    return this.selectedSeats.some((asiento) => asiento.id === id);
  }

  tooltipAsiento(asiento: AsientoVista): string {
    if (asiento.ocupado) {
      return this.i18n.t('seats.taken');
    }
    const precio = Number(asiento.precio ?? 0);
    if (precio > 0) {
      return `${asiento.id} · ${asiento.clase} (+$${this.formatearPrecio(precio)})`;
    }
    return `${asiento.id} · ${asiento.clase} (${this.i18n.t('seats.freeBadge')})`;
  }

  formatearPrecio(valor: number): string {
    return valor.toLocaleString('es-AR');
  }

  get tarifaBaseTotal(): number {
    return this.basePrice * this.seatsNeeded;
  }

  get totalExtra(): number {
    return this.selectedSeats.reduce((suma, asiento) => suma + Number(asiento.precio ?? 0), 0);
  }

  get total(): number {
    return this.tarifaBaseTotal + this.totalExtra;
  }

  get asientosTexto(): string {
    return this.selectedSeats.length
      ? this.selectedSeats.map((asiento) => asiento.id).join(', ')
      : '—';
  }

  continuarPago(): void {
    if (this.cargando() || this.errorCarga()) {
      return;
    }
    this.guardarSeleccion();
    this.router.navigate(['/checkoutReserva']);
  }
}
