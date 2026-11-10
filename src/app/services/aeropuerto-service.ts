import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Aeropuerto, AeropuertoRequest } from '../Models/Aeropuerto';

@Injectable({ providedIn: 'root' })
export class AeropuertoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/aeropuertos`;

  getTodos(): Observable<Aeropuerto[]> {
    return this.http.get<Aeropuerto[]>(this.apiUrl, { withCredentials: true });
  }

  crearAeropuerto(dto: AeropuertoRequest): Observable<Aeropuerto> {
    return this.http.post<Aeropuerto>(this.apiUrl, dto, { withCredentials: true });
  }

  actualizarAeropuerto(id: number, dto: AeropuertoRequest): Observable<Aeropuerto> {
    return this.http.put<Aeropuerto>(`${this.apiUrl}/${id}`, dto, { withCredentials: true });
  }

  eliminarAeropuerto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }
}
