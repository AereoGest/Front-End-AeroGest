import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Tarifas {
  tasaImpuesto: number;
  tasaServicio: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly baseUrl = `${environment.apiUrl}/config`;

  constructor(private http: HttpClient) {}

  obtenerTarifas(): Observable<Tarifas> {
    return this.http.get<Tarifas>(`${this.baseUrl}/tarifas`);
  }
}
