import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Carrito, CarritoItem, ClaseVuelo } from '../../Models/Carrito';
import { Vuelo } from '../../Models/Vuelo';
import { CarritoService } from '../../services/carritoService';
import { VueloService } from '../../services/vuelo';

// El carrito solo trae el id del vuelo; acá se le suman los datos del vuelo para mostrarlos.
interface ItemConVuelo extends CarritoItem {
  vuelo: Vuelo | null;
}

const ETIQUETAS_CLASE: Record<ClaseVuelo, string> = {
  TURISTA: 'Turista',
  ECONOMICA: 'Económica',
  BUSINESS: 'Business',
  PRIMERA: 'Primera',
};

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class MiCarrito implements OnInit {
  protected readonly carrito = signal<Carrito | null>(null);
  protected readonly items = signal<ItemConVuelo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');

  protected readonly total = computed(() =>
    this.items().reduce((suma, item) => suma + this.subtotalItem(item), 0)
  );

  constructor(
    private carritoService: CarritoService,
    private vueloService: VueloService
  ) {}

  ngOnInit(): void {
    this.cargarCarrito();
  }

  protected cargarCarrito(): void {
    this.cargando.set(true);
    this.error.set('');

    this.carritoService.obtenerMiCarrito().pipe(
      switchMap((carrito) => {
        this.carrito.set(carrito);
        return this.agregarDatosDeVuelos(carrito.items ?? []);
      })
    ).subscribe({
      next: (items) => this.items.set(items),
      error: (error: HttpErrorResponse) => {
        this.items.set([]);
        this.error.set(error.error?.message || 'No se pudo cargar el carrito. Intentá nuevamente.');
      }
    }).add(() => this.cargando.set(false));
  }

  protected cambiarCantidad(item: ItemConVuelo, cambio: number): void {
    const nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad < 1) {
      return;
    }

    this.limpiarMensajes();

    this.carritoService.actualizarCantidad(item.id, nuevaCantidad).subscribe({
      next: () => this.cargarCarrito(),
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || 'No se pudo actualizar la cantidad.');
      }
    });
  }

  protected eliminarItem(item: ItemConVuelo): void {
    this.limpiarMensajes();

    this.carritoService.eliminarItem(item.id).subscribe({
      next: () => {
        this.mostrarMensaje(this.mensajeExito, 'Vuelo eliminado del carrito.');
        this.cargarCarrito();
      },
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || 'No se pudo eliminar el vuelo.');
      }
    });
  }

  protected vaciarCarrito(): void {
    const carrito = this.carrito();
    if (!carrito || !confirm('¿Vaciar todo el carrito?')) {
      return;
    }

    this.limpiarMensajes();

    this.carritoService.vaciar(carrito.id).subscribe({
      next: () => {
        this.mostrarMensaje(this.mensajeExito, 'Carrito vaciado.');
        this.cargarCarrito();
      },
      error: (error: HttpErrorResponse) => {
        this.mostrarMensaje(this.mensajeError, error.error?.message || 'No se pudo vaciar el carrito.');
      }
    });
  }

  protected subtotalItem(item: ItemConVuelo): number {
    return (item.vuelo?.precioVuelo ?? 0) * item.cantidad;
  }

  protected etiquetaClase(clase: ClaseVuelo): string {
    return ETIQUETAS_CLASE[clase] ?? clase;
  }

  protected formatearPrecio(valor: number): string {
    return `$${valor.toLocaleString('es-AR')}`;
  }

  // Pide los datos de cada vuelo del carrito. Si alguno falla, el ítem se muestra igual, sin datos del vuelo.
  private agregarDatosDeVuelos(items: CarritoItem[]): Observable<ItemConVuelo[]> {
    if (items.length === 0) {
      return of([]);
    }

    return forkJoin(
      items.map((item) =>
        this.vueloService.obtenerPorId(item.vueloId).pipe(
          map((vuelo) => ({ ...item, vuelo })),
          catchError(() => of({ ...item, vuelo: null }))
        )
      )
    );
  }

  // Los mensajes se muestran como toast y se ocultan solos a los 4 segundos.
  private mostrarMensaje(mensaje: typeof this.mensajeExito, texto: string): void {
    mensaje.set(texto);
    setTimeout(() => mensaje.set(''), 4000);
  }

  private limpiarMensajes(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
  }
}
