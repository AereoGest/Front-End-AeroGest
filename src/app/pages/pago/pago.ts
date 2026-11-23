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

// ---------- Validaciones de la tarjeta ----------
// Estos inputs los maneja el SDK de Mercado Pago, por eso no usan formField.

interface DatosTarjeta {
  numero: string;
  titular: string;
  vencimiento: string;
  cvv: string;
  tipoDoc: string;
  numeroDoc: string;
}

type CampoTarjeta = 'numero' | 'titular' | 'vencimiento' | 'cvv' | 'numeroDoc';

const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ ]+$/;
const NUMERO_TARJETA_REGEX = /^\d{13,16}$/;
const VENCIMIENTO_REGEX = /^(0[1-9]|1[0-2])\/(\d{2})$/;
const CVV_REGEX = /^\d{3,4}$/;
const DNI_REGEX = /^\d{7,8}$/;
const DOC_OTRO_REGEX = /^[a-zA-Z0-9]{5,20}$/;

// Algoritmo de Luhn: detecta números de tarjeta mal tipeados.
function pasaLuhn(numero: string): boolean {
  let suma = 0;
  let duplicar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = Number(numero[i]);
    if (duplicar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
}

function errorNumeroTarjeta(numero: string): string | null {
  if (!numero) return 'required';
  if (!NUMERO_TARJETA_REGEX.test(numero) || !pasaLuhn(numero)) return 'invalido';
  return null;
}

function errorTitular(titular: string): string | null {
  const valor = titular.trim();
  if (!valor) return 'required';
  if (valor.length < 3 || !SOLO_LETRAS.test(valor)) return 'invalido';
  return null;
}

function errorVencimiento(vencimiento: string): string | null {
  if (!vencimiento) return 'required';
  const partes = VENCIMIENTO_REGEX.exec(vencimiento);
  if (!partes) return 'invalido';
  const mes = Number(partes[1]);
  const anio = 2000 + Number(partes[2]);
  const hoy = new Date();
  // Vence el último día del mes indicado.
  if (anio * 12 + mes - 1 < hoy.getFullYear() * 12 + hoy.getMonth()) return 'vencida';
  return null;
}

function errorCvv(cvv: string): string | null {
  if (!cvv) return 'required';
  return CVV_REGEX.test(cvv) ? null : 'invalido';
}

function errorDocumento(tipo: string, numero: string): string | null {
  if (!numero) return 'required';
  if (tipo.toUpperCase() === 'DNI') return DNI_REGEX.test(numero) ? null : 'dni';
  return DOC_OTRO_REGEX.test(numero) ? null : 'otro';
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
  protected readonly totalAsientos = this.checkout.totalAsientos;
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

  
  // Datos y errores de la tarjeta.
  protected readonly tarjeta = signal<DatosTarjeta>({
    numero: '',
    titular: '',
    vencimiento: '',
    cvv: '',
    tipoDoc: 'DNI',
    numeroDoc: '',
  });
  private readonly camposTocados = signal<Set<CampoTarjeta>>(new Set());

  protected readonly esDni = computed(() => this.tarjeta().tipoDoc.toUpperCase() === 'DNI');

  protected readonly erroresTarjeta = computed(() => {
    const t = this.tarjeta();
    return {
      numero: errorNumeroTarjeta(t.numero),
      titular: errorTitular(t.titular),
      vencimiento: errorVencimiento(t.vencimiento),
      cvv: errorCvv(t.cvv),
      numeroDoc: errorDocumento(t.tipoDoc, t.numeroDoc),
    };
  });

  protected readonly tarjetaValida = computed(() =>
    Object.values(this.erroresTarjeta()).every((error) => error === null),
  );

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

  
  protected mostrarErrorTarjeta(campo: CampoTarjeta): boolean {
    const tocado = this.camposTocados().has(campo) || this.intentoPagar();
    return tocado && this.erroresTarjeta()[campo] !== null;
  }

  protected marcarTocado(campo: CampoTarjeta): void {
    this.camposTocados.update((tocados) => new Set(tocados).add(campo));
  }

  // Limpia lo que escribe el usuario y guarda el valor para validarlo.
  protected alEscribirTarjeta(campo: CampoTarjeta, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    let valor = input.value;

    switch (campo) {
      case 'numero':
      case 'cvv':
        valor = valor.replace(/\D/g, '');
        break;
      case 'vencimiento': {
        // Pone la barra sola: "1228" -> "12/28"
        const digitos = valor.replace(/\D/g, '').slice(0, 4);
        valor = digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
        break;
      }
      case 'numeroDoc':
        valor = this.esDni() ? valor.replace(/\D/g, '') : valor.replace(/[^a-zA-Z0-9]/g, '');
        break;
    }

    if (valor !== input.value) {
      input.value = valor;
    }
    this.tarjeta.update((t) => ({ ...t, [campo]: valor }));
  }

  protected alCambiarTipoDoc(evento: Event): void {
    const tipo = (evento.target as HTMLSelectElement).value;
    this.tarjeta.update((t) => ({ ...t, tipoDoc: tipo }));
  }

  // El SDK carga las opciones del tipo de documento solo, así que lo leemos antes de validar.
  private sincronizarTipoDoc(): void {
    const select = document.getElementById('docType') as HTMLSelectElement | null;
    if (select?.value) {
      this.tarjeta.update((t) => ({ ...t, tipoDoc: select.value }));
    }
  }

  private enviar(): void {
    if (this.ocupado()) {
      return;
    }
    this.intentoPagar.set(true);
    this.errorTarjeta.set(null);
        this.estadoPago.set(null);
    this.sincronizarTipoDoc();

    submit(this.facturacion, async () => {
      if (!this.tarjetaValida()) {
        return undefined;
      }
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
