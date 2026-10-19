
import { Injectable, signal } from '@angular/core';

export interface LoginResponse {
  token: string;
  email: string;
  userId: string;
  perfilCompleto?: boolean;
  requires2fa?: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  usuarioAutenticado = signal(false);

  async iniciarSesion(email: string, password: string): Promise<LoginResponse> {
    const respuesta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(data.message || 'Credenciales incorrectas.');
    }

    return data as LoginResponse;
  }

  async verificarCodigo(email: string, code: string): Promise<LoginResponse> {
    const respuesta = await fetch('/api/auth/verify-2fa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, code })
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(data.message || 'El código es incorrecto.');
    }

    return data as LoginResponse;
  }

  guardarSesion(data: LoginResponse): void {
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', data.email);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem(
      'perfilCompleto',
      String(data.perfilCompleto ?? false)
    );

    this.usuarioAutenticado.set(true);
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    localStorage.removeItem('perfilCompleto');

    this.usuarioAutenticado.set(false);
  }
}
