import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Asignacion } from '../Models/Asignacion';


@Injectable({ providedIn: 'root' })
export class AsignacionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/asignacion`;

  getMisAsignaciones(): Observable<Asignacion[]> {
    return this.http.get<Asignacion[]>(`${this.apiUrl}/mias`, { withCredentials: true });
  }

    getTodas(): Observable<Asignacion[]> {
    return this.http.get<Asignacion[]>(this.apiUrl, { withCredentials: true });
  }
}