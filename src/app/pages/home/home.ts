import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n';

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
  imports: [FormsModule, RouterLink, TranslatePipe],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  // Buscador
  origen = 'Buenos Aires (EZE)';
  destino = '';
  fechaIda = '';
  pasajeros = '1';
  clase = 'Económica';

  opcionesPasajeros = ['1', '2', '3', '4+'];
  opcionesClase = ['Económica', 'Económica premium', 'Ejecutiva', 'Primera clase'];

  stats = [
    { valor: '150+', etiquetaKey: 'home.statDestinations' },
    { valor: '2M+', etiquetaKey: 'home.statPassengers' },
    { valor: '98%', etiquetaKey: 'home.statSatisfaction' },
  ];

  beneficios = [
    {
      icono: '🛡️',
      tituloKey: 'home.whySecurity',
      descKey: 'home.whySecurityDesc',
    },
    {
      icono: '💺',
      tituloKey: 'home.whyComfort',
      descKey: 'home.whyComfortDesc',
    },
    {
      icono: '⏰',
      tituloKey: 'home.whyPunctuality',
      descKey: 'home.whyPunctualityDesc',
    },
    {
      icono: '🎁',
      tituloKey: 'home.whyPoints',
      descKey: 'home.whyPointsDesc',
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

  swapAirports() {
    [this.origen, this.destino] = [this.destino, this.origen];
  }

  buscarVuelos(event: Event) {
    event.preventDefault();
    this.router.navigate(['/vuelos'], {
      queryParams: {
        origen: this.limpiarCiudad(this.origen),
        destino: this.limpiarCiudad(this.destino),
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

  private limpiarCiudad(valor: string): string {
    return valor
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
      .trim();
  }
}
