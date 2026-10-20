import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthResponse } from '../../Models/Perfil';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './verify.html',
  styleUrl: './verify.css',
})
export class Verify implements OnInit {
  protected readonly cargando = signal(true);
  protected readonly verificado = signal(false);
  protected readonly error = signal('');

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: Auth,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.cargando.set(false);
      this.error.set('No se encontró el token de verificación.');
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
        this.error.set(err.error?.message || 'El token de verificación es inválido o ya fue utilizado.');
      }
    }).add(() => this.cargando.set(false));
  }
}
