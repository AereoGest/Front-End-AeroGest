import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Vuelo, VueloFiltros } from '../Models/Vuelo';

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

  buscarDisponibles(filtros: VueloFiltros): Observable<Vuelo[]> {
    return this.http.get<Vuelo[]>(`${this.baseUrl}/disponibles/filtrar`, {
      params: this.aParams(filtros)
    });
  }

  buscarConFiltros(filtros: VueloFiltros & { estado?: string }): Observable<Vuelo[]> {
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
