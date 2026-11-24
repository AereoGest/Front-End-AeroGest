import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Qué caracteres acepta el campo:
 * - letras:  letras (con tildes), espacios y . ' ( ) -   → nombres de ciudades, aeropuertos, etc.
 * - entero:  solo dígitos                               → cantidades (asientos)
 * - decimal: dígitos y un separador decimal             → montos (precio)
 */
export type FiltroEntrada = 'letras' | 'entero' | 'decimal';

const CARACTER_PERMITIDO: Record<FiltroEntrada, RegExp> = {
  letras: /[\p{L}\p{M}\s.'()-]/u,
  entero: /\d/,
  decimal: /[\d.,]/,
};

/**
 * Impide escribir o pegar caracteres que no corresponden al tipo de campo.
 * En los <input type="number"> bloquea "e", "+" y "-", que el navegador acepta por defecto.
 * Opcionalmente limita la cantidad de dígitos, de decimales y el valor máximo.
 *
 * Uso: <input type="number" appFiltroEntrada="entero" [maxDigitos]="3" [valorMaximo]="180" />
 */
@Directive({
  selector: 'input[appFiltroEntrada]',
})
export class FiltroEntradaDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  readonly appFiltroEntrada = input.required<FiltroEntrada>();
  /** Máximo de dígitos de la parte entera. */
  readonly maxDigitos = input<number | null>(null);
  /** Máximo de decimales (solo para "decimal"). */
  readonly maxDecimales = input(2);
  /** Valor máximo permitido (para "entero" y "decimal"). */
  readonly valorMaximo = input<number | null>(null);

  private esPermitido(texto: string): boolean {
    const regla = CARACTER_PERMITIDO[this.appFiltroEntrada()];
    return [...texto].every((c) => regla.test(c));
  }

  private limpiar(texto: string): string {
    const regla = CARACTER_PERMITIDO[this.appFiltroEntrada()];
    return [...texto].filter((c) => regla.test(c)).join('');
  }

  /** Bloquea lo que se escribe (teclado físico, teclados de celular, autocompletado). */
  @HostListener('beforeinput', ['$event'])
  onBeforeInput(e: InputEvent): void {
    if (e.data && !this.esPermitido(e.data)) e.preventDefault();
  }

  /** Al pegar, se queda solo con los caracteres válidos. */
  @HostListener('paste', ['$event'])
  onPaste(e: ClipboardEvent): void {
    const pegado = e.clipboardData?.getData('text') ?? '';
    if (this.esPermitido(pegado)) return;
    e.preventDefault();

    const limpio = this.limpiar(pegado);
    // Los campos numéricos no permiten insertar en la posición del cursor: se descarta el pegado
    if (!limpio || this.el.type === 'number') return;

    const inicio = this.el.selectionStart ?? this.el.value.length;
    const fin = this.el.selectionEnd ?? inicio;
    this.el.setRangeText(limpio, inicio, fin, 'end');
    this.el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent): void {
    const texto = e.dataTransfer?.getData('text') ?? '';
    if (!this.esPermitido(texto)) e.preventDefault();
  }

  /** Red de seguridad: corrige el valor si algo inválido llegó a entrar o si supera los límites. */
  @HostListener('input')
  onInput(): void {
    const actual = this.el.value;
    const corregido = this.corregir(actual);
    if (corregido === actual) return;
    this.el.value = corregido;
    // Avisa a ngModel del valor corregido
    this.el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private corregir(valor: string): string {
    const tipo = this.appFiltroEntrada();
    let v = this.limpiar(valor);
    if (tipo === 'letras') return v;

    const maxDigitos = this.maxDigitos();
    if (tipo === 'entero') {
      if (maxDigitos !== null) v = v.slice(0, maxDigitos);
    } else {
      const [entera = '', ...resto] = v.split(/[.,]/);
      const tieneSeparador = resto.length > 0;
      const decimales = resto.join('').slice(0, this.maxDecimales());
      const enteraLimitada = maxDigitos !== null ? entera.slice(0, maxDigitos) : entera;
      v = tieneSeparador ? `${enteraLimitada}.${decimales}` : enteraLimitada;
    }

    const maximo = this.valorMaximo();
    if (maximo !== null && v !== '' && Number(v) > maximo) v = String(maximo);
    return v;
  }
}
