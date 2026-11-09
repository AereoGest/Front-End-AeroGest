import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CheckInResponse,
  PasajeReserva,
  PasajeUpdateDTO,
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
  private readonly pasajesUrl = `${environment.apiUrl}/pasajes`;
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

  // ===================== Administración de reservas =====================

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

  // ===================== Administración de pasajes por reserva =====================

  obtenerPasajesPorReserva(reservaId: number): Observable<PasajeReserva[]> {
    return this.http.get<PasajeReserva[]>(`${this.pasajesUrl}/reserva/${reservaId}`);
  }

  actualizarPasaje(id: number, dto: PasajeUpdateDTO): Observable<PasajeReserva> {
    return this.http.put<PasajeReserva>(`${this.pasajesUrl}/${id}`, dto);
  }

  cancelarPasaje(id: number, reservaId: number): Observable<void> {
    const params = new HttpParams().set('reservaId', String(reservaId));
    return this.http.delete<void>(`${this.pasajesUrl}/${id}`, { params });
  }
}
