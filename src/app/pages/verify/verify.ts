import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthResponse } from '../../Models/Perfil';
import { Auth } from '../../services/auth';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './verify.html',
  styleUrl: './verify.css',
})
export class Verify implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly cargando = signal(true);
  protected readonly verificado = signal(false);
  protected readonly error = signal('');
  protected readonly emailReenvio = signal('');
  protected readonly reenviando = signal(false);
  protected readonly mensajeReenvio = signal('');

  protected reenviar(): void {
    if (!this.emailReenvio().trim()) {
      return;
    }
    this.reenviando.set(true);
    this.mensajeReenvio.set('');
    this.auth.reenviarVerificacion(this.emailReenvio().trim()).subscribe({
      next: (res) => {
        this.mensajeReenvio.set(res.message || this.i18n.t('auth.registerSuccess'));
      },
      error: (err: HttpErrorResponse) => {
        this.mensajeReenvio.set(err.error?.message || this.i18n.t('common.error'));
      }
    }).add(() => this.reenviando.set(false));
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.cargando.set(false);
      this.error.set(this.i18n.t('common.error'));
      return;
    }

    this.http.get<AuthResponse>(`/api/auth/verify`, { params: { token } }).subscribe({
      next: (data) => {
        if (data.token) {
          this.auth.guardarSesion(data);
        }
        this.verificado.set(true);
        setTimeout(() => {
          if (!data.perfilCompleto) {
            this.router.navigate(['/perfil']);
          } else {
            this.router.navigate(['/']);
          }
        }, 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || this.i18n.t('common.error'));
      }
    }).add(() => this.cargando.set(false));
  }
}
