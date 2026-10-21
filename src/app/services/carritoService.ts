import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Carrito, CarritoItem, ClaseVuelo } from '../Models/Carrito';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private readonly baseUrl = `${environment.apiUrl}/carrito`;

  constructor(private http: HttpClient) {}

  obtenerMiCarrito(): Observable<Carrito> {
    return this.http.get<Carrito>(this.baseUrl);
  }

  agregarItem(vueloId: number, cantidad: number, clase: ClaseVuelo): Observable<CarritoItem> {
    return this.http.post<CarritoItem>(`${this.baseUrl}/items`, {}, {
      params: { vueloId, cantidad, clase }
    });
  }

  actualizarCantidad(itemId: number, cantidad: number): Observable<CarritoItem> {
    return this.http.patch<CarritoItem>(`${this.baseUrl}/items/${itemId}`, {}, {
      params: { cantidad }
    });
  }

  eliminarItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/items/${itemId}`);
  }

  vaciar(carritoId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${carritoId}/clear`);
  }
}
