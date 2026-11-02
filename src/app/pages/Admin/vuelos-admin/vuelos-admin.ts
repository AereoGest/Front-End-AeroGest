import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { VueloService } from '../../../services/vuelo';
import { Vuelo } from '../../../Models/Vuelo';
import { TranslatePipe } from '../../../pipes/translate.pipe';

type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

// Estados que el panel considera "inactivos". Ajustalo a los valores reales de tu backend.
// Si tu modelo Vuelo tiene un booleano (ej. `activo`), cambiá directamente esActivo().
const ESTADOS_INACTIVOS = ['INACTIVO', 'CANCELADO', 'FINALIZADO'];

@Component({
  selector: 'app-vuelos-admin',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './vuelos-admin.html',
  styleUrl: './vuelos-admin.css',
})
export class VuelosAdmin implements OnInit {
  private readonly vueloService = inject(VueloService);

  protected readonly vuelos = signal<Vuelo[]>([]);
  protected readonly vueloDetalle = signal<Vuelo | null>(null);
  protected readonly cargando = signal(false);
  // null = sin error · '' = error sin mensaje del backend (se muestra el texto traducido por defecto)
  protected readonly error = signal<string | null>(null);
  protected readonly cerrando = signal(false);

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

  ngOnInit(): void {
    this.cargar();
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

  protected onBuscar(event: Event): void {
    event.preventDefault(); // el filtrado ya es en vivo; solo evitamos el submit
  }

  protected limpiarFiltros(): void {
    this.origen.set('');
    this.destino.set('');
    this.fechaIda.set('');
  }

  protected esActivo(vuelo: Vuelo): boolean {
    return !ESTADOS_INACTIVOS.includes(String(vuelo.estado ?? '').toUpperCase());
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
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)/g, '')
      .toLowerCase()
      .trim();
  }

  protected abrirDetalle(vuelo: Vuelo) {
    this.cerrando.set(false);
    this.vueloDetalle.set(vuelo);
  }

  protected cerrarDetalle() {
    if (!this.vueloDetalle() || this.cerrando()) return;
    this.cerrando.set(true);
    setTimeout(() => {
      this.vueloDetalle.set(null);
      this.cerrando.set(false);
    }, 400);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cerrarDetalle();
  }
}