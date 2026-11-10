import { Component, computed, effect, input, model, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Aeropuerto } from '../../Models/Aeropuerto';
import { TranslatePipe } from '../../pipes/translate.pipe';

// Espera desde la última tecla antes de recalcular las sugerencias
const DEBOUNCE_BUSQUEDA_MS = 300;
const MAX_SUGERENCIAS = 8;

/**
 * Campo de texto con sugerencias de aeropuertos existentes.
 * El aeropuerto solo queda elegido (`seleccionado`) cuando el usuario toma una sugerencia:
 * el texto libre no es un valor válido.
 *
 * Uso:
 * <app-aeropuerto-autocompletar inputId="f-origen" label="Origen"
 *   [aeropuertos]="lista" [(seleccionado)]="origenId" [(textoInvalido)]="origenSuelto"
 *   [bloqueadoPor]="destinoId" [error]="errorOrigen" />
 */
@Component({
  selector: 'app-aeropuerto-autocompletar',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './aeropuerto-autocompletar.html',
  styleUrl: './aeropuerto-autocompletar.css',
})
export class AeropuertoAutocompletar {
  /** Aeropuertos entre los que se puede elegir. */
  readonly aeropuertos = input.required<Aeropuerto[]>();
  /** Id del aeropuerto elegido (two-way binding). */
  readonly seleccionado = model<number | null>(null);
  /** true cuando hay texto escrito que no corresponde a ninguna sugerencia elegida (two-way binding). */
  readonly textoInvalido = model(false);
  /** Id del aeropuerto del otro campo: ese aeropuerto y los de su misma ciudad no se pueden elegir. */
  readonly bloqueadoPor = input<number | null>(null);
  /** Clave de traducción (o texto) del motivo por el que una sugerencia está bloqueada. */
  readonly motivoBloqueo = input('');
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  /** Error a mostrar debajo del campo (clave de traducción o texto). */
  readonly error = input<string | null | undefined>(null);

  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly resaltado = signal(-1);
  private readonly tocado = signal(false);
  /** Último id que este componente eligió o limpió, para distinguirlo de cambios hechos desde afuera. */
  private idPropio: number | null | undefined = undefined;

  /** Texto de búsqueda con debounce: se actualiza recién cuando el usuario deja de tipear. */
  private readonly busqueda = toSignal(
    toObservable(this.texto).pipe(debounceTime(DEBOUNCE_BUSQUEDA_MS), distinctUntilChanged()),
    { initialValue: '' }
  );

  protected readonly sugerencias = computed(() => {
    const texto = normalizar(this.busqueda());
    if (!texto) return [];
    const puntaje = (a: Aeropuerto) => {
      if (normalizar(a.codigoIata ?? '') === texto) return 0;
      if (normalizar(a.ciudad ?? '').startsWith(texto)) return 1;
      return 2;
    };
    return this.aeropuertos()
      .filter((a) => normalizar(`${a.ciudad} ${a.codigoIata} ${a.nombre} ${a.pais}`).includes(texto))
      .sort((a, b) => puntaje(a) - puntaje(b) || a.ciudad.localeCompare(b.ciudad))
      .slice(0, MAX_SUGERENCIAS);
  });

  protected readonly mostrarLista = computed(
    () => this.abierto() && this.seleccionado() === null && !!normalizar(this.busqueda())
  );

  constructor() {
    // Si el id cambia desde afuera (ej. al abrir un vuelo para modificarlo), se muestra su etiqueta
    effect(() => {
      const id = this.seleccionado();
      const lista = this.aeropuertos();
      untracked(() => {
        if (id === this.idPropio && (id === null || this.texto())) return;
        this.idPropio = id;
        const aeropuerto = lista.find((a) => a.id === id);
        this.texto.set(aeropuerto ? etiqueta(aeropuerto) : '');
        this.tocado.set(false);
      });
    });

    // Avisa al padre si quedó texto escrito sin elegir ninguna sugerencia
    effect(() => {
      const invalido =
        this.tocado() && !this.abierto() && this.seleccionado() === null && !!this.texto().trim();
      untracked(() => this.textoInvalido.set(invalido));
    });
  }

  protected onInput(valor: string): void {
    this.texto.set(valor);
    // Si cambia el texto, la elección anterior deja de valer hasta que tome otra sugerencia
    if (this.seleccionado() !== null) this.fijar(null);
    this.abierto.set(true);
    this.resaltado.set(-1);
  }

  protected elegir(a: Aeropuerto): void {
    if (this.bloqueado(a)) return;
    this.fijar(a.id);
    this.texto.set(etiqueta(a));
    this.abierto.set(false);
    this.resaltado.set(-1);
  }

  protected onBlur(): void {
    this.abierto.set(false);
    this.tocado.set(true);
    // Si escribió exactamente un código IATA existente (ej. "MAD"), se elige solo
    if (this.seleccionado() === null) {
      const codigo = this.texto().trim().toUpperCase();
      const exacto = this.aeropuertos().find((a) => (a.codigoIata ?? '').toUpperCase() === codigo);
      if (exacto) this.elegir(exacto);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.abierto.set(true);
        this.moverResaltado(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moverResaltado(-1);
        break;
      case 'Enter':
        // Enter elige la sugerencia resaltada y nunca envía el formulario con la lista abierta
        if (this.mostrarLista()) {
          event.preventDefault();
          const elegida = this.sugerencias()[this.resaltado()];
          if (elegida) this.elegir(elegida);
        }
        break;
      case 'Escape':
        // Cierra solo la lista, no el modal que contiene al campo
        if (this.mostrarLista()) {
          event.preventDefault();
          event.stopPropagation();
          this.abierto.set(false);
        }
        break;
    }
  }

  /** Mismo aeropuerto o misma ciudad que el elegido en el otro campo (ej. EZE / AEP). */
  protected bloqueado(a: Aeropuerto): boolean {
    const otroId = this.bloqueadoPor();
    if (otroId === null || otroId === undefined) return false;
    const otro = this.aeropuertos().find((x) => x.id === Number(otroId));
    if (!otro) return false;
    return otro.id === a.id || (!!normalizar(a.ciudad) && normalizar(a.ciudad) === normalizar(otro.ciudad));
  }

  protected opcionId(i: number): string {
    return `${this.inputId()}-op-${i}`;
  }

  private fijar(id: number | null): void {
    this.idPropio = id;
    this.seleccionado.set(id);
  }

  /** Mueve la sugerencia resaltada salteando las bloqueadas. */
  private moverResaltado(delta: number): void {
    const lista = this.sugerencias();
    if (!lista.length) return;
    let i = this.resaltado();
    for (let paso = 0; paso < lista.length; paso++) {
      i = (i + delta + lista.length) % lista.length;
      if (!this.bloqueado(lista[i])) {
        this.resaltado.set(i);
        return;
      }
    }
  }
}

export function etiqueta(a: Aeropuerto): string {
  return `${a.ciudad} (${a.codigoIata}) · ${a.nombre}`;
}

function normalizar(valor: string): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}
