import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { en } from '../i18n/en';
import { es, type TranslationKey } from '../i18n/es';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'aerogest-lang';

const DICTIONARIES: Record<Lang, Record<string, string>> = {
  es,
  en,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT, { optional: true });

  private readonly idioma = signal<Lang>(this.idiomaInicial());

  readonly currentLang = this.idioma.asReadonly();
  readonly isSpanish = computed(() => this.idioma() === 'es');
  readonly isEnglish = computed(() => this.idioma() === 'en');
  readonly label = computed(() =>
    this.idioma() === 'es' ? 'English' : 'Español'
  );

  constructor() {
    effect(() => {
      this.aplicar(this.idioma());
    });
  }

  /**
   * Cambia el idioma actual y lo persiste en localStorage.
   */
  setLang(lang: Lang): void {
    if (lang !== 'es' && lang !== 'en') return;
    this.idioma.set(lang);
    this.guardar(lang);
  }

  /**
   * Alterna entre español e inglés.
   */
  toggleLang(): void {
    this.setLang(this.idioma() === 'es' ? 'en' : 'es');
  }

  /**
   * Traduce una clave con soporte para interpolación opcional de parámetros `{param}` o `{{param}}`.
   */
  t(key: TranslationKey | string, params?: Record<string, any>): string {
    const lang = this.idioma();
    const dict = DICTIONARIES[lang] || DICTIONARIES.es;
    let translation = dict[key] ?? DICTIONARIES.es[key] ?? key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        if (paramValue !== undefined && paramValue !== null) {
          translation = translation
            .replace(new RegExp(`\\{\\{\\s*${paramKey}\\s*\\}\\}`, 'g'), String(paramValue))
            .replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
        }
      }
    }

    return translation;
  }

  private idiomaInicial(): Lang {
    // 1. Preferencia almacenada en localStorage
    const guardado = this.leerGuardado();
    if (guardado) {
      return guardado;
    }

    return 'es';
  }

  private leerGuardado(): Lang | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const valor = localStorage.getItem(STORAGE_KEY);
        return valor === 'es' || valor === 'en' ? valor : null;
      }
    } catch {
      /* Modo incógnito o almacenamiento restringido */
    }
    return null;
  }

  private guardar(lang: Lang): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {
      /* Ignorar error de almacenamiento */
    }
  }

  private aplicar(lang: Lang): void {
    if (this.document?.documentElement) {
      this.document.documentElement.setAttribute('lang', lang);
    }
  }
}
