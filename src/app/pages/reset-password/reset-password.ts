import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormField,
  form,
  required
} from '@angular/forms/signals';
import { Auth } from '../../services/auth';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormField, RouterLink, TranslatePipe],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);

  token = '';

  datos = signal({
    newPassword: '',
    confirmPassword: ''
  });

  formulario = form(this.datos, (path) => {
    required(path.newPassword);
    required(path.confirmPassword);
  });

  cargando = signal(false);
  exitoso = signal(false);
  tokenInvalido = signal(false);
  contrasenaInvalida = signal(false);
  contrasenasDistintas = signal(false);
  errorServidor = signal(false);

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      this.token = params.get('token') ?? '';
      this.tokenInvalido.set(!this.token);
    });
  }

  restablecer(): void {
    if (
      this.formulario().invalid() ||
      this.cargando() ||
      !this.token
    ) {
      return;
    }

    const { newPassword, confirmPassword } = this.datos();

    this.contrasenaInvalida.set(false);
    this.contrasenasDistintas.set(false);
    this.errorServidor.set(false);

    const patronPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

    if (!patronPassword.test(newPassword)) {
      this.contrasenaInvalida.set(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      this.contrasenasDistintas.set(true);
      return;
    }

    this.cargando.set(true);

    this.auth.resetPassword(this.token, newPassword).subscribe({
      next: () => {
        this.exitoso.set(true);
        this.cargando.set(false);
      },
      error: () => {
        this.errorServidor.set(true);
        this.cargando.set(false);
      }
    });
  }
}
