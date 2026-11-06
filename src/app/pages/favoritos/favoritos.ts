import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe'; // ajustar al nombre y path de su pipe de i18n
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment'; // ajustar el path como en CarritoService
import { Vuelo } from '../../Models/Vuelo';
import { Favorito } from '../../Models/Favorito';
import { ClaseVuelo } from '../../Models/Carrito';
import { CarritoService } from '../../services/carritoService'; // ajustar al path real

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, TranslatePipe],
  templateUrl: './favoritos.html',
  styleUrl: './favoritos.css'
})
export class Favoritos implements OnInit {

  private http = inject(HttpClient);
  private carritoService = inject(CarritoService);
  protected router = inject(Router); // protected: el template usa router.navigate

  private readonly apiUrl = environment.apiUrl;

  // Signals: Angular se entera solo cuando cambian, aunque sea después de un await
  favoritos = signal<Favorito[]>([]);
  vuelos = signal<(Vuelo | null)[]>([]);
  cargando = signal(true);
  mensaje = signal('');
  tipoMensaje = signal<'success' | 'error'>('success');

  /** Id del vuelo que se está mandando al carrito, para deshabilitar su botón. */
  agregandoId = signal<number | null>(null);

  // Clase con la que se manda al carrito. Tiene que ser un valor válido de ClaseVuelo.
  private readonly claseDefault = 'ECONOMICA' as ClaseVuelo;

  ngOnInit(): void {
    this.cargarFavoritos();
  }

  async cargarFavoritos(): Promise<void> {
    this.cargando.set(true);

    try {
      const favoritos = await firstValueFrom(
        this.http.get<Favorito[]>(`${this.apiUrl}/favoritos`)
      );

      const vuelos = await Promise.all(
        favoritos.map(async (favorito) => {
          try {
            return await firstValueFrom(
              this.http.get<Vuelo>(`${this.apiUrl}/vuelos/${favorito.vueloId}`)
            );
          } catch {
            return null;
          }
        })
      );

      this.favoritos.set(favoritos);
      this.vuelos.set(vuelos);

    } catch (error: any) {
      console.error('Error cargando favoritos', error);
      // Si el backend manda un mensaje, se muestra tal cual; si no, la clave de traducción
      this.mensaje.set(error.error?.message || 'favorites.messages.loadError');
      this.tipoMensaje.set('error');
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminarFavorito(favoritoId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/favoritos/${favoritoId}`)
      );

      // Lo saco de la lista local sin volver a pedir todo al backend
      const indice = this.favoritos().findIndex(f => f.id === favoritoId);
      this.favoritos.update(lista => lista.filter((_, i) => i !== indice));
      this.vuelos.update(lista => lista.filter((_, i) => i !== indice));

      this.mensaje.set('favorites.messages.removed');
      this.tipoMensaje.set('success');

    } catch (error: any) {
      this.mensaje.set(error.error?.message || 'favorites.messages.removeError');
      this.tipoMensaje.set('error');
    }
  }

  async agregarAlCarrito(vueloId: number): Promise<void> {
    this.agregandoId.set(vueloId);

    try {
      await firstValueFrom(
        this.carritoService.agregarItem(vueloId, 1, this.claseDefault)
      );

      this.mensaje.set('favorites.messages.addedToCart');
      this.tipoMensaje.set('success');

    } catch (error: any) {
      this.mensaje.set(error.error?.message || 'favorites.messages.cartError');
      this.tipoMensaje.set('error');
    } finally {
      this.agregandoId.set(null);
    }
  }
}