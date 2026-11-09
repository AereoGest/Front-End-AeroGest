import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AsignacionService } from '../../../services/asignacion-service';
import { Asignacion } from '../../../Models/Asignacion';
import { TranslatePipe } from '../../../pipes/translate.pipe'; // <- ajustá la ruta/nombre de tu pipe
import type { TranslationKey } from '../../../i18n/es';     // <- ajustá la ruta

type Pestania = 'proximas' | 'historial' | 'todas';

interface EmpleadoOpcion {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-asignaciones-admin',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './asignaciones-admin.html',
  styleUrl: './asignaciones-admin.css',
})
export class AsignacionesAdmin implements OnInit {
  private asignacionService = inject(AsignacionService);

  readonly roles = ['PILOTO', 'COPILOTO', 'AZAFATA'];
  readonly estados = ['PROGRAMADO', 'BOARDING', 'ACTIVO', 'CANCELADO', 'REPROGRAMADO'];

  asignaciones = signal<Asignacion[]>([]);
  cargando = signal(true);
  error = signal(false);

  // ---- Filtros ----
  pestania = signal<Pestania>('proximas');
  busqueda = signal('');
  empleadoId = signal<number | null>(null);
  rol = signal('');
  estado = signal('');
  desde = signal(''); // 'yyyy-MM-dd'
  hasta = signal('');

  /** Lista de empleados sin repetir, para el select. */
  empleados = computed<EmpleadoOpcion[]>(() => {
    const mapa = new Map<number, string>();
    for (const a of this.asignaciones()) {
      if (a.empleado) mapa.set(a.empleado.id, this.nombreEmpleado(a));
    }
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre));
  });

  /** Asignaciones filtradas por todo menos la pestaña (para los contadores de las tabs). */
  filtradas = computed(() => {
    const texto = this.normalizar(this.busqueda());
    const empleadoId = this.empleadoId();
    const rol = this.rol();
    const estado = this.estado();
    const desde = this.desde();
    const hasta = this.hasta();

    return this.asignaciones()
      .filter(a => !empleadoId || a.empleado?.id === empleadoId)
      .filter(a => !rol || a.rolEmpleado === rol)
      .filter(a => !estado || a.vuelo.estado === estado)
      .filter(a => !desde || a.vuelo.fechaSalida >= desde)
      .filter(a => !hasta || a.vuelo.fechaSalida <= hasta)
      .filter(a => !texto || this.normalizar(this.textoBuscable(a)).includes(texto))
      .sort((x, y) => this.salida(x).getTime() - this.salida(y).getTime());
  });

  proximas = computed(() => this.filtradas().filter(a => !this.terminada(a)));
  historial = computed(() => this.filtradas().filter(a => this.terminada(a)).reverse());

  visibles = computed(() => {
    switch (this.pestania()) {
      case 'proximas': return this.proximas();
      case 'historial': return this.historial();
      default: return this.filtradas();
    }
  });

  hayFiltros = computed(
    () => !!(this.busqueda() || this.empleadoId() || this.rol() || this.estado() || this.desde() || this.hasta())
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.asignacionService.getTodas().subscribe({
      next: lista => {
        this.asignaciones.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
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

  // ---- Helpers ----
  salida(a: Asignacion): Date {
    return new Date(`${a.vuelo.fechaSalida}T${a.vuelo.horaSalida}`);
  }

  llegada(a: Asignacion): Date {
    return new Date(`${a.vuelo.fechaLlegada}T${a.vuelo.horaLlegada}`);
  }

  /** Va al historial si el vuelo ya llegó o si fue cancelado. */
  terminada(a: Asignacion): boolean {
    return a.vuelo.estado === 'CANCELADO' || this.llegada(a) < new Date();
  }

  hora(h: string): string {
    return h?.substring(0, 5) ?? '';
  }

  nombreEmpleado(a: Asignacion): string {
    return a.empleado ? `${a.empleado.apellido}, ${a.empleado.nombre}` : '—';
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
      v.aeropuertoOrigen.codigoIata,
      v.aeropuertoOrigen.ciudad,
      v.aeropuertoDestino.codigoIata,
      v.aeropuertoDestino.ciudad,
      v.avion?.identificador,
    ].join(' ');
  }

  /** Minúsculas y sin tildes, para que "martin" encuentre "Martín". */
  private normalizar(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}