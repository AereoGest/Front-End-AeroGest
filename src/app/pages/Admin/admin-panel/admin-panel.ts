import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../services/auth';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import type { TranslationKey } from '../../../i18n/es';
import { VuelosAdmin } from '../vuelos-admin/vuelos-admin';
import { ReservasAdmin } from '../reservas-admin/reservas-admin';
import { PasajesAdmin } from '../pasajes-admin/pasajes-admin';
import { AsignacionesAdmin } from '../asignaciones-admin/asignaciones-admin';

export type SeccionAdminId = 'RESUMEN' | 'VUELOS' | 'RESERVAS' | 'PASAJES' | 'ASIGNACIONES';

export interface ModuloAdmin {
  id: Exclude<SeccionAdminId, 'RESUMEN'>;
  tituloKey: TranslationKey;
  descripcionKey: TranslationKey;
  ctaKey: TranslationKey;
  rutaDirecta?: string;
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, VuelosAdmin, ReservasAdmin, PasajesAdmin, AsignacionesAdmin],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.css',
})
export class AdminPanel {
  protected readonly auth = inject(Auth);

  protected readonly seccionActiva = signal<SeccionAdminId>('RESUMEN');

  protected readonly modulos: readonly ModuloAdmin[] = [
    {
      id: 'VUELOS',
      tituloKey: 'adminPanel.flights.title',
      descripcionKey: 'adminPanel.flights.desc',
      ctaKey: 'adminPanel.flights.cta',
      rutaDirecta: '/vuelosAdmin',
    },
    {
      id: 'RESERVAS',
      tituloKey: 'adminPanel.bookings.title',
      descripcionKey: 'adminPanel.bookings.desc',
      ctaKey: 'adminPanel.bookings.cta',
      rutaDirecta: '/reservasAdmin',
    },
    {
      id: 'PASAJES',
      tituloKey: 'adminPanel.tickets.title',
      descripcionKey: 'adminPanel.tickets.desc',
      ctaKey: 'adminPanel.tickets.cta',
      rutaDirecta: '/pasajesAdmin',
    },
    {
      id: 'ASIGNACIONES',
      tituloKey: 'adminPanel.assignments.title',
      descripcionKey: 'adminPanel.assignments.desc',
      ctaKey: 'adminPanel.assignments.cta',
      rutaDirecta: '/asignacionesAdmin',
    },
  ];

  protected readonly rolKey = computed<TranslationKey>(() => {
    const rol = this.auth.rolUsuario() ?? 'ROLE_ADMIN';
    return `role.${rol}` as TranslationKey;
  });

  protected readonly moduloSeleccionado = computed<ModuloAdmin | null>(() => {
    const actual = this.seccionActiva();
    if (actual === 'RESUMEN') return null;
    return this.modulos.find((m) => m.id === actual) ?? null;
  });

  seleccionarSeccion(seccion: SeccionAdminId): void {
    this.seccionActiva.set(seccion);
  }
}