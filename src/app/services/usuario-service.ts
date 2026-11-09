import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ActualizarUsuarioRequest, CrearUsuarioRequest, Usuario } from '../Models/Usuario';

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
