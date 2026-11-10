import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { I18nService } from '../../services/i18n';
import { ThemeService } from '../../services/theme';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Perfil } from '../../Models/Perfil';

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
  protected readonly mensajeExito = signal('');
  protected readonly mensajeError = signal('');

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
}
