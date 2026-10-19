
import { Component, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  email,
  minLength,
  submit
} from '@angular/forms/signals';
import { User } from '../../Models/User';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormField],
  templateUrl: './registration-form.html',
  styleUrl: './registration-form.css'
})
export class RegistrationForm {
  datos = signal<User>({
    nombre: '',
    apellido: '',
    email: '',
    password: ''
  });

  registroForm = form(this.datos, path => {
    required(path.nombre);
    required(path.apellido);
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
  });

  terminos = signal(false);
  intentoEnviar = signal(false);
  cargando = signal(false);
  registroExitoso = signal(false);
  errorRegistro = signal(false);

  registrar(event: SubmitEvent): void {
    event.preventDefault();

    this.intentoEnviar.set(true);

    if (!this.terminos() || this.registroForm().invalid()) {
      return;
    }

    this.cargando.set(true);
    this.errorRegistro.set(false);

    submit(this.registroForm, () => {
      return fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.datos())
      })
        .then(respuesta => {
          if (!respuesta.ok) {
            throw new Error();
          }

          this.registroExitoso.set(true);

          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        })
        .catch(() => {
          this.errorRegistro.set(true);
        })
        .finally(() => {
          this.cargando.set(false);
        });
    });
  }
}
