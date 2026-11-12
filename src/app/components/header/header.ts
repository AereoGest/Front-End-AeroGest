
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../services/auth';
import { I18nService } from '../../services/i18n';
import { ThemeService } from '../../services/theme';
import { TranslatePipe } from '../../pipes/translate.pipe';
import type { TranslationKey } from '../../i18n/es';

@Component({
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  selector: 'app-header',
  styleUrl: './header.css',
  templateUrl: './header.html',
})
export class Header implements OnInit {

  protected readonly auth = inject(Auth);
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);

  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly menuAbierto = signal(false);

  protected readonly nombreCorto = computed(() => {
    const email = this.auth.emailUsuario();
    const fallback = this.i18n.t('nav.myAccount');

    if (!email) return fallback;

    const localPart = email.split('@')[0];
    return localPart || fallback;
  });

  protected readonly inicialUsuario = computed(() => {
    const email = this.auth.emailUsuario();
    return email ? email.charAt(0).toUpperCase() : 'U';
  });

  protected readonly rolKey = computed<TranslationKey | null>(() => {
    const rol = this.auth.rolUsuario();
    return rol ? (`role.${rol}` as TranslationKey) : null;
  });

  ngOnInit(): void {
    if (this.auth.usuarioAutenticado() && !this.auth.rolUsuario()) {
      this.auth.sincronizarRolDesdeServidor().subscribe();
    }
  }

  toggleMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarSesion(): void {
    this.cerrarMenu();
    this.auth.cerrarSesion();
    this.router.navigate(['/']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuAbierto()) return;

    const target = event.target as Node | null;

    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.cerrarMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.menuAbierto()) {
      this.cerrarMenu();
    }
  }
}
