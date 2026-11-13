import { Component, inject, signal } from '@angular/core';
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
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

interface TwoFactorData {
  code: string;
}

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormField, RouterLink, TranslatePipe],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css'
})
export class LoginForm {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

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
  totpRequerido = signal(false);
  emailRequerido = signal(false);
  intentoEnviar = signal(false);
  intentoEnviar2FA = signal(false);
  cargando = signal(false);
  mensajeError = signal('');
  mensajeInfo = signal('');
  mostrarReenviarVerificacion = signal(false);
  reenviando = signal(false);

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
          this.totpRequerido.set(!!data.totpEnabled);
          this.emailRequerido.set(!!data.twoFactorEnabled);
          this.paso2FA.set(true);
          return;
        }

        this.completarLogin(data);
      },
      error: (error: HttpErrorResponse) => {
        const msg = error.error?.message || this.i18n.t('common.error');
        this.mensajeError.set(msg);
        if (msg.toLowerCase().includes('verific') || error.status === 403) {
          this.mostrarReenviarVerificacion.set(true);
        }
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
        this.mensajeError.set(error.error?.message || this.i18n.t('common.error'));
      }
    }).add(() => this.cargando.set(false));
  }

  reenviarVerificacion(): void {
    const email = this.datos().email || this.email2FA();
    if (!email) {
      this.mensajeError.set(this.i18n.t('auth.emailRequired'));
      return;
    }
    this.reenviando.set(true);
    this.mensajeInfo.set('');
    this.auth.reenviarVerificacion(email).subscribe({
      next: (res) => {
        this.mensajeInfo.set(res.message || this.i18n.t('auth.registerSuccess'));
        this.mensajeError.set('');
      },
      error: (err: HttpErrorResponse) => {
        this.mensajeError.set(err.error?.message || this.i18n.t('common.error'));
      }
    }).add(() => this.reenviando.set(false));
  }

  private completarLogin(data: AuthResponse): void {
    this.auth.guardarSesion(data);

    if (!data.perfilCompleto) {
      this.router.navigate(['/perfil']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
