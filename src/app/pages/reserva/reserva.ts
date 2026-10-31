import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormField,
  applyEach,
  email,
  form,
  maxLength,
  pattern,
  required,
  submit,
  validate
} from '@angular/forms/signals';
import { TIPOS_DOCUMENTO } from '../../Models/Perfil';
import {
  CheckoutService,
  ErrorCarrito,
  PasajeroFormulario,
  etiquetaEquipaje
} from '../../services/checkout-service';

// Qué salió mal al cargar la página. El texto de cada caso está en el html.
type ErrorCarga = ErrorCarrito | 'servidor';

// Letras y espacios, con al menos una letra (así "   " no pasa).
const SOLO_LETRAS = /^\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]+(\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*\s*$/;
const DNI_REGEX = /^\d{7,8}$/;
const PASAPORTE_REGEX = /^[A-Z0-9]{6,20}$/;

function normalizarDocumento(documento: string): string {
  return documento.replace(/[\s.\-]/g, '').toUpperCase();
}

// Fecha de hoy en hora local (toISOString usa UTC y a la noche ya da el día siguiente).
function hoyLocal(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Paso 3 del checkout: datos de los pasajeros, equipaje y asistencia.
// Al continuar, navega a /checkoutReserva/pago. Los datos quedan en CheckoutService.
@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [RouterLink, FormField],
  templateUrl: './reserva.html',
  styleUrl: './reserva.css',
})
export class Reserva implements OnInit {
  private readonly checkout = inject(CheckoutService);
  private readonly router = inject(Router);

  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly etiquetaEquipaje = etiquetaEquipaje;

  protected readonly vuelo = this.checkout.vuelo;
  protected readonly equipajes = this.checkout.equipajes;
  protected readonly asistencias = this.checkout.asistencias;

  // Modelo del formulario: un elemento por pasajero. Vive en el servicio para que lo use la página de pago.
  protected readonly pasajeros = this.checkout.pasajeros;

  // Resumen de precios (se calcula en el servicio, lo usan las dos páginas).
  protected readonly tarifas = this.checkout.tarifas;
  protected readonly tarifaBase = this.checkout.tarifaBase;
  protected readonly lineasExtras = this.checkout.lineasExtras;
  protected readonly impuestos = this.checkout.impuestos;
  protected readonly servicio = this.checkout.servicio;
  protected readonly total = this.checkout.total;
  protected readonly asientosTexto = this.checkout.asientosTexto;

  // Formulario de signals con las validaciones de cada pasajero.
  // Los mensajes de error se arman en el html según el `kind` de cada error.
  protected readonly formulario = form(this.pasajeros, (pasajeros) => {
    applyEach(pasajeros, (pasajero) => {
      required(pasajero.nombre);
      pattern(pasajero.nombre, SOLO_LETRAS);

      required(pasajero.apellido);
      pattern(pasajero.apellido, SOLO_LETRAS);

      required(pasajero.documento);
      // [formField] pone el atributo maxlength en el input a partir de esta regla.
      maxLength(pasajero.documento, 20);
      validate(pasajero.documento, ({ value, valueOf }) => {
        const documento = normalizarDocumento(value());
        if (!documento) {
          return undefined; // de esto se encarga required
        }

        const tipo = valueOf(pasajero.tipoDocumento);
        if (tipo === 'DNI' && !DNI_REGEX.test(documento)) {
          return { kind: 'dni' };
        }
        if (tipo === 'PASAPORTE' && !PASAPORTE_REGEX.test(documento)) {
          return { kind: 'pasaporte' };
        }
        return undefined;
      });

      required(pasajero.fechaNacimiento);
      validate(pasajero.fechaNacimiento, ({ value }) =>
        value() && value() >= hoyLocal() ? { kind: 'fechaFutura' } : undefined
      );

      // Opcional: email() no marca error si el campo está vacío.
      email(pasajero.email);
    });
  });

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<ErrorCarga | null>(null);

  // Mensaje que manda el backend, si lo hay. Si viene vacío, el html muestra uno propio.
  protected readonly mensajeServidor = signal('');

  // Se pone en true al tocar "Continuar al pago": recién ahí se muestra el aviso general de errores.
  protected readonly intentoContinuar = signal(false);

  ngOnInit(): void {
    // Si vuelve desde la página de pago, tiene que confirmar los pasajeros de nuevo para seguir.
    this.checkout.pasajerosListos.set(false);
    this.cargarDatos();
  }

  protected cargarDatos(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.mensajeServidor.set('');

    this.checkout.cargar().subscribe({
      next: (errorCarrito) => this.errorCarga.set(errorCarrito),
      error: (error: HttpErrorResponse) => {
        this.mensajeServidor.set(error.error?.message ?? '');
        this.errorCarga.set('servidor');
      }
    }).add(() => this.cargando.set(false));
  }

  // submit() marca todos los campos como tocados (así se ven los errores)
  // y solo ejecuta la acción si el formulario es válido.
  protected continuarAlPago(): void {
    this.intentoContinuar.set(true);
    submit(this.formulario, async () => {
      this.checkout.pasajerosListos.set(true);
      await this.router.navigate(['/checkoutReserva/pago']);
      return undefined;
    });
  }

  protected alternarEquipaje(indice: number, equipajeId: number, marcado: boolean): void {
    this.actualizarPasajero(indice, (pasajero) => {
      const sinEste = pasajero.equipajeIds.filter((id) => id !== equipajeId);
      return { ...pasajero, equipajeIds: marcado ? [...sinEste, equipajeId] : sinEste };
    });
  }

  // "Sin equipaje" no se desmarca a mano: se desmarca solo cuando se elige algún equipaje.
  protected elegirSinEquipaje(indice: number, casilla: HTMLInputElement): void {
    casilla.checked = true;
    this.actualizarPasajero(indice, (pasajero) => ({ ...pasajero, equipajeIds: [] }));
  }

  // asistenciaId es string porque Signal Forms no admite null: '' = sin asistencia.
  protected elegirAsistencia(indice: number, asistenciaId: number | null): void {
    this.actualizarPasajero(indice, (pasajero) => ({
      ...pasajero,
      asistenciaId: asistenciaId === null ? '' : String(asistenciaId),
    }));
  }

  protected formatearPrecio(valor: number): string {
    return `$${valor.toLocaleString('es-AR')}`;
  }

  protected formatearPorcentaje(tasa: number): string {
    return `${(tasa * 100).toLocaleString('es-AR')}%`;
  }

  protected formatearFecha(fecha: string): string {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private actualizarPasajero(
    indice: number,
    cambio: (pasajero: PasajeroFormulario) => PasajeroFormulario
  ): void {
    this.pasajeros.update((pasajeros) =>
      pasajeros.map((pasajero, i) => (i === indice ? cambio(pasajero) : pasajero))
    );
  }
}