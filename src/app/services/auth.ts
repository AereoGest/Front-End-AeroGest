import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, DatosPerfil, Perfil, Rol } from '../Models/Perfil';
import { Login } from '../Models/Login';
import { User } from '../Models/User';

const STORAGE_KEYS = ['token', 'email', 'userId', 'perfilCompleto', 'role', 'isVerified'];
const ROLES_VALIDOS: readonly Rol[] = [
  'ROLE_ADMIN',
  'ROLE_EMPLEADO',
  'ROLE_USUARIO',
  'ROLE_INCOMPLETO',
];

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly sesion = signal<boolean>(this.haySesion());
  readonly usuarioAutenticado = computed(() => this.sesion());

  private readonly emailActual = signal<string | null>(this.leerEmail());
  readonly emailUsuario = this.emailActual.asReadonly();

  /**
   * Rol obtenido únicamente desde una fuente confiable del servidor (login, 2FA,
   * verificación de cuenta, actualización de perfil o consulta a GET /api/auth/perfil).
   * Nunca se inicializa desde localStorage para impedir manipulación por el cliente.
   */
  private readonly rolActual = signal<Rol | null>(null);
  readonly rolUsuario = this.rolActual.asReadonly();
  readonly esAdmin = computed(() => this.rolActual() === 'ROLE_ADMIN');
  readonly esEmpleado = computed(() => this.rolActual() === 'ROLE_EMPLEADO');

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
    return this.http.get<Perfil>(`${this.baseUrl}/perfil`).pipe(
      tap((perfil) => {
        if (perfil?.email) {
          this.emailActual.set(perfil.email);
        }
        this.fijarRolConfiable(perfil?.role);
      })
    );
  }

  /**
   * Consulta el rol real del usuario autenticado directamente en el backend.
   */
  sincronizarRolDesdeServidor(): Observable<Rol | null> {
    if (!this.haySesion()) {
      this.rolActual.set(null);
      return of(null);
    }
    return this.obtenerPerfil().pipe(
      map((perfil) => this.normalizarRol(perfil?.role)),
      catchError(() => {
        if (!this.haySesion()) {
          this.rolActual.set(null);
        }
        return of(null);
      })
    );
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

  reenviarVerificacion(email?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/resend-verification`, { email });
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

  invalidarSesionLocal(): void {
    this.limpiarSesion();
  }

  guardarSesion(data: AuthResponse): void {
    this.aplicarRespuesta(data);
  }

  estaAutenticado(): boolean {
    return this.haySesion();
  }

  getRole(): Rol | null {
    return this.rolActual();
  }

  estaVerificado(): boolean {
    return localStorage.getItem('isVerified') === 'true';
  }

  private aplicarRespuesta(data: AuthResponse): void {
    if (!data || data.requires2fa || !data.token) {
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', data.email);
    localStorage.setItem('userId', String(data.userId));
    localStorage.setItem('perfilCompleto', String(data.perfilCompleto ?? false));
    if (data.isVerified !== undefined) {
      localStorage.setItem('isVerified', String(data.isVerified));
    }
    localStorage.removeItem('role');
    this.fijarRolConfiable(data.role);
    this.emailActual.set(data.email);
    this.sesion.set(true);
  }

  private fijarRolConfiable(rol?: string | null): void {
    this.rolActual.set(this.normalizarRol(rol));
  }

  private normalizarRol(rol?: string | null): Rol | null {
    if (!rol) return null;
    return (ROLES_VALIDOS as readonly string[]).includes(rol) ? (rol as Rol) : null;
  }

  private limpiarSesion(): void {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    this.emailActual.set(null);
    this.rolActual.set(null);
    this.sesion.set(false);
  }

  private haySesion(): boolean {
    return !!localStorage.getItem('token');
  }

  private leerEmail(): string | null {
    return localStorage.getItem('email');
  }
}
