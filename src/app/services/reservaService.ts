import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Reserva, ReservaRequest } from '../Models/Reserva';
import { PagoRequest, PagoResponse } from '../Models/Pago';

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private readonly baseUrl = `${environment.apiUrl}/reservas`;

  constructor(private http: HttpClient) {}

  obtenerMisReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(`${this.baseUrl}/mis-reservas`);
  }

  crearMiReserva(reserva: ReservaRequest): Observable<Reserva> {
    return this.http.post<Reserva>(`${this.baseUrl}/mis-reservas`, reserva);
  }

  pagarMiReserva(id: number, pago: PagoRequest): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(`${this.baseUrl}/mis-reservas/${id}/pagar`, pago);
  }

  cancelar(id: number): Observable<string> {
    return this.http.patch(`${this.baseUrl}/cancelar/${id}`, {}, { responseType: 'text' });
  }
}
