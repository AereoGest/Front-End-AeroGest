import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, DatosPerfil, Perfil, Rol, TotpSetupResponse } from '../Models/Perfil';
import { Login } from '../Models/Login';
import { User } from '../Models/User';

/**
 * Claves sensibles o redundantes que nunca deben persistirse en localStorage
 * para evitar exposición de datos y manipulación del estado del cliente.
 */
export const SENSITIVE_STORAGE_KEYS = ['email', 'userId', 'perfilCompleto', 'role', 'isVerified'] as const;

export interface JwtPayload {
  sub?: string;
  email?: string;
  userId?: number;
  role?: string;
  isVerified?: boolean;
  perfilCompleto?: boolean;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decodifica de forma segura el payload de un JWT (formato base64url) sin dependencias externas.
 */
export function decodificarToken(token: string | null): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Verifica si el token JWT ya expiró basándose en su claim `exp`.
 */
export function esTokenExpirado(payload: JwtPayload | null): boolean {
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now();
}

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

  private readonly sesion = signal<boolean>(false);
  readonly usuarioAutenticado = computed(() => this.sesion());

  private readonly emailActual = signal<string | null>(null);
  readonly emailUsuario = this.emailActual.asReadonly();

  private readonly userIdActual = signal<number | null>(null);
  readonly userId = this.userIdActual.asReadonly();

  private readonly verificadoActual = signal<boolean>(false);
  readonly esVerificado = this.verificadoActual.asReadonly();

  private readonly perfilCompletoActual = signal<boolean>(false);
  readonly perfilCompleto = this.perfilCompletoActual.asReadonly();

  /**
   * Rol obtenido únicamente desde una fuente confiable (claims del JWT firmado
   * o consulta a GET /api/auth/perfil en el servidor).
   * Nunca se almacena en localStorage.
   */
  private readonly rolActual = signal<Rol | null>(null);
  readonly rolUsuario = this.rolActual.asReadonly();
  readonly esAdmin = computed(() => this.rolActual() === 'ROLE_ADMIN');
  readonly esEmpleado = computed(() => this.rolActual() === 'ROLE_EMPLEADO');

  constructor(private http: HttpClient) {
    this.inicializarSesionSegura();
  }

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
        if (typeof perfil?.isVerified === 'boolean') {
          this.verificadoActual.set(perfil.isVerified);
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

  setupTotp(): Observable<TotpSetupResponse> {
    return this.http.get<TotpSetupResponse>(`${this.baseUrl}/2fa/totp/setup`);
  }

  activarTotp(secret: string, code: string): Observable<string> {
    return this.http.post(`${this.baseUrl}/2fa/totp/activar`, { secret, code }, { responseType: 'text' });
  }

  desactivarTotp(): Observable<string> {
    return this.http.post(`${this.baseUrl}/2fa/totp/desactivar`, {}, { responseType: 'text' });
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

  getUserId(): number | null {
    return this.userIdActual();
  }

  estaVerificado(): boolean {
    return this.verificadoActual();
  }

  estaPerfilCompleto(): boolean {
    return this.perfilCompletoActual();
  }

  obtenerToken(): string | null {
    if (!this.haySesion()) {
      return null;
    }
    return typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  }

  private inicializarSesionSegura(): void {
    this.purgarClavesInnecesarias();
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return;
    }

    const payload = decodificarToken(token);
    if (esTokenExpirado(payload)) {
      this.limpiarSesion();
      return;
    }

    this.cargarDesdePayload(payload);
    this.sesion.set(true);
  }

  private aplicarRespuesta(data: AuthResponse): void {
    if (!data || data.requires2fa || !data.token) {
      return;
    }

    // Únicamente se almacena el token JWT. Jamás se guardan datos de usuario en localStorage.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', data.token);
    }
    this.purgarClavesInnecesarias();

    // 1. Extraer claims seguros desde el token firmado
    const payload = decodificarToken(data.token);
    this.cargarDesdePayload(payload);

    // 2. Si la respuesta contiene datos en memoria, sincronizarlos
    if (data.email) {
      this.emailActual.set(data.email);
    }
    if (data.userId != null) {
      this.userIdActual.set(Number(data.userId));
    }
    if (data.role) {
      this.fijarRolConfiable(data.role);
    }
    if (typeof data.isVerified === 'boolean') {
      this.verificadoActual.set(data.isVerified);
    }
    if (typeof data.perfilCompleto === 'boolean') {
      this.perfilCompletoActual.set(data.perfilCompleto);
    }

    this.sesion.set(true);
  }

  private cargarDesdePayload(payload: JwtPayload | null): void {
    if (!payload) {
      return;
    }
    const email = (payload.sub || payload.email || null) as string | null;
    if (email) {
      this.emailActual.set(email);
    }
    if (payload.userId != null) {
      this.userIdActual.set(Number(payload.userId));
    }
    if (payload.role) {
      this.fijarRolConfiable(payload.role as string);
    }
    if (typeof payload.isVerified === 'boolean') {
      this.verificadoActual.set(payload.isVerified);
    }
    if (typeof payload.perfilCompleto === 'boolean') {
      this.perfilCompletoActual.set(payload.perfilCompleto);
    }
  }

  private purgarClavesInnecesarias(): void {
    if (typeof localStorage === 'undefined') return;
    for (const key of SENSITIVE_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }

  private fijarRolConfiable(rol?: string | null): void {
    this.rolActual.set(this.normalizarRol(rol));
  }

  private normalizarRol(rol?: string | null): Rol | null {
    if (!rol) return null;
    return (ROLES_VALIDOS as readonly string[]).includes(rol) ? (rol as Rol) : null;
  }

  private limpiarSesion(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
    }
    this.purgarClavesInnecesarias();
    this.emailActual.set(null);
    this.userIdActual.set(null);
    this.rolActual.set(null);
    this.verificadoActual.set(false);
    this.perfilCompletoActual.set(false);
    this.sesion.set(false);
  }

  private haySesion(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const token = localStorage.getItem('token');
    if (!token) return false;

    const payload = decodificarToken(token);
    if (esTokenExpirado(payload)) {
      this.limpiarSesion();
      return false;
    }
    return true;
  }
}
