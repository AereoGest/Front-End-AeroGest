import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AsignacionService } from '../../services/asignacion-service';
import { Asignacion } from '../../Models/Asignacion';

import type { TranslationKey } from '../../i18n/es';     // <- ajustá la ruta
import { TranslatePipe } from '../../pipes/translate.pipe';

type Pestania = 'proximas' | 'historial';

@Component({
  selector: 'app-mis-asignaciones',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './mis-asignaciones.html',
  styleUrl: './mis-asignaciones.css',
})
export class MisAsignaciones implements OnInit {
  private asignacionService = inject(AsignacionService);

  asignaciones = signal<Asignacion[]>([]);
  cargando = signal(true);
  error = signal(false);
  pestania = signal<Pestania>('proximas');

  /** Vuelos que todavía no llegaron y no están cancelados (del más cercano al más lejano). */
  proximas = computed(() => this.asignaciones().filter(a => !this.terminada(a)));

  /** Vuelos que ya pasaron o fueron cancelados (del más reciente al más viejo). */
  historial = computed(() => this.asignaciones().filter(a => this.terminada(a)).reverse());

  /** Lo que se muestra según la pestaña elegida. */
  visibles = computed(() => (this.pestania() === 'proximas' ? this.proximas() : this.historial()));

  /** Próximo vuelo, para destacarlo arriba. */
  siguiente = computed(() => this.proximas()[0] ?? null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.asignacionService.getMisAsignaciones().subscribe({
      next: lista => {
        this.asignaciones.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  salida(a: Asignacion): Date {
    return new Date(`${a.vuelo.fechaSalida}T${a.vuelo.horaSalida}`);
  }

  llegada(a: Asignacion): Date {
    return new Date(`${a.vuelo.fechaLlegada}T${a.vuelo.horaLlegada}`);
  }

  /** Va al historial si el vuelo ya llegó o si fue cancelado. */
  terminada(a: Asignacion): boolean {
  return a.estadoAsignacion === 'CANCELADA' ||
         a.estadoAsignacion === 'FINALIZADA';
}

  /** '14:30:00' -> '14:30' */
  hora(h: string): string {
    return h?.substring(0, 5) ?? '';
  }

  rolKey(rol: string): TranslationKey {
    return `myAssignments.role.${rol}` as TranslationKey;
  }

  estadoKey(estado: string): TranslationKey {
    return `myAssignments.status.${estado}` as TranslationKey;
  }

  /** Devuelve la clave y el número para "en 3 días" / "en 5 h". */
  faltan(a: Asignacion): { key: TranslationKey; n: number } {
    const ms = this.salida(a).getTime() - Date.now();
    if (ms <= 0) return { key: 'myAssignments.inProgress', n: 0 };

    const horas = Math.floor(ms / 3_600_000);
    if (horas < 1) return { key: 'myAssignments.inMinutes', n: Math.max(1, Math.floor(ms / 60_000)) };
    if (horas < 48) return { key: 'myAssignments.inHours', n: horas };
    return { key: 'myAssignments.inDays', n: Math.floor(horas / 24) };
  }
}