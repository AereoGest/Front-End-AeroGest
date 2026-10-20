import { Component, computed, signal } from '@angular/core';
import {
  FieldTree,
  FormField,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { DatosPerfil, GENEROS, Perfil, TIPOS_DOCUMENTO } from '../../Models/Perfil';
import { Auth } from '../../services/auth';

const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/;
const SOLO_DIGITOS = /^\d+$/;

const DATOS_VACIOS: DatosPerfil = {
  nombre: '',
  apellido: '',
  telefono: '',
  identificador: '',
  numeroIdentificador: '',
  sexo: '',
  fechaNacimiento: '',
};

@Component({
  selector: 'app-ver-perfil',
  imports: [FormField],
  templateUrl: './verPerfil.html',
  styleUrl: './verPerfil.css',
})
export class VerPerfil {
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly generos = GENEROS;
  protected readonly fechaMaxima = new Date().toISOString().split('T')[0];

  protected readonly perfil = signal<Perfil | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');
  protected readonly perfilIncompleto = computed(() => this.perfil()?.role === 'ROLE_INCOMPLETO');
  protected readonly cuentaSinVerificar = computed(() => this.perfil()?.isVerified === false);

  private readonly datos = signal<DatosPerfil>({ ...DATOS_VACIOS });

  protected readonly perfilForm = form(this.datos, (campo) => {
    required(campo.nombre);
    pattern(campo.nombre, SOLO_LETRAS);
    required(campo.apellido);
    pattern(campo.apellido, SOLO_LETRAS);
    required(campo.telefono);
    pattern(campo.telefono, SOLO_DIGITOS);
    maxLength(campo.telefono, 15);
    required(campo.identificador);
    required(campo.numeroIdentificador);
    pattern(campo.numeroIdentificador, SOLO_DIGITOS);
    minLength(campo.numeroIdentificador, 7);
    maxLength(campo.numeroIdentificador, 8);
    required(campo.sexo);
    required(campo.fechaNacimiento);
    validate(campo.fechaNacimiento, ({ value }) =>
      value() && value() >= this.fechaMaxima ? { kind: 'fechaFutura' } : null,
    );
  });

  constructor(private auth: Auth) {
    this.cargarPerfil();
  }

  protected errorVisible(campo: FieldTree<string>): boolean {
    const estado = campo();
    return estado.touched() && estado.invalid();
  }

  protected soloDigitos(campo: 'telefono' | 'numeroIdentificador', evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '');
    if (limpio !== input.value) {
      this.datos.update((datos) => ({ ...datos, [campo]: limpio }));
    }
  }

  protected cargarPerfil(): void {
    this.cargando.set(true);
    this.auth.obtenerPerfil().subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.datos.set({
          nombre: perfil.nombre ?? '',
          apellido: perfil.apellido ?? '',
          telefono: perfil.telefono ?? '',
          identificador: perfil.identificador ?? '',
          numeroIdentificador: perfil.numeroIdentificador ?? '',
          sexo: perfil.sexo ?? '',
          fechaNacimiento: perfil.fechaNacimiento ?? '',
        });
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(error.error?.message || 'No se pudo cargar el perfil.');
      }
    }).add(() => this.cargando.set(false));
  }

  protected guardar(evento: SubmitEvent): void {
    evento.preventDefault();
    this.mensajeExito.set('');
    this.mensajeError.set('');

    submit(this.perfilForm, async () => {
      this.guardando.set(true);
      await new Promise<void>((resolve) => {
        this.auth
          .actualizarPerfil(this.datos())
          .subscribe({
            next: () => {
              this.mensajeExito.set('Perfil actualizado correctamente.');
              this.cargarPerfil();
            },
            error: (error: HttpErrorResponse) => {
              this.mensajeError.set(error.error?.message || 'No se pudo actualizar el perfil.');
            }
          })
          .add(() => {
            this.guardando.set(false);
            resolve();
          });
      });
      return null as any;
    });
  }

  protected toggleDosFactores(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.auth.toggle2fa().subscribe({
      next: (mensaje) => {
        this.mensajeExito.set(mensaje);
        this.cargarPerfil();
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(error.error?.message || 'No se pudo cambiar el 2FA.');
      }
    });
  }
}
