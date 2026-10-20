
import { Component, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  email,
  minLength,
  pattern,
  submit
} from '@angular/forms/signals';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { User } from '../../Models/User';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/;

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormField],
  templateUrl: './registration-form.html',
  styleUrl: './registration-form.css'
})
export class RegistrationForm {
  datos = signal<User>({
    email: '',
    password: ''
  });

  registroForm = form(this.datos, path => {
    required(path.email);
    email(path.email);
    required(path.password);
    minLength(path.password, 8);
    pattern(path.password, PASSWORD_REGEX);
  });

  terminos = signal(false);
  intentoEnviar = signal(false);
  cargando = signal(false);
  registroExitoso = signal(false);
  errorRegistro = signal(false);
  mensajeError = signal('');

  constructor(private http: HttpClient) {}

  registrar(event: SubmitEvent): void {
    event.preventDefault();

    this.intentoEnviar.set(true);

    if (!this.terminos() || this.registroForm().invalid()) {
      return;
    }

    this.cargando.set(true);
    this.errorRegistro.set(false);
    this.mensajeError.set('');

    submit(this.registroForm, async () => {
      await new Promise<void>((resolve) => {
        this.http
          .post('/api/auth/register', this.datos())
          .subscribe({
            next: () => {
              this.registroExitoso.set(true);
              setTimeout(() => {
                window.location.href = '/';
              }, 3000);
              resolve();
            },
            error: (error: HttpErrorResponse) => {
              this.errorRegistro.set(true);
              this.mensajeError.set(
                error.error?.message || 'No se pudo crear la cuenta. Intentá nuevamente.'
              );
              resolve();
            }
          })
          .add(() => this.cargando.set(false));
      });
      return null as any;
    });
  }
}
