import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, DatosPerfil, Perfil } from '../Models/Perfil';
import { Login } from '../Models/Login';
import { User } from '../Models/User';

const STORAGE_KEYS = ['token', 'email', 'userId', 'perfilCompleto', 'role'];

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly sesion = signal<boolean>(this.haySesion());
  readonly usuarioAutenticado = computed(() => this.sesion());

  constructor(private http: HttpClient) {}

  iniciarSesion(credenciales: Login): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, credenciales)
      .pipe(tap((data) => this.aplicarRespuesta(data)));
  }

  verificarCodigo(email: string, code: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/verify-2fa`, { email, code })
      .pipe(tap((data) => this.aplicarRespuesta(data)));
  }

  registrar(datos: User): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, datos);
  }

  obtenerPerfil(): Observable<Perfil> {
    return this.http.get<Perfil>(`${this.baseUrl}/perfil`);
  }

  actualizarPerfil(datos: DatosPerfil): Observable<AuthResponse> {
    return this.http
      .put<AuthResponse>(`${this.baseUrl}/perfil`, datos)
      .pipe(tap((data) => this.aplicarRespuesta(data)));
  }

  completarPerfil(datos: DatosPerfil): Observable<AuthResponse> {
    return this.http
      .put<AuthResponse>(`${this.baseUrl}/completarPerfil`, datos)
      .pipe(tap((data) => this.aplicarRespuesta(data)));
  }

  toggle2fa(): Observable<string> {
    return this.http.post(`${this.baseUrl}/toggle-2fa`, {}, { responseType: 'text' });
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/reset-password`, {
      token,
      newPassword
    });
  }

  cerrarSesion(): void {
    this.http.post(`${this.baseUrl}/logout`, {}, { responseType: 'text' }).subscribe({
      next: () => this.limpiarSesion(),
      error: () => this.limpiarSesion()
    });
    this.limpiarSesion();
  }

  guardarSesion(data: AuthResponse): void {
    this.aplicarRespuesta(data);
  }

  estaAutenticado(): boolean {
    return this.haySesion();
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  private aplicarRespuesta(data: AuthResponse): void {
    if (!data || data.requires2fa || !data.token) {
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', data.email);
    localStorage.setItem('userId', String(data.userId));
    localStorage.setItem('perfilCompleto', String(data.perfilCompleto ?? false));
    if (data.role) {
      localStorage.setItem('role', data.role);
    }
    this.sesion.set(true);
  }

  private limpiarSesion(): void {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    this.sesion.set(false);
  }

  private haySesion(): boolean {
    return !!localStorage.getItem('token');
  }
}
