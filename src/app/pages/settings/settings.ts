import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { I18nService } from '../../services/i18n';
import { ThemeService } from '../../services/theme';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Perfil, TotpSetupResponse } from '../../Models/Perfil';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  protected readonly auth = inject(Auth);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);

  protected readonly perfil = signal<Perfil | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando2FA = signal(false);
  protected readonly guardandoTotp = signal(false);
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');

  // Estado del modal de configuración TOTP
  protected readonly modalTotpAbierto = signal(false);
  protected readonly totpSetupData = signal<TotpSetupResponse | null>(null);
  protected readonly codigoTotp = signal('');
  protected readonly claveCopiada = signal(false);
  protected readonly errorModalTotp = signal('');

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.cargando.set(true);
    this.auth.obtenerPerfil().subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(error.error?.message || this.i18n.t('common.error'));
      }
    }).add(() => this.cargando.set(false));
  }

  toggleDosFactores(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.guardando2FA.set(true);

    this.auth.toggle2fa().subscribe({
      next: (mensaje) => {
        this.mensajeExito.set(mensaje);
        this.cargarPerfil();
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(error.error?.message || 'No se pudo cambiar el 2FA.');
      }
    }).add(() => this.guardando2FA.set(false));
  }

  toggleTotp(): void {
    if (this.perfil()?.totpEnabled) {
      this.desactivarTotp();
    } else {
      this.abrirModalTotp();
    }
  }

  abrirModalTotp(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.errorModalTotp.set('');
    this.codigoTotp.set('');
    this.claveCopiada.set(false);
    this.guardandoTotp.set(true);

    this.auth.setupTotp().subscribe({
      next: (setup) => {
        this.totpSetupData.set(setup);
        this.modalTotpAbierto.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(error.error?.message || 'No se pudo iniciar la configuración del autenticador móvil.');
      }
    }).add(() => this.guardandoTotp.set(false));
  }

  cerrarModalTotp(): void {
    this.modalTotpAbierto.set(false);
    this.totpSetupData.set(null);
    this.codigoTotp.set('');
    this.errorModalTotp.set('');
    this.claveCopiada.set(false);
  }

  copiarClave(): void {
    const key = this.totpSetupData()?.secret;
    if (!key) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(key).then(() => {
        this.claveCopiada.set(true);
        setTimeout(() => this.claveCopiada.set(false), 2500);
      });
    }
  }

  confirmarYActivarTotp(): void {
    const secret = this.totpSetupData()?.secret;
    const code = this.codigoTotp().trim();

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      this.errorModalTotp.set(this.i18n.t('settings.totpInvalidCode'));
      return;
    }

    if (!secret) {
      this.errorModalTotp.set('Clave secreta no disponible.');
      return;
    }

    this.guardandoTotp.set(true);
    this.errorModalTotp.set('');

    this.auth.activarTotp(secret, code).subscribe({
      next: (mensaje) => {
        this.cerrarModalTotp();
        this.mensajeExito.set(mensaje || this.i18n.t('settings.totpActivated'));
        this.cargarPerfil();
      },
      error: (error: HttpErrorResponse) => {
        this.errorModalTotp.set(error.error?.message || this.i18n.t('settings.totpInvalidCode'));
      }
    }).add(() => this.guardandoTotp.set(false));
  }

  desactivarTotp(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.guardandoTotp.set(true);

    this.auth.desactivarTotp().subscribe({
      next: (mensaje) => {
        this.mensajeExito.set(mensaje || this.i18n.t('settings.totpDeactivated'));
        this.cargarPerfil();
      },
      error: (error: HttpErrorResponse) => {
        this.mensajeError.set(error.error?.message || 'No se pudo desactivar el autenticador móvil.');
      }
    }).add(() => this.guardandoTotp.set(false));
  }
}
