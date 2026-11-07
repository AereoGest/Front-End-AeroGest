import { Component, computed, inject, input, output } from '@angular/core';
import { Reserva } from '../../Models/Reserva';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

@Component({
  selector: 'app-checkin-confirmacion',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './check-in-online.html',
  styleUrl: './check-in-online.css',
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
})
export class Checkinonline {
  private readonly i18n = inject(I18nService);

  readonly reserva = input.required<Reserva>();
  readonly cargando = input(false);
  readonly error = input('');

  readonly confirmar = output<void>();
  readonly cancelar = output<void>();

  protected readonly pasajes = computed(() => this.reserva().pasajes ?? []);
  protected readonly vuelo = computed(() => this.pasajes()[0]?.vuelo ?? null);
  protected readonly haySinAsiento = computed(() => this.pasajes().some((p) => !p.asiento));

  // "yyyy-mm-dd" armado a mano para que no corra un día por la zona horaria
  protected formatearFechaVuelo(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const locale = this.i18n.currentLang() === 'es' ? 'es-AR' : 'en-US';
    return new Date(anio, mes - 1, dia).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}