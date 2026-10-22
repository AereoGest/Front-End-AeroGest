
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormField,
  form,
  required,
  email
} from '@angular/forms/signals';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  constructor(private auth: Auth) {}

  datos = signal({
    email: ''
  });

  formulario = form(this.datos, (path) => {
    required(path.email);
    email(path.email);
  });

  cargando = signal(false);
  enviado = signal(false);
  errorServidor = signal(false);

  enviarEnlace(): void {
    if (this.formulario().invalid() || this.cargando()) {
      return;
    }

    this.cargando.set(true);
    this.enviado.set(false);
    this.errorServidor.set(false);

    this.auth.forgotPassword(this.datos().email.trim()).subscribe({
      next: () => {
        this.enviado.set(true);
        this.cargando.set(false);
      },
      error: (error) => {
       
       console.error('Error al recuperar contraseña:', error);
          console.error('Código HTTP:', error.status);
                 console.error('Respuesta del backend:', error.error);

this.errorServidor.set(true);
  this.cargando.set(false);
}
      
    });
  }
}
