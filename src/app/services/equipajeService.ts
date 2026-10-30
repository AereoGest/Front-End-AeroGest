import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Equipaje } from '../Models/Equipaje';

@Injectable({
  providedIn: 'root'
})
export class EquipajeService {
  private readonly baseUrl = `${environment.apiUrl}/equipajes`;

  constructor(private http: HttpClient) {}

  obtenerTodos(): Observable<Equipaje[]> {
    return this.http.get<Equipaje[]>(this.baseUrl);
  }
}
