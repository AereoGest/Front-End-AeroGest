import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Asistencia } from '../Models/Asistencia';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaService {
  private readonly baseUrl = `${environment.apiUrl}/asistenciasAlViajero`;

  constructor(private http: HttpClient) {}

  obtenerTodas(): Observable<Asistencia[]> {
    return this.http.get<Asistencia[]>(this.baseUrl);
  }
}
