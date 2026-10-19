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
import { DatosPerfil, GENEROS, Perfil, TIPOS_DOCUMENTO } from '../../Models/Perfil';

const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]+$/;
const SOLO_DIGITOS = /^\d+$/;

const DATOS_VACIOS: DatosPerfil = {
  nombre: '',
  apellido: '',
  telefono: '',
  identificador: TIPOS_DOCUMENTO[0].valor,
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

  /** Lo va a completar el servicio de perfil cuando exista; mientras tanto la vista arranca vacía. */
  protected readonly perfil = signal<Perfil | null>(null);
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

  protected errorVisible(campo: FieldTree<string>): boolean {
    const estado = campo();
    return estado.touched() && estado.invalid();
  }

  /** Descarta lo que no sea dígito mientras se escribe, como hacía la versión anterior. */
  protected soloDigitos(campo: 'telefono' | 'numeroIdentificador', evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '');
    if (limpio !== input.value) {
      this.datos.update((datos) => ({ ...datos, [campo]: limpio }));
    }
  }

  protected guardar(evento: SubmitEvent): void {
    evento.preventDefault();
    // `submit` marca todos los campos como tocados y solo ejecuta la acción si el formulario es válido.
    submit(this.perfilForm, async () => {
      // TODO: enviar `this.datos()` con el servicio de perfil cuando exista.
    });
  }
}
