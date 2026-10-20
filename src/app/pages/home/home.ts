import { Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, min, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Buscador } from '../../Models/Buscador';


@Component({
  imports: [FormField, RouterLink],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})

export class Home implements OnInit{

  private route = inject(ActivatedRoute)
  private router = inject(Router)

  private buscadorModel = signal<Buscador>({
    origen: "",
    destino: "",
    fechaIda: "",
    pasajeros: 0,
    clase: ""
  })

  private buscadorForm = form (this.buscadorModel, (buscador) =>{
    required(buscador.origen);
    required(buscador.pasajeros);

    min(buscador.pasajeros, 1)
  })

  beneficios = [
    {
      icono: '🛡️',
      titulo: 'Seguridad ante todo',
      desc: 'Certificados internacionales IATA. Flota moderna con estándares de seguridad de primer nivel.',
    },
    {
      icono: '💺',
      titulo: 'Máximo confort',
      desc: 'Asientos amplios, entretenimiento a bordo y gastronomía de calidad en todos los vuelos.',
    },
    {
      icono: '⏰',
      titulo: 'Puntualidad',
      desc: '95% de vuelos a tiempo. Tu tiempo es valioso y lo respetamos en cada operación.',
    },
    {
      icono: '🎁',
      titulo: 'Programa de puntos',
      desc: 'Acumulá millas en cada vuelo y canjealas por pasajes, upgrades y beneficios exclusivos.',
    },
  ];

  destinos: Destino[] = [
    { ciudad: 'París', pais: 'Francia • Europa', desde: '$890', icono: '🗼', opacidad: 0.15,
      gradiente: 'linear-gradient(160deg,#1a237e,#0d47a1,#1565c0)', destacado: true },
    { ciudad: 'Nueva York', pais: 'EE.UU. • América', desde: '$720', icono: '🗽', opacidad: 0.15,
      gradiente: 'linear-gradient(160deg,#37474f,#263238)' },
    { ciudad: 'Cancún', pais: 'México • América', desde: '$380', icono: '🌴', opacidad: 0.2,
      gradiente: 'linear-gradient(160deg,#006064,#00838f,#26c6da)' },
    { ciudad: 'Roma', pais: 'Italia • Europa', desde: '$850', icono: '🏛️', opacidad: 0.15,
      gradiente: 'linear-gradient(160deg,#bf360c,#e64a19,#ff7043)' },
    { ciudad: 'Tokio', pais: 'Japón • Asia', desde: '$1.100', icono: '⛩️', opacidad: 0.15,
      gradiente: 'linear-gradient(160deg,#ad1457,#c2185b,#e91e63)' },
  ];

  ngOnInit(): void {
  
  }

  buscarVuelos(event: Event) {
        event.preventDefault();
        const { origen, destino, fechaIda } = this.buscadorModel();
        this.router.navigate(['/vuelos'], {
        queryParams: { origen, destino, fechaSalida: fechaIda || null },
    });
  }

  swapAirports() {
     this.buscadorModel.update(b => ({ ...b, origen: b.destino, destino: b.origen }));
  }


  irADestino(ciudad: string) {
    this.router.navigate(['/vuelos'], { queryParams: { destino: ciudad } });
  }

  irASeccion(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
