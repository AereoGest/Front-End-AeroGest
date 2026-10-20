import { inject, Service } from '@angular/core';
import { Buscador } from '../Models/Buscador';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FiltroVuelos } from '../Models/FiltroVuelos';
import { Vuelo } from '../Models/Vuelo';

@Service()
export class HomeService {

    private http = inject(HttpClient)
    private url = ""
    
    buscar (filtro : FiltroVuelos) : Observable<Vuelo[]>{

        let params = new HttpParams();
        if (filtro.origen?.trim()) params = params.set('origen', filtro.origen.trim());
        if (filtro.destino?.trim()) params = params.set('destino', filtro.destino.trim());
        if (filtro.fechaSalida) params = params.set('fechaSalida', `${filtro.fechaSalida}T00:00:00`);

    return this.http.get<Vuelo[]>(`${this.url}/disponibles/filtrar`, { params });
  }
    }

}
