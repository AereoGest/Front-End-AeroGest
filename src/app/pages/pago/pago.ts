import {
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormField,
  email,
  form,
  maxLength,
  required,
  submit,
  validate
} from '@angular/forms/signals';
import { PagoRequest, PagoResponse, SituacionFiscal } from '../../Models/Pago';
import { CheckoutService } from '../../services/checkout-service';

// Lo carga el script del SDK de Mercado Pago en index.html.
declare const MercadoPago: any;

// Modelo del formulario de facturación.
interface Facturacion {
  email: string;
  telefono: string;
  cuil: string;
  situacionFiscal: SituacionFiscal;
}

// Problemas con la tarjeta o el SDK. El texto de cada caso está en el html.
type ErrorTarjeta = 'sdkNoCargo' | 'tarjetaCargando' | 'tarjetaInvalida';

// Resultado del pago en el back. El texto de cada caso está en el html.
type EstadoPago = 'rechazado' | 'enProceso' | 'error';

const SITUACIONES_FISCALES: SituacionFiscal[] = [
  'Consumidor Final',
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
];

const TELEFONO_REGEX = /^\d{10,11}$/;
const CUIL_REGEX = /^\d{11}$/;

function soloDigitosTelefono(telefono: string): string {
  return telefono.replace(/[\s\-()+]/g, '');
}

function soloDigitosCuil(cuil: string): string {
  return cuil.replace(/[-\s]/g, '');
}

// Paso 4 del checkout (/checkoutReserva/pago): facturación, tarjeta y pago.
// Los pasajeros, el vuelo y el total vienen de CheckoutService (los cargó la página de pasajeros).
// El guard checkoutPagoGuard no deja entrar si los pasajeros no se completaron.
@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [RouterLink, FormField],
  templateUrl: './pago.html',
  styleUrl: './pago.css',
})
export class Pago implements OnDestroy {
  private readonly checkout = inject(CheckoutService);

  // <form #formularioPago> del html, donde se monta el SDK de Mercado Pago.
  private readonly formularioPago = viewChild<ElementRef<HTMLFormElement>>('formularioPago');
  // Ventana de confirmación (<dialog #confirmacion> del html).
  private readonly confirmacion = viewChild.required<ElementRef<HTMLDialogElement>>('confirmacion');

  protected readonly situacionesFiscales = SITUACIONES_FISCALES;

  protected readonly vuelo = this.checkout.vuelo;
  protected readonly pasajeros = this.checkout.pasajeros;
  private readonly publicKey = this.checkout.publicKey;

  // Resumen de precios (se calcula en el servicio, lo usan las dos páginas).
  protected readonly tarifas = this.checkout.tarifas;
  protected readonly tarifaBase = this.checkout.tarifaBase;
  protected readonly lineasExtras = this.checkout.lineasExtras;
  protected readonly impuestos = this.checkout.impuestos;
  protected readonly servicio = this.checkout.servicio;
  protected readonly total = this.checkout.total;
  protected readonly asientosTexto = this.checkout.asientosTexto;

  // Formulario de facturación con signals.
  // Los datos de la tarjeta no van acá: esos inputs los maneja el SDK de Mercado Pago.
  protected readonly datosFacturacion = signal<Facturacion>({
    email: '',
    telefono: '',
    cuil: '',
    situacionFiscal: 'Consumidor Final',
  });

  // Los mensajes de error se arman en el html según el `kind` de cada error.
  protected readonly facturacion = form(this.datosFacturacion, (datos) => {
    required(datos.email);
    email(datos.email);

    required(datos.telefono);
    validate(datos.telefono, ({ value }) => {
      const telefono = soloDigitosTelefono(value());
      return telefono && !TELEFONO_REGEX.test(telefono) ? { kind: 'telefono' } : undefined;
    });

    required(datos.cuil);
    // [formField] pone el atributo maxlength en el input a partir de esta regla.
    maxLength(datos.cuil, 13);
    validate(datos.cuil, ({ value }) => {
      const cuil = soloDigitosCuil(value());
      return cuil && !CUIL_REGEX.test(cuil) ? { kind: 'cuil' } : undefined;
    });
  });

  // Se pone en true al tocar "Pagar": recién ahí se muestra el aviso general de errores.
  protected readonly intentoPagar = signal(false);

  protected readonly errorTarjeta = signal<ErrorTarjeta | null>(null);

  // Resultado del último intento de pago contra el back.
  protected readonly estadoPago = signal<EstadoPago | null>(null);
  // Mensaje que manda el back, si lo hay. Si viene vacío, el html muestra uno propio.
  protected readonly mensajeServidor = signal('');
  protected readonly codigoReserva = signal('');

  private readonly generandoToken = signal(false);
  private readonly procesando = signal(false);

  // Evita doble click entre que se genera el token y termina el pago
  protected readonly ocupado = computed(() => this.generandoToken() || this.procesando());

  private formularioTarjeta: any = null;
  private tarjetaMontada = false;
  private montoTarjeta = 0;

  constructor() {
    // El SDK necesita los inputs en el DOM, por eso se monta después de renderizar.
    // Se vuelve a montar cuando cambia el total, porque las cuotas dependen del monto.
    afterRenderEffect(() => {
      if (this.formularioPago() && this.publicKey()) {
        this.montarFormularioTarjeta(this.total());
      }
    });
  }

  ngOnDestroy(): void {
    this.desmontarFormularioTarjeta();
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

  // Lo llama el SDK de Mercado Pago al enviar el formulario (ver callbacks.onSubmit).
  // submit() marca todos los campos de facturación como tocados (así se ven los errores)
  // y solo sigue si son válidos.
  private enviar(): void {
    this.intentoPagar.set(true);
    this.errorTarjeta.set(null);
    this.estadoPago.set(null);

    submit(this.facturacion, async () => {
      if (!this.tarjetaMontada) {
        this.errorTarjeta.set('tarjetaCargando');
        return undefined;
      }

      this.generandoToken.set(true);

      // Primero se valida la tarjeta generando el token, así no se crea la reserva si los datos están mal.
      try {
        const token = (await this.formularioTarjeta.createCardToken()) as { id: string };
        this.pagar(this.armarPago(token.id));
      } catch {
        this.errorTarjeta.set('tarjetaInvalida');
      } finally {
        this.generandoToken.set(false);
      }
      return undefined;
    });
  }

  private pagar(pago: PagoRequest): void {
    this.mensajeServidor.set('');
    this.procesando.set(true);

    this.checkout.pagar(pago).subscribe({
      next: (respuesta) => this.procesarRespuesta(respuesta),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          this.mensajeServidor.set(error.error?.message ?? '');
        }
        this.estadoPago.set('error');
      }
    }).add(() => this.procesando.set(false));
  }

  private procesarRespuesta(respuesta: PagoResponse): void {
    this.codigoReserva.set(respuesta.codigoReserva);

    if (respuesta.status === 'approved') {
      this.confirmacion().nativeElement.showModal();
    } else if (respuesta.status === 'rejected') {
      this.estadoPago.set('rechazado');
    } else {
      // in_process / pending: la reserva queda PROCESANDO hasta que Mercado Pago confirme el pago.
      this.estadoPago.set('enProceso');
    }
  }

  private armarPago(token: string): PagoRequest {
    const datosTarjeta = this.formularioTarjeta.getCardFormData();
    const facturacion = this.datosFacturacion();

    return {
      token,
      installments: Number(datosTarjeta.installments) || 1,
      paymentMethodId: datosTarjeta.paymentMethodId,
      issuerId: datosTarjeta.issuerId || null,
      payerEmail: facturacion.email.trim(),
      payerDocType: datosTarjeta.identificationType,
      payerDocNumber: datosTarjeta.identificationNumber,
      cuil: soloDigitosCuil(facturacion.cuil),
      situacionFiscal: facturacion.situacionFiscal,
    };
  }

  private montarFormularioTarjeta(monto: number): void {
    if (this.formularioTarjeta && monto === this.montoTarjeta) {
      return;
    }

    this.desmontarFormularioTarjeta();
    this.montoTarjeta = monto;

    const mercadoPago = new MercadoPago(this.publicKey(), { locale: 'es-AR' });

    // Los ids tienen que coincidir con los del html.
    this.formularioTarjeta = mercadoPago.cardForm({
      amount: String(monto),
      autoMount: true,
      form: {
        id: 'mp-card-form',
        cardNumber: { id: 'cardNumber' },
        cardholderName: { id: 'cardholderName' },
        expirationDate: { id: 'expirationDate' },
        securityCode: { id: 'securityCode' },
        installments: { id: 'installments' },
        identificationType: { id: 'docType' },
        identificationNumber: { id: 'docNumber' },
        issuer: { id: 'issuer' },
      },
      callbacks: {
        onFormMounted: (error: unknown) => {
          this.tarjetaMontada = !error;
          if (error) {
            this.errorTarjeta.set('sdkNoCargo');
          }
        },
        onSubmit: (event: Event) => {
          event.preventDefault();
          this.enviar();
        },
      },
    });
  }

  private desmontarFormularioTarjeta(): void {
    if (this.formularioTarjeta) {
      this.formularioTarjeta.unmount();
      this.formularioTarjeta = null;
      this.tarjetaMontada = false;
    }
  }
}