import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ValidacionVuelo, Vuelo, VueloRequest } from '../Models/Vuelo';
import { Aeropuerto } from '../Models/Aeropuerto';
import { Avion } from '../Models/Avion';
import { FiltroVuelos } from '../Models/FiltroVuelos';

@Injectable({
  providedIn: 'root'
})
export class VueloService {
  private readonly baseUrl = `${environment.apiUrl}/vuelos`;

  constructor(private http: HttpClient) {}

  obtenerTodos(): Observable<Vuelo[]> {
    return this.http.get<Vuelo[]>(this.baseUrl);
  }

  obtenerDisponibles(): Observable<Vuelo[]> {
    return this.http.get<Vuelo[]>(`${this.baseUrl}/disponibles`);
  }

  obtenerPorId(id: number): Observable<Vuelo> {
    return this.http.get<Vuelo>(`${this.baseUrl}/${id}`);
  }

  /** Alta de vuelo (solo ADMIN). */
  crear(vuelo: VueloRequest): Observable<Vuelo> {
    return this.http.post<Vuelo>(this.baseUrl, vuelo);
  }

  /** Modificación de vuelo (solo ADMIN). */
  actualizar(id: number, vuelo: VueloRequest): Observable<Vuelo> {
    return this.http.put<Vuelo>(`${this.baseUrl}/${id}`, vuelo);
  }

  /** Baja lógica: el backend pasa el vuelo a CANCELADO (solo ADMIN). */
  darDeBaja(id: number): Observable<Vuelo> {
    return this.http.delete<Vuelo>(`${this.baseUrl}/${id}`);
  }

  /**
   * Corre en el backend las mismas validaciones del alta/modificación sin guardar.
   * Sin vueloId valida un alta; con vueloId, la modificación de ese vuelo.
   */
  validar(vuelo: VueloRequest, vueloId?: number): Observable<ValidacionVuelo> {
    const params = vueloId != null ? new HttpParams().set('vueloId', vueloId) : undefined;
    return this.http.post<ValidacionVuelo>(`${this.baseUrl}/validar`, vuelo, { params });
  }

  /** Aeropuertos para armar el formulario de alta/modificación. */
  obtenerAeropuertos(): Observable<Aeropuerto[]> {
    return this.http.get<Aeropuerto[]>(`${environment.apiUrl}/aeropuertos`);
  }

  /** Aviones para armar el formulario de alta/modificación. */
  obtenerAviones(): Observable<Avion[]> {
    return this.http.get<Avion[]>(`${environment.apiUrl}/aviones`);
  }

  buscarDisponibles(filtros: FiltroVuelos): Observable<Vuelo[]> {
    return this.http.get<Vuelo[]>(`${this.baseUrl}/disponibles/filtrar`, {
      params: this.aParams(filtros)
    });
  }

  buscarConFiltros(filtros: FiltroVuelos & { estado?: string }): Observable<Vuelo[]> {
    return this.http.get<Vuelo[]>(`${this.baseUrl}/filtrar`, {
      params: this.aParams(filtros)
    });
  }

  private aParams(filtros: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    Object.entries(filtros as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
