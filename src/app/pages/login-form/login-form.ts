
import { Component, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  email
} from '@angular/forms/signals';
import { Auth, LoginResponse } from '../../services/auth';
import { Router } from '@angular/router';
import { Login } from '../../Models/Login';

interface TwoFactorData {
  code: string;
}

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormField],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css'
})
export class LoginForm {

  constructor(
    private auth: Auth,
    private router: Router
  ) {}

  datos = signal<Login>({
    email: '',
    password: ''
  });

  loginForm = form(this.datos, path => {
    required(path.email);
    email(path.email);
    required(path.password);
  });

  datos2FA = signal<TwoFactorData>({
    code: ''
  });

  form2FA = form(this.datos2FA, path => {
    required(path.code);
  });

  paso2FA = signal(false);
  email2FA = signal('');
  intentoEnviar = signal(false);
  intentoEnviar2FA = signal(false);
  cargando = signal(false);

  async iniciarSesion(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.intentoEnviar.set(true);

    if (this.loginForm().invalid()) {
      return;
    }

    this.cargando.set(true);

    try {
      const data = await this.auth.iniciarSesion(
        this.datos().email,
        this.datos().password
      );

      if (data.requires2fa) {
        this.email2FA.set(data.email || this.datos().email);
        this.paso2FA.set(true);
        alert('Se envió un código a tu email.');
        return;
      }

      this.completarLogin(data);

    } catch (error: unknown) {
      alert(
        error instanceof Error
          ? error.message
          : 'Error al iniciar sesión.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  async verificarCodigo(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.intentoEnviar2FA.set(true);

    if (this.form2FA().invalid()) {
      return;
    }

    this.cargando.set(true);

    try {
      const data = await this.auth.verificarCodigo(
        this.email2FA(),
        this.datos2FA().code
      );

      this.completarLogin(data);

    } catch (error: unknown) {
      alert(
        error instanceof Error
          ? error.message
          : 'No se pudo verificar el código.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  private completarLogin(data: LoginResponse): void {
    this.auth.guardarSesion(data);

    if (!data.perfilCompleto) {
      alert('Completá tu perfil para continuar.');
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
