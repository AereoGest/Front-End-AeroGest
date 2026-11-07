import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckinMostradorRequest, CheckinResultado, ReservaCheckin } from '../Models/Check-in';


@Injectable({ providedIn: 'root' })
export class CheckInService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/reservas/check-in`;

  buscar(datos: CheckinMostradorRequest): Observable<ReservaCheckin> {
    return this.http.post<ReservaCheckin>(`${this.url}/buscar`, datos);
  }

  confirmar(datos: CheckinMostradorRequest): Observable<CheckinResultado> {
    return this.http.post<CheckinResultado>(`${this.url}/mostrador`, datos);
  }
}