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
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';
import { Auth } from '../../services/auth';

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
  imports: [RouterLink, FormField, TranslatePipe],
  templateUrl: './pago.html',
  styleUrl: './pago.css',
})
export class Pago implements OnDestroy {
  private readonly checkout = inject(CheckoutService);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Auth);

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
  protected readonly datosFacturacion = signal<Facturacion>({
    email: this.auth.emailUsuario() ?? '',
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
    maxLength(datos.cuil, 13);
    validate(datos.cuil, ({ value }) => {
      const cuil = soloDigitosCuil(value());
      return cuil && !CUIL_REGEX.test(cuil) ? { kind: 'cuil' } : undefined;
    });
  });

  protected readonly intentoPagar = signal(false);
  protected readonly errorTarjeta = signal<ErrorTarjeta | null>(null);
  protected readonly estadoPago = signal<EstadoPago | null>(null);
  protected readonly mensajeServidor = signal('');
  protected readonly codigoReserva = signal('');

  private readonly generandoToken = signal(false);
  private readonly procesando = signal(false);

  protected readonly ocupado = computed(() => this.generandoToken() || this.procesando());

  private formularioTarjeta: any = null;
  private tarjetaMontada = false;
  private montoTarjeta = 0;

  constructor() {
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

  private enviar(): void {
    if (this.ocupado()) {
      return;
    }
    this.intentoPagar.set(true);
    this.errorTarjeta.set(null);
    this.estadoPago.set(null);

    submit(this.facturacion, async () => {
      if (!this.tarjetaMontada || !this.formularioTarjeta) {
        this.errorTarjeta.set('tarjetaCargando');
        return undefined;
      }

      this.generandoToken.set(true);

      try {
        const respuestaToken = (await this.formularioTarjeta.createCardToken()) as
          | { id?: string; token?: string; [key: string]: unknown }
          | string
          | undefined;

        const tokenId =
          typeof respuestaToken === 'string'
            ? respuestaToken
            : (respuestaToken?.id ||
               respuestaToken?.token ||
               (this.formularioTarjeta.getCardFormData?.() as { token?: string } | undefined)?.token);

        if (!tokenId) {
          console.warn('[MercadoPago] No se pudo generar token de tarjeta:', respuestaToken);
          this.errorTarjeta.set('tarjetaInvalida');
          return undefined;
        }
        this.pagar(this.armarPago(tokenId));
      } catch (err) {
        console.error('Error al tokenizar tarjeta:', err);
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
          const msg = error.error?.message || (typeof error.error === 'string' ? error.error : '');
          this.mensajeServidor.set(msg);
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
      this.estadoPago.set('enProceso');
    }
  }

  private armarPago(token: string): PagoRequest {
    const datosTarjeta = this.formularioTarjeta?.getCardFormData() ?? {};
    const facturacion = this.datosFacturacion();

    const cuilLimpio = soloDigitosCuil(facturacion.cuil);
    const primerPasajeroDoc = this.pasajeros()[0]?.documento || '';

    return {
      token,
      installments: Number(datosTarjeta.installments) || 1,
      paymentMethodId: datosTarjeta.paymentMethodId || 'visa',
      issuerId: datosTarjeta.issuerId || null,
      payerEmail: facturacion.email.trim(),
      payerDocType: (datosTarjeta.identificationType || 'DNI').trim(),
      payerDocNumber: (datosTarjeta.identificationNumber || cuilLimpio || primerPasajeroDoc || '11111111').trim(),
      cuil: cuilLimpio,
      situacionFiscal: facturacion.situacionFiscal,
    };
  }

  private montarFormularioTarjeta(monto: number): void {
    if (this.formularioTarjeta && monto === this.montoTarjeta) {
      return;
    }

    if (typeof MercadoPago === 'undefined') {
      setTimeout(() => {
        if (typeof MercadoPago !== 'undefined' && this.formularioPago() && this.publicKey()) {
          this.montarFormularioTarjeta(this.total());
        }
      }, 500);
      return;
    }

    this.desmontarFormularioTarjeta();
    this.montoTarjeta = monto;

    const mercadoPago = new MercadoPago(this.publicKey(), { locale: 'es-AR' });

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
