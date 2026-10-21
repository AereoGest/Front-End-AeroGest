import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Reserva } from '../Models/Reserva';

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private readonly baseUrl = `${environment.apiUrl}/reservas`;

  constructor(private http: HttpClient) {}

  obtenerMisReservas(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(`${this.baseUrl}/mis-reservas`);
  }

  cancelar(id: number): Observable<string> {
    return this.http.patch(`${this.baseUrl}/cancelar/${id}`, {}, { responseType: 'text' });
  }
}
