import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe'; // ajustar al path real
import { Vuelo } from '../../Models/Vuelo';
import { Favorito } from '../../Models/Favorito';
import { ClaseVuelo } from '../../Models/Carrito';
import { CarritoService } from '../../services/carritoService';   // ajustar al path real
import { FavoritoService } from '../../services/favorito-service'; // ajustar al path real

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, TranslatePipe],
  templateUrl: './favoritos.html',
  styleUrl: './favoritos.css'
})
export class Favoritos implements OnInit {

  private favoritoService = inject(FavoritoService);
  private carritoService = inject(CarritoService);
  protected router = inject(Router); // protected: el template usa router.navigate

  // Estado de la pantalla
  favoritos = signal<Favorito[]>([]);
  vuelos = signal<(Vuelo | null)[]>([]);
  cargando = signal(true);
  mensaje = signal('');
  tipoMensaje = signal<'success' | 'error'>('success');

  /** Id del vuelo que se está mandando al carrito, para deshabilitar su botón. */
  agregandoId = signal<number | null>(null);

  private readonly claseDefault = 'ECONOMICA' as ClaseVuelo;

  ngOnInit(): void {
    this.cargarFavoritos();
  }

  async cargarFavoritos(): Promise<void> {
    this.cargando.set(true);

    try {
      const { favoritos, vuelos } = await firstValueFrom(
        this.favoritoService.obtenerFavoritosConVuelos()
      );
      this.favoritos.set(favoritos);
      this.vuelos.set(vuelos);

    } catch (error: any) {
      console.error('Error cargando favoritos', error);
      this.mostrarError(error, 'favorites.messages.loadError');
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminarFavorito(favoritoId: number): Promise<void> {
    try {
      await firstValueFrom(this.favoritoService.eliminarFavorito(favoritoId));

      // Lo saco de la lista local sin volver a pedir todo al backend
      const indice = this.favoritos().findIndex(f => f.id === favoritoId);
      this.favoritos.update(lista => lista.filter((_, i) => i !== indice));
      this.vuelos.update(lista => lista.filter((_, i) => i !== indice));

      this.mostrarExito('favorites.messages.removed');

    } catch (error: any) {
      this.mostrarError(error, 'favorites.messages.removeError');
    }
  }

  async agregarAlCarrito(vueloId: number): Promise<void> {
    this.agregandoId.set(vueloId);

    try {
      await firstValueFrom(
        this.carritoService.agregarItem(vueloId, 1, this.claseDefault)
      );
      this.mostrarExito('favorites.messages.addedToCart');

    } catch (error: any) {
      this.mostrarError(error, 'favorites.messages.cartError');
    } finally {
      this.agregandoId.set(null);
    }
  }

  // Helpers de mensajes
  private mostrarExito(clave: string): void {
    this.mensaje.set(clave);
    this.tipoMensaje.set('success');
  }

  private mostrarError(error: any, claveDefault: string): void {
    // Si el backend manda un mensaje, se muestra tal cual; si no, la clave de traducción
    this.mensaje.set(error?.error?.message || claveDefault);
    this.tipoMensaje.set('error');
  }
}