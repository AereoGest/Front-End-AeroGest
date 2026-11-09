import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Transaccion, VentaDiaria } from '../Models/Venta';

@Injectable({ providedIn: 'root' })
export class VentaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/facturas/admin`;

  /** Ventas por día entre dos fechas 'yyyy-MM-dd' (inclusive). */
  getVentasDiarias(desde: string, hasta: string): Observable<VentaDiaria[]> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<VentaDiaria[]>(`${this.apiUrl}/ventas-diarias`, { params, withCredentials: true });
  }

  /** Historial de transacciones entre dos fechas 'yyyy-MM-dd' (inclusive). */
  getTransacciones(desde: string, hasta: string): Observable<Transaccion[]> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<Transaccion[]>(`${this.apiUrl}/transacciones`, { params, withCredentials: true });
  }
}