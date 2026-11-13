import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import type { TranslationKey } from '../../../i18n/es';
import { VentaService } from '../../../services/venta-service';
import { MetodoPago, Transaccion, VentaDiaria } from '../../../Models/Venta';

type RangoRapido = 7 | 30 | 90 | null;

@Component({
  selector: 'app-ventas-admin',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './ventas-admin.html',
  styleUrl: './ventas-admin.css',
})
export class VentasAdmin implements OnInit {
  private ventaService = inject(VentaService);

  readonly rangosRapidos: Exclude<RangoRapido, null>[] = [7, 30, 90];
   readonly metodos: MetodoPago[] = ['TARJETA_CREDITO', 'TARJETA_DEBITO'];
  readonly hoy = this.fechaISO(new Date());

  // ---- Estado ----
  ventas = signal<VentaDiaria[]>([]);
  transacciones = signal<Transaccion[]>([]);
  cargando = signal(true);
  error = signal(false);

  // ---- Rango de fechas ----
  rango = signal<RangoRapido>(30);
  desde = signal(this.restarDias(this.hoy, 29));
  hasta = signal(this.hoy);

  // ---- Filtros del historial ----
  busqueda = signal('');
  metodo = signal<'' | MetodoPago>('');
  diaSeleccionado = signal<string | null>(null);

  // ---- Gráfico ----
  hoverIndex = signal<number | null>(null);

  // =================== Indicadores ===================

  totalPeriodo = computed(() => this.ventas().reduce((s, v) => s + v.total, 0));
  cantidadPeriodo = computed(() => this.ventas().reduce((s, v) => s + v.cantidad, 0));
  ticketPromedio = computed(() => (this.cantidadPeriodo() ? this.totalPeriodo() / this.cantidadPeriodo() : 0));

  /** Ventas de hoy (null si hoy no está dentro del rango elegido). */
  ventasHoy = computed(() => this.ventas().find(v => v.fecha === this.hoy) ?? null);

  mejorDia = computed(() =>
    this.ventas().reduce<VentaDiaria | null>((mejor, v) => (v.total > 0 && (!mejor || v.total > mejor.total) ? v : mejor), null)
  );

  // =================== Gráfico ===================

  /** Tope del eje Y redondeado a un número "lindo" (1, 2, 2.5, 5 × 10^n). */
  ejeMax = computed(() => {
    const max = Math.max(0, ...this.ventas().map(v => v.total));
    if (max === 0) return 1;
    const pot = Math.pow(10, Math.floor(Math.log10(max)));
    const paso = [1, 2, 2.5, 5, 10].find(p => p * pot >= max)!;
    return paso * pot;
  });

  /** Líneas guía del eje Y: 0, 25%, 50%, 75%, 100%. */
  ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => f * this.ejeMax()));

  /** Cada cuántos días se muestra la etiqueta del eje X para que no se pisen. */
  pasoEtiquetas = computed(() => Math.max(1, Math.ceil(this.ventas().length / 10)));

  ventaHover = computed(() => {
    const i = this.hoverIndex();
    return i === null ? null : this.ventas()[i] ?? null;
  });

  // =================== Historial ===================

  transaccionesFiltradas = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const metodo = this.metodo();
    const dia = this.diaSeleccionado();

    return this.transacciones()
      .filter(t => !dia || t.fechaEmision.startsWith(dia))
      .filter(t => !metodo || t.metodoDePago === metodo)
      .filter(t => !texto || this.normalizar(`${t.codigoReserva} ${t.cliente} ${t.cuil} ${t.facturaId}`).includes(texto));
  });

 totalFiltrado = computed(() => this.transaccionesFiltradas().reduce((s, t) => s + t.totalNeto, 0));

  hayFiltros = computed(() => !!this.busqueda() || !!this.metodo() || !!this.diaSeleccionado());

  // =================== Ciclo de vida ===================

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    if (this.desde() > this.hasta()) return;

    this.cargando.set(true);
    this.error.set(false);
    this.diaSeleccionado.set(null);
    this.hoverIndex.set(null);

    forkJoin({
      ventas: this.ventaService.getVentasDiarias(this.desde(), this.hasta()),
      transacciones: this.ventaService.getTransacciones(this.desde(), this.hasta()),
    }).subscribe({
      next: ({ ventas, transacciones }) => {
        this.ventas.set(ventas);
        this.transacciones.set(transacciones);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  // =================== Acciones ===================

  elegirRango(dias: Exclude<RangoRapido, null>): void {
    this.rango.set(dias);
    this.hasta.set(this.hoy);
    this.desde.set(this.restarDias(this.hoy, dias - 1));
    this.cargar();
  }

  onDesde(event: Event): void {
    this.desde.set(this.valor(event));
    this.rango.set(null);
    this.cargar();
  }

  onHasta(event: Event): void {
    this.hasta.set(this.valor(event));
    this.rango.set(null);
    this.cargar();
  }

  onMetodo(event: Event): void {
    this.metodo.set(this.valor(event) as '' | MetodoPago);
  }

  /** Click en una barra: filtra el historial por ese día (otro click lo saca). */
  seleccionarDia(v: VentaDiaria): void {
    this.diaSeleccionado.set(this.diaSeleccionado() === v.fecha ? null : v.fecha);
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.metodo.set('');
    this.diaSeleccionado.set(null);
  }

  // =================== Helpers ===================

  valor(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  alturaBarra(v: VentaDiaria): number {
    return (v.total / this.ejeMax()) * 100;
  }

  /** Posición horizontal (en %) del centro de la barra, acotada para que el tooltip no se salga por los bordes. */
  posicionTooltip(i: number): number {
    const centro = ((i + 0.5) / this.ventas().length) * 100;
    return Math.min(88, Math.max(12, centro));
  }

  mostrarEtiqueta(i: number): boolean {
    const n = this.ventas().length;
    return i === n - 1 || (i % this.pasoEtiquetas() === 0 && n - 1 - i >= this.pasoEtiquetas() / 2);
  }

  /** 'yyyy-MM-dd' -> Date en hora local (sin corrimiento por zona horaria). */
  fecha(iso: string): Date {
    const [a, m, d] = iso.substring(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor);
  }

  monedaCorta(valor: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', notation: 'compact', maximumFractionDigits: 1,
    }).format(valor);
  }

  metodoKey(m: string): TranslationKey {
    return `adminSales.method.${m}` as TranslationKey;
  }

  estadoKey(e: string): TranslationKey {
    return `adminBookings.status.${e}` as TranslationKey;
  }

  private fechaISO(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private restarDias(iso: string, dias: number): string {
    const d = this.fecha(iso);
    d.setDate(d.getDate() - dias);
    return this.fechaISO(d);
  }

  private normalizar(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}