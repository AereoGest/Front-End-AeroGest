import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CheckInResponse,
  PersonaResumen,
  Reserva,
  ReservaAdminRequest,
  ReservaRequest,
  ReservaUpdateDTO,
} from '../Models/Reserva';
import { PagoRequest, PagoResponse } from '../Models/Pago';

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private readonly baseUrl = `${environment.apiUrl}/reservas`;
  private readonly personasUrl = `${environment.apiUrl}/personas`;

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

  checkIn(id: number): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(`${this.baseUrl}/mis-reservas/${id}/check-in`, {});
  }

  // ===================== Administración =====================

  obtenerTodas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.baseUrl);
  }

  obtenerPorId(id: number): Observable<Reserva> {
    return this.http.get<Reserva>(`${this.baseUrl}/${id}`);
  }

  crearReservaAdmin(reserva: ReservaAdminRequest): Observable<Reserva> {
    return this.http.post<Reserva>(this.baseUrl, reserva);
  }

  actualizarReserva(id: number, dto: ReservaUpdateDTO): Observable<Reserva> {
    return this.http.put<Reserva>(`${this.baseUrl}/${id}`, dto);
  }

  darDeBajaReserva(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  obtenerClientes(): Observable<PersonaResumen[]> {
    return this.http.get<PersonaResumen[]>(this.personasUrl);
  }
}
