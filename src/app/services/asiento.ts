import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Asiento {
  id: number;
  codigo: string;
  precioExtra: number;
  avionId: number;
  ocupado: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AsientoService {
  private readonly baseUrl = `${environment.apiUrl}/asientos`;

  constructor(private http: HttpClient) {}

  obtenerPorAvion(avionId: number): Observable<Asiento[]> {
    return this.http.get<Asiento[]>(`${this.baseUrl}/avion/${avionId}`);
  }

  verificarDisponibilidad(ids: number[]): Observable<Record<number, boolean>> {
    return this.http.post<Record<number, boolean>>(`${this.baseUrl}/verificar`, ids);
  }
}
