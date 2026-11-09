import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ActualizarUsuarioRequest, CrearUsuarioRequest, FiltrosUsuarioRequest, Usuario } from '../Models/Usuario';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth/usuarios`;
  private adminUrl = `${environment.apiUrl}/admin/users`;

  /** Todos los usuarios registrados (solo ADMIN). */
  getTodos(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl, { withCredentials: true });
  }

  getPorId(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  filtrar(filtros: FiltrosUsuarioRequest): Observable<Usuario[]> {
    let params = new HttpParams();
    if (filtros.texto?.trim()) params = params.set('texto', filtros.texto.trim());
    if (filtros.role && filtros.role !== 'TODOS') params = params.set('role', filtros.role);
    if (filtros.identificador && filtros.identificador !== 'TODOS') params = params.set('identificador', filtros.identificador);
    if (filtros.numeroIdentificador?.trim()) params = params.set('numeroIdentificador', filtros.numeroIdentificador.trim());
    if (filtros.orden) params = params.set('orden', filtros.orden);

    return this.http.get<Usuario[]>(`${this.adminUrl}/filtrar`, { params, withCredentials: true });
  }

  filtrarEmpleados(filtros: Omit<FiltrosUsuarioRequest, 'role'>): Observable<Usuario[]> {
    return this.filtrar({ ...filtros, role: 'ROLE_EMPLEADO' });
  }

  crearUsuario(data: CrearUsuarioRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.adminUrl, data, { withCredentials: true });
  }

  actualizarUsuario(id: number, data: ActualizarUsuarioRequest): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.adminUrl}/${id}`, data, { withCredentials: true });
  }

  eliminarUsuario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`, { withCredentials: true });
  }
}
