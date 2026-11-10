import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Avion, AvionRequest } from '../Models/Avion';

@Injectable({ providedIn: 'root' })
export class AvionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/aviones`;

  obtenerTodos(): Observable<Avion[]> {
    return this.http.get<Avion[]>(this.baseUrl);
  }

  /** Alta de avión (solo ADMIN). */
  crear(avion: AvionRequest): Observable<Avion> {
    return this.http.post<Avion>(this.baseUrl, avion);
  }

  /** Modificación de avión (solo ADMIN). */
  actualizar(id: number, avion: AvionRequest): Observable<Avion> {
    return this.http.put<Avion>(`${this.baseUrl}/${id}`, avion);
  }

  /** Baja lógica: el backend pasa el avión a BAJA (solo ADMIN). */
  darDeBaja(id: number): Observable<Avion> {
    return this.http.delete<Avion>(`${this.baseUrl}/${id}`);
  }
}
