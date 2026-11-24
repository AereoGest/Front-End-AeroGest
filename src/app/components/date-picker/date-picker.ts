import {
  ApplicationRef,
  Component,
  ComponentRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  HostListener,
  OnDestroy,
  computed,
  createComponent,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

export interface CeldaDia {
  fechaIso: string;
  numero: number;
  delMesActual: boolean;
  esHoy: boolean;
  seleccionado: boolean;
  deshabilitado: boolean;
}

export function formatearFechaIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-date-picker-popover',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './date-picker-popover.html',
  styleUrl: './date-picker-popover.css',
})
export class DatePickerPopover {
  protected readonly i18n = inject(I18nService);

  readonly valorSeleccionado = signal('');
  readonly min = signal('');
  readonly max = signal('');
  readonly anioVista = signal(new Date().getFullYear());
  readonly mesVista = signal(new Date().getMonth());
  readonly top = signal(0);
  readonly left = signal(0);

  onElegirFecha?: (fechaIso: string) => void;
  onCerrar?: () => void;

  protected readonly hoyIso = formatearFechaIsoLocal(new Date());

  protected readonly aniosDisponibles = computed(() => {
    const actual = new Date().getFullYear();
    const minStr = this.min();
    const maxStr = this.max();
    const minAnio = minStr && /^\d{4}/.test(minStr) ? Number(minStr.slice(0, 4)) : 1900;
    const maxAnio = maxStr && /^\d{4}/.test(maxStr) ? Number(maxStr.slice(0, 4)) : actual + 5;
    const desde = Math.min(minAnio, maxAnio);
    const hasta = Math.max(minAnio, maxAnio);
    const lista: number[] = [];
    for (let a = hasta; a >= desde; a--) {
      lista.push(a);
    }
    return lista;
  });

  protected readonly mesesDisponibles = computed(() => {
    const locale = this.i18n.currentLang() === 'en' ? 'en-US' : 'es-AR';
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, idx) => {
      const nombre = fmt.format(new Date(2026, idx, 1));
      return {
        indice: idx,
        etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      };
    });
  });

  protected readonly diasSemana = computed(() => {
    return this.i18n.currentLang() === 'en'
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  });

  protected readonly puedeMesAnterior = computed(() => {
    const minStr = this.min();
    if (!minStr || !/^\d{4}-\d{2}/.test(minStr)) return true;
    const minAnio = Number(minStr.slice(0, 4));
    const minMes = Number(minStr.slice(5, 7)) - 1;
    return this.anioVista() > minAnio || (this.anioVista() === minAnio && this.mesVista() > minMes);
  });

  protected readonly puedeMesSiguiente = computed(() => {
    const maxStr = this.max();
    if (!maxStr || !/^\d{4}-\d{2}/.test(maxStr)) return true;
    const maxAnio = Number(maxStr.slice(0, 4));
    const maxMes = Number(maxStr.slice(5, 7)) - 1;
    return this.anioVista() < maxAnio || (this.anioVista() === maxAnio && this.mesVista() < maxMes);
  });

  protected readonly hoyHabilitado = computed(() => !this.estaFueraDeRango(this.hoyIso));

  protected readonly celdasDias = computed<CeldaDia[]>(() => {
    const anio = this.anioVista();
    const mes = this.mesVista();
    const seleccionado = this.valorSeleccionado();

    const primerDiaMes = new Date(anio, mes, 1);
    // Lunes = 0 ... Domingo = 6
    const offsetInicio = (primerDiaMes.getDay() + 6) % 7;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const diasMesAnterior = new Date(anio, mes, 0).getDate();

    const celdas: CeldaDia[] = [];

    for (let i = offsetInicio - 1; i >= 0; i--) {
      const num = diasMesAnterior - i;
      const fecha = new Date(anio, mes - 1, num);
      const iso = formatearFechaIsoLocal(fecha);
      celdas.push({
        fechaIso: iso,
        numero: num,
        delMesActual: false,
        esHoy: iso === this.hoyIso,
        seleccionado: iso === seleccionado,
        deshabilitado: this.estaFueraDeRango(iso),
      });
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(anio, mes, dia);
      const iso = formatearFechaIsoLocal(fecha);
      celdas.push({
        fechaIso: iso,
        numero: dia,
        delMesActual: true,
        esHoy: iso === this.hoyIso,
        seleccionado: iso === seleccionado,
        deshabilitado: this.estaFueraDeRango(iso),
      });
    }

    const restantes = (7 - (celdas.length % 7)) % 7;
    for (let dia = 1; dia <= restantes; dia++) {
      const fecha = new Date(anio, mes + 1, dia);
      const iso = formatearFechaIsoLocal(fecha);
      celdas.push({
        fechaIso: iso,
        numero: dia,
        delMesActual: false,
        esHoy: iso === this.hoyIso,
        seleccionado: iso === seleccionado,
        deshabilitado: this.estaFueraDeRango(iso),
      });
    }

    return celdas;
  });

  sincronizarDesdeValor(valorIso: string, minIso: string, maxIso: string): void {
    this.valorSeleccionado.set(valorIso);
    this.min.set(minIso);
    this.max.set(maxIso);

    if (valorIso && /^\d{4}-\d{2}-\d{2}$/.test(valorIso)) {
      this.anioVista.set(Number(valorIso.slice(0, 4)));
      this.mesVista.set(Number(valorIso.slice(5, 7)) - 1);
      return;
    }

    let refIso = this.hoyIso;
    if (maxIso && refIso > maxIso) refIso = maxIso;
    if (minIso && refIso < minIso) refIso = minIso;

    this.anioVista.set(Number(refIso.slice(0, 4)));
    this.mesVista.set(Number(refIso.slice(5, 7)) - 1);
  }

  protected cambiarMes(delta: number): void {
    const nueva = new Date(this.anioVista(), this.mesVista() + delta, 1);
    this.anioVista.set(nueva.getFullYear());
    this.mesVista.set(nueva.getMonth());
  }

  protected onMesChange(nuevoMes: number | string): void {
    this.mesVista.set(Number(nuevoMes));
  }

  protected onAnioChange(nuevoAnio: number | string): void {
    this.anioVista.set(Number(nuevoAnio));
  }

  protected seleccionarDia(celda: CeldaDia): void {
    if (celda.deshabilitado) return;
    this.onElegirFecha?.(celda.fechaIso);
  }

  protected seleccionarHoy(): void {
    if (!this.hoyHabilitado()) return;
    this.onElegirFecha?.(this.hoyIso);
  }

  protected limpiar(): void {
    this.onElegirFecha?.('');
  }

  private estaFueraDeRango(fechaIso: string): boolean {
    const minStr = this.min();
    const maxStr = this.max();
    if (minStr && fechaIso < minStr) return true;
    if (maxStr && fechaIso > maxStr) return true;
    return false;
  }
}

/**
 * Directiva reutilizable para todos los <input type="date"> del frontend.
 * Reemplaza el selector nativo del navegador por el calendario desplegable de AeroGest
 * con selector rápido de año y mes, soporte dark/light mode e i18n ES/EN.
 */
@Directive({
  selector: 'input[type="date"]',
  standalone: true,
})
export class DatePickerDirective implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  private popoverRef: ComponentRef<DatePickerPopover> | null = null;

  private readonly onDocMouseDown = (event: MouseEvent) => {
    if (!this.popoverRef) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (this.el.nativeElement.contains(target)) return;
    if (this.popoverRef.location.nativeElement.contains(target)) return;
    this.cerrarPopover();
  };

  private readonly onWindowScrollOrResize = () => {
    if (this.popoverRef) {
      this.actualizarPosicion();
    }
  };

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    const input = this.el.nativeElement;
    if (input.disabled || input.readOnly) return;
    // Evita que el navegador abra su calendario nativo al hacer clic en el ícono o campo
    event.preventDefault();
    input.focus();
    this.abrirPopover();
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const input = this.el.nativeElement;
    if (input.disabled || input.readOnly) return;
    event.preventDefault();
    if (!this.popoverRef) {
      this.abrirPopover();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.popoverRef) {
      event.preventDefault();
      event.stopPropagation();
      this.cerrarPopover();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') && !this.popoverRef) {
      const input = this.el.nativeElement;
      if (input.disabled || input.readOnly) return;
      event.preventDefault();
      this.abrirPopover();
    }
  }

  @HostListener('input')
  onInput(): void {
    if (this.popoverRef) {
      const input = this.el.nativeElement;
      this.popoverRef.instance.sincronizarDesdeValor(input.value, input.min, input.max);
    }
  }

  abrirPopover(): void {
    const input = this.el.nativeElement;
    if (this.popoverRef) {
      this.popoverRef.instance.sincronizarDesdeValor(input.value, input.min, input.max);
      this.actualizarPosicion();
      return;
    }

    const ref = createComponent(DatePickerPopover, {
      environmentInjector: this.injector,
    });

    ref.instance.sincronizarDesdeValor(input.value, input.min, input.max);
    ref.instance.onElegirFecha = (fechaIso: string) => {
      this.aplicarValor(fechaIso);
      this.cerrarPopover();
    };
    ref.instance.onCerrar = () => this.cerrarPopover();

    this.appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement);
    this.popoverRef = ref;

    this.actualizarPosicion();
    ref.changeDetectorRef.detectChanges();

    document.addEventListener('mousedown', this.onDocMouseDown, true);
    window.addEventListener('scroll', this.onWindowScrollOrResize, true);
    window.addEventListener('resize', this.onWindowScrollOrResize, true);
  }

  cerrarPopover(): void {
    if (!this.popoverRef) return;
    document.removeEventListener('mousedown', this.onDocMouseDown, true);
    window.removeEventListener('scroll', this.onWindowScrollOrResize, true);
    window.removeEventListener('resize', this.onWindowScrollOrResize, true);

    this.appRef.detachView(this.popoverRef.hostView);
    this.popoverRef.destroy();
    this.popoverRef = null;
  }

  private aplicarValor(nuevoValor: string): void {
    const input = this.el.nativeElement;
    input.value = nuevoValor;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private actualizarPosicion(): void {
    if (!this.popoverRef) return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const anchoPopover = 304;
    const altoEstimado = 340;
    const margen = 8;

    let top = rect.bottom + 6;
    if (top + altoEstimado > window.innerHeight - margen && rect.top - altoEstimado - 6 >= margen) {
      top = rect.top - altoEstimado - 6;
    }

    let left = rect.left;
    if (left + anchoPopover > window.innerWidth - margen) {
      left = Math.max(margen, window.innerWidth - anchoPopover - margen);
    }

    this.popoverRef.instance.top.set(Math.max(margen, Math.round(top)));
    this.popoverRef.instance.left.set(Math.max(margen, Math.round(left)));
  }

  ngOnDestroy(): void {
    this.cerrarPopover();
  }
}
