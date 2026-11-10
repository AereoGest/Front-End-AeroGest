import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../services/i18n';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, any>): string {
    // Escucha el signal actual para registrar la dependencia si se usa en un contexto de signal
    this.i18n.currentLang();
    if (!key) return '';
    const translated = this.i18n.t(key, params);
    if (translated === key) {
      return this.i18n.translateBackendMessage(key);
    }
    return translated;
  }
}
