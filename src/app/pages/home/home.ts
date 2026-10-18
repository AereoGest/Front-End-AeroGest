import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

interface Destino {
  ciudad: string;
  pais: string;
  desde: string;
  icono: string;
  opacidad: number;
  gradiente: string;
  destacado?: boolean;
}

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})

export class Home {
  // Buscador
  origen = 'Buenos Aires (EZE)';
  destino = '';
  fechaIda = '';
  pasajeros = '1 pasajero';
  clase = 'Económica';

  opcionesPasajeros = ['1 pasajero', '2 pasajeros', '3 pasajeros', '4+ pasajeros'];
  opcionesClase = ['Económica', 'Económica premium', 'Ejecutiva', 'Primera clase'];

  stats = [
    { valor: '150+', etiqueta: 'Destinos' },
    { valor: '2M+', etiqueta: 'Pasajeros' },
    { valor: '98%', etiqueta: 'Satisfacción' },
  ];

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

  constructor(private router: Router) {}

  swapAirports() {
    [this.origen, this.destino] = [this.destino, this.origen];
  }

  buscarVuelos(event: Event) {
    event.preventDefault();
    this.router.navigate(['/vuelos'], {
      queryParams: {
        origen: this.origen,
        destino: this.destino,
        fecha: this.fechaIda,
        pasajeros: this.pasajeros,
        clase: this.clase,
      },
    });
  }

  irADestino(ciudad: string) {
    this.router.navigate(['/vuelos'], { queryParams: { destino: ciudad } });
  }

  irASeccion(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
