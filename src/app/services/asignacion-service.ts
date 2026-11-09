import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Asignacion, AsignacionRequest, EmpleadoAsignacion, EstadoVuelo, RolEmpleado } from '../Models/Asignacion';

export interface FiltroAsignaciones {
  empleadoId?: number | null;
  vueloId?: number | null;
  rolEmpleado?: RolEmpleado | string;
  estadoVuelo?: EstadoVuelo | string;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
}

@Injectable({ providedIn: 'root' })
export class AsignacionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/asignacion`;

  getMisAsignaciones(): Observable<Asignacion[]> {
    return this.http.get<Asignacion[]>(`${this.apiUrl}/mias`, { withCredentials: true });
  }

  getTodas(): Observable<Asignacion[]> {
    return this.http.get<Asignacion[]>(this.apiUrl, { withCredentials: true });
  }

  filtrar(filtros: FiltroAsignaciones): Observable<Asignacion[]> {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<Asignacion[]>(`${this.apiUrl}/filtrar`, { params, withCredentials: true });
  }

  getPorId(id: number): Observable<Asignacion> {
    return this.http.get<Asignacion>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  crearAsignacion(dto: AsignacionRequest): Observable<Asignacion> {
    return this.http.post<Asignacion>(this.apiUrl, dto, { withCredentials: true });
  }

  actualizarAsignacion(id: number, dto: AsignacionRequest): Observable<Asignacion> {
    return this.http.put<Asignacion>(`${this.apiUrl}/${id}`, dto, { withCredentials: true });
  }

  eliminarAsignacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  getEmpleadosDisponibles(): Observable<EmpleadoAsignacion[]> {
    return this.http.get<EmpleadoAsignacion[]>(`${this.apiUrl}/empleados`, { withCredentials: true });
  }
}
