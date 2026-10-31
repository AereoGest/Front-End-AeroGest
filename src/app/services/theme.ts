import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aerogest-theme';

/**
 * Controla el tema claro/oscuro de toda la aplicación.
 *
 * El tema se refleja en `<html data-theme="...">`, que es lo que leen los
 * tokens definidos en `styles.css`. La preferencia se guarda en localStorage
 * y, mientras el usuario no elija manualmente, se sigue la del sistema.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly mediaQuery: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  /** true cuando el usuario todavía no eligió un tema a mano. */
  private sigueAlSistema = true;

  private readonly tema = signal<Theme>(this.temaInicial());

  readonly theme = this.tema.asReadonly();
  readonly isDark = computed(() => this.tema() === 'dark');
  readonly label = computed(() =>
    this.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
  );

  constructor() {
    effect(() => this.aplicar(this.tema()));
    this.escucharSistema();
  }

  /** Alterna entre claro y oscuro guardando la elección. */
  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  /** Fija un tema explícito y lo persiste. */
  set(tema: Theme): void {
    this.sigueAlSistema = false;
    this.tema.set(tema);
    this.guardar(tema);
  }

  private temaInicial(): Theme {
    // 1. Lo que ya aplicó el script de index.html (evita parpadeos).
    const aplicado = this.document.documentElement.getAttribute('data-theme');
    if (aplicado === 'light' || aplicado === 'dark') {
      this.sigueAlSistema = !this.leerGuardado();
      return aplicado;
    }

    // 2. Preferencia guardada.
    const guardado = this.leerGuardado();
    if (guardado) {
      this.sigueAlSistema = false;
      return guardado;
    }

    // 3. Preferencia del sistema operativo.
    return this.mediaQuery?.matches ? 'dark' : 'light';
  }

  private leerGuardado(): Theme | null {
    try {
      const valor = localStorage.getItem(STORAGE_KEY);
      return valor === 'light' || valor === 'dark' ? valor : null;
    } catch {
      return null;
    }
  }

  private guardar(tema: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, tema);
    } catch {
      /* Almacenamiento bloqueado: el tema igual funciona en esta sesión. */
    }
  }

  private aplicar(tema: Theme): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', tema);
    root.style.colorScheme = tema;

    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', tema === 'dark' ? '#070e19' : '#1D3557');
  }

  private escucharSistema(): void {
    this.mediaQuery?.addEventListener?.('change', (evento) => {
      if (!this.sigueAlSistema) return;
      this.tema.set(evento.matches ? 'dark' : 'light');
    });
  }
}
