
import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormField,
  form,
  required
} from '@angular/forms/signals';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword {
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

  constructor(
    private auth: Auth,
    private route: ActivatedRoute
  ) {
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
      error: (error) => {
        console.error(
          'Error al restablecer la contraseña:',
          error
        );

        this.errorServidor.set(true);
        this.cargando.set(false);
      }
    });
  }
}
