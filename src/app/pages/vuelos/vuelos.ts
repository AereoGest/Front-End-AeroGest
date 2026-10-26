import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { VueloService } from '../../services/vuelo';
import { Vuelo } from '../../Models/Vuelo';
import { CarritoService } from '../../services/carritoService';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-vuelos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vuelos.html',
  styleUrl: './vuelos.css',
})
export class Vuelos implements OnInit {
  protected readonly vuelos = signal<Vuelo[]>([]);
  protected readonly vueloDetalle = signal<Vuelo | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly busquedaRealizada = signal(false);
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');

  protected readonly origen = signal('');
  protected readonly destino = signal('');
  protected readonly fechaIda = signal('');

  constructor(
    private vueloService: VueloService,
    private route: ActivatedRoute,
    private router: Router,
    private carritoService: CarritoService,
    private auth: Auth
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.origen.set(this.limpiarCiudad(params['origen'] ?? ''));
      this.destino.set(this.limpiarCiudad(params['destino'] ?? ''));
      this.fechaIda.set(params['fecha'] ?? '');
      this.buscar();
    });
  }

  protected buscar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.busquedaRealizada.set(true);

    const filtros = {
      origen: this.origen() || undefined,
      destino: this.destino() || undefined,
      fechaSalida: this.fechaIda()
        ? `${this.fechaIda()}T00:00:00`
        : undefined,
    };

    this.vueloService.buscarDisponibles(filtros).subscribe({
      next: (vuelos) => this.vuelos.set(vuelos ?? []),
      error: (error: HttpErrorResponse) => {
        this.vuelos.set([]);
        this.error.set(
          error.error?.message || 'No se pudieron obtener los vuelos. Intentá nuevamente.'
        );
      },
    }).add(() => this.cargando.set(false));
  }

  protected onBuscar(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/vuelos'], {
      queryParams: {
        origen: this.origen(),
        destino: this.destino(),
        fecha: this.fechaIda(),
      },
    });
  }

  // Agrega 1 pasaje en clase económica y se queda en la página de vuelos.
  protected agregarAlCarrito(vuelo: Vuelo): void {
    if (!this.auth.estaAutenticado()) {
      this.mostrarMensaje(this.mensajeError, 'Iniciá sesión para agregar al carrito.');
      return;
    }

    this.carritoService.agregarItem(Number(vuelo.id), 1, 'ECONOMICA').subscribe({
      next: () => this.mostrarMensaje(this.mensajeExito, 'Vuelo agregado al carrito.'),
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || 'No se pudo agregar al carrito.');
      }
    });
  }

  // Agrega 1 pasaje en clase económica y lleva al carrito.
  protected elegirVuelo(vuelo: Vuelo): void {
    if (!this.auth.estaAutenticado()) {
      this.mostrarMensaje(this.mensajeError, 'Iniciá sesión para comprar.');
      return;
    }

    this.carritoService.agregarItem(Number(vuelo.id), 1, 'ECONOMICA').subscribe({
      next: () => this.router.navigate(['/carrito']),
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || 'No se pudo agregar al carrito.');
      }
    });
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

  // Los mensajes se muestran como toast y se ocultan solos a los 4 segundos.
  private mostrarMensaje(mensaje: typeof this.mensajeExito, texto: string): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
    mensaje.set(texto);
    setTimeout(() => mensaje.set(''), 4000);
  }

  private limpiarCiudad(valor: string): string {
    return valor
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
      .trim();
  }

  protected abrirDetalle (vuelo: Vuelo) {
    console.log('abrir detalle', vuelo)
    this.vueloDetalle.set(vuelo);
  }

  protected cerrarDetalle() {
    this.vueloDetalle.set(null);
  }

  protected elegirDesdeDetalle(vuelo: Vuelo) {
    this.cerrarDetalle();
    this.elegirVuelo(vuelo);
  }

  protected agregarDesdeDetalle(vuelo: Vuelo) {
    this.agregarAlCarrito(vuelo);
    this.cerrarDetalle();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cerrarDetalle();
  }
}
