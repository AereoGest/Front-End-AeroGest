
import { Component, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  email
} from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { Router, RouterLink } from '@angular/router';
import { Login } from '../../Models/Login';
import { AuthResponse } from '../../Models/Perfil';

interface TwoFactorData {
  code: string;
}

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormField, RouterLink],
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

  iniciarSesion(event: SubmitEvent): void {
    event.preventDefault();
    this.intentoEnviar.set(true);

    if (this.loginForm().invalid()) {
      return;
    }

    this.cargando.set(true);

    this.auth.iniciarSesion(this.datos()).subscribe({
      next: (data) => {
        if (data.requires2fa) {
          this.email2FA.set(data.email || this.datos().email);
          this.paso2FA.set(true);
          alert('Se envió un código a tu email.');
          return;
        }

        this.completarLogin(data);
      },
      error: (error: HttpErrorResponse) => {
        alert(error.error?.message || 'Error al iniciar sesión.');
      }
    }).add(() => this.cargando.set(false));
  }

  verificarCodigo(event: SubmitEvent): void {
    event.preventDefault();
    this.intentoEnviar2FA.set(true);

    if (this.form2FA().invalid()) {
      return;
    }

    this.cargando.set(true);

    this.auth.verificarCodigo(this.email2FA(), this.datos2FA().code).subscribe({
      next: (data) => this.completarLogin(data),
      error: (error: HttpErrorResponse) => {
        alert(error.error?.message || 'No se pudo verificar el código.');
      }
    }).add(() => this.cargando.set(false));
  }

  private completarLogin(data: AuthResponse): void {
    this.auth.guardarSesion(data);

    if (!data.perfilCompleto) {
      alert('Completá tu perfil para continuar.');
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
