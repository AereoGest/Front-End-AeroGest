import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MercadoPagoService {
  private readonly baseUrl = `${environment.apiUrl}/mercadopago`;

  constructor(private http: HttpClient) {}

  obtenerPublicKey(): Observable<string> {
    return this.http
      .get<{ publicKey: string }>(`${this.baseUrl}/public-key`)
      .pipe(map((respuesta) => respuesta.publicKey));
  }
}
