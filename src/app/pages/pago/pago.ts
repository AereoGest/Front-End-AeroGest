import {
  Component,
  ElementRef,
  OnDestroy,
  afterRenderEffect,
  computed,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { PagoRequest, SituacionFiscal } from '../../Models/Pago';

// Lo carga el script del SDK de Mercado Pago en index.html.
declare const MercadoPago: any;

const SITUACIONES_FISCALES: SituacionFiscal[] = [
  'Consumidor Final',
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-pago',
  standalone: true,
  templateUrl: './pago.html',
  styleUrl: './pago.css',
})
export class Pago implements OnDestroy {
  // <form #formularioPago> del html, donde se monta el SDK de Mercado Pago.
  private readonly formularioPago = viewChild<ElementRef<HTMLFormElement>>('formularioPago');

  // Vienen de reserva
  readonly total = input.required<number>();
  readonly publicKey = input.required<string>();
  readonly procesando = input(false);
  readonly errorPago = input('');
  // Validación de reserva (pasajeros). Se corre antes de generar el token.
  readonly validarExtra = input<() => string | null>(() => null);

  // Se emite con el pago listo para mandar al back
  readonly pagar = output<PagoRequest>();

  protected readonly situacionesFiscales = SITUACIONES_FISCALES;

  protected readonly email = signal('');
  protected readonly telefono = signal('');
  protected readonly cuil = signal('');
  protected readonly situacionFiscal = signal<SituacionFiscal>('Consumidor Final');

  private readonly errorLocal = signal('');
  private readonly generandoToken = signal(false);

  // Error propio (validación, tarjeta) o el que manda reserva (respuesta del back)
  protected readonly mensajeError = computed(() => this.errorLocal() || this.errorPago());
  // Evita doble click entre que se genera el token y reserva empieza a procesar
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

  // Lo llama el SDK de Mercado Pago al enviar el formulario (ver callbacks.onSubmit).
  private enviar(): void {
    this.errorLocal.set('');

    const mensajeError = this.validarFacturacion() ?? this.validarExtra()();
    if (mensajeError) {
      this.errorLocal.set(mensajeError);
      return;
    }

    if (!this.tarjetaMontada) {
      this.errorLocal.set('El formulario de pago se está cargando, intentá de nuevo.');
      return;
    }

    this.generandoToken.set(true);

    // Primero se valida la tarjeta generando el token, así no se crea la reserva si los datos están mal.
    (this.formularioTarjeta.createCardToken() as Promise<{ id: string }>)
      .then((token) => this.pagar.emit(this.armarPago(token.id)))
      .catch(() =>
        this.errorLocal.set('No se pudo validar la tarjeta. Revisá los datos e intentá nuevamente.')
      )
      .finally(() => this.generandoToken.set(false));
  }

  private validarFacturacion(): string | null {
    if (!EMAIL_REGEX.test(this.email().trim())) {
      return 'Ingresá un email válido.';
    }
    if (!/^\d{10,11}$/.test(this.telefono().replace(/[\s\-()+]/g, ''))) {
      return 'El teléfono debe tener 10 u 11 dígitos (ej: 02234567890 o +54 223 456-7890).';
    }
    if (!/^\d{11}$/.test(this.cuil().replace(/[-\s]/g, ''))) {
      return 'El CUIL/CUIT debe tener 11 dígitos (ej: 20-35123456-1).';
    }
    return null;
  }

  private armarPago(token: string): PagoRequest {
    const datosTarjeta = this.formularioTarjeta.getCardFormData();

    return {
      token,
      installments: Number(datosTarjeta.installments) || 1,
      paymentMethodId: datosTarjeta.paymentMethodId,
      issuerId: datosTarjeta.issuerId || null,
      payerEmail: this.email().trim(),
      payerDocType: datosTarjeta.identificationType,
      payerDocNumber: datosTarjeta.identificationNumber,
      cuil: this.cuil().replace(/[-\s]/g, ''),
      situacionFiscal: this.situacionFiscal(),
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
            this.errorLocal.set('No se pudo cargar el formulario de pago. Recargá la página.');
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