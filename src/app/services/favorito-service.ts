import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, map, switchMap, catchError } from 'rxjs';
import { environment } from '../../environments/environment'; // ajustar el path como en CarritoService
import { Favorito } from '../Models/Favorito';
import { Vuelo } from '../Models/Vuelo';

@Injectable({
  providedIn: 'root'
})
export class FavoritoService {

  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/favoritos`;

  /** Trae los favoritos del usuario logueado. */
  obtenerFavoritos(): Observable<Favorito[]> {
    return this.http.get<Favorito[]>(this.apiUrl);
  }

  /** Trae los favoritos junto con el vuelo de cada uno (null si el vuelo no se pudo cargar). */
  obtenerFavoritosConVuelos(): Observable<{ favoritos: Favorito[]; vuelos: (Vuelo | null)[] }> {
    return this.obtenerFavoritos().pipe(
      switchMap(favoritos => {
        if (favoritos.length === 0) {
          return of({ favoritos, vuelos: [] });
        }
        const pedidos = favoritos.map(f =>
          this.http.get<Vuelo>(`${environment.apiUrl}/vuelos/${f.vueloId}`).pipe(
            catchError(() => of(null)) // si un vuelo falla, no rompe toda la lista
          )
        );
        return forkJoin(pedidos).pipe(
          map(vuelos => ({ favoritos, vuelos }))
        );
      })
    );
  }

  /** Elimina un favorito por su id. */
  eliminarFavorito(favoritoId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${favoritoId}`);
  }
}