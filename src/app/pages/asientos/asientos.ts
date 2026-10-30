
import { Component, OnInit, inject, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import FilaAsientos from '../../Models/FilaAsientos';
import AsientoVista from '../../Models/AsientoVista';
import AsientoModel from '../../Models/AsientoModel';

@Component({
  selector: 'app-asientos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asientos.html',
  styleUrl: './asientos.css'
})
export class Asientos implements OnInit {

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  

  basePrice = 689;
  seatsNeeded = 1;
  selectedSeats: AsientoModel[] = [];

  origen = '—';
  destino = '—';

  readonly seatPrices: Record<string, number> = {
    Primera: 300,
    Ejecutiva: 80,
    Económica: 0
  };

  readonly takenSeats = new Set([
    '1A', '1C', '2B', '2D', '3A', '4C', '5B',
    '6D', '7A', '7C', '8B', '9A', '9D', '10C',
    '11B', '12A', '13D', '14B', '15C', '16A',
    '17B', '18D', '19C', '20A'
  ]);

  filasPrimera = this.crearFilas(
    1, 2, ['A', 'C'], ['E', 'G'], 'first-class', 'Primera'
  );

  filasEjecutiva = this.crearFilas(
    3, 6, ['A', 'B', 'C'], ['D', 'E', 'F'], 'biz', 'Ejecutiva'
  );

  filasEconomica = this.crearFilas(
    7, 25, ['A', 'B', 'C'], ['D', 'E', 'F'], 'eco', 'Económica'
  );

  ngOnInit(): void {
    this.http.get<any>('/api/carrito').subscribe({
      next: (carrito) => {
        if (!carrito?.items?.length) {
          return;
        }

        this.seatsNeeded = carrito.items.reduce(
          (sum: number, item: any) => sum + item.cantidad,
          0
        );

        const primerItem = carrito.items[0];

        this.http.get<any>(`/api/vuelos/${primerItem.vueloId}`).subscribe({
          next: (vuelo) => {
            if (vuelo?.precioVuelo != null) {
              this.basePrice = Number(vuelo.precioVuelo);
            }

            this.origen = vuelo?.aeropuertoOrigen?.ciudad || '—';
            this.destino = vuelo?.aeropuertoDestino?.ciudad || '—';
          },
          error: (error) => {
            console.error('Error al cargar el vuelo:', error);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar el carrito:', error);
      }
    });
  }

  crearFilas(
    desde: number,
    hasta: number,
    izquierda: string[],
    derecha: string[],
    zona: string,
    clase: string
  ): FilaAsientos[] {
    const filas: FilaAsientos[] = [];

    for (let numero = desde; numero <= hasta; numero++) {
      filas.push({
        numero,
        asientosIzquierda: izquierda.map((columna) => ({
          id: numero + columna,
          clase,
          zona,
          ocupado: this.takenSeats.has(numero + columna)
        })),
        asientosDerecha: derecha.map((columna) => ({
          id: numero + columna,
          clase,
          zona,
          ocupado: this.takenSeats.has(numero + columna)
        }))
      });
    }

    return filas;
  }

  

toggleSeat(asiento: AsientoVista): void {
  if (asiento.ocupado) {
    alert('No se puede seleccionar: asiento ocupado');
    return;
  }

  const yaSeleccionado = this.estaSeleccionado(asiento.id);

  if (yaSeleccionado) {
    this.selectedSeats = this.selectedSeats.filter(
      (seleccionado) => seleccionado.id !== asiento.id
    );
  } else {
    if (this.selectedSeats.length >= this.seatsNeeded) {
      alert('No se puede seleccionar: se alcanzó el límite');
      return;
    }

    this.selectedSeats = [
      ...this.selectedSeats,
      {
        id: asiento.id,
        clase: asiento.clase,
        precio: this.seatPrices[asiento.clase] ?? 0
      }
    ];
  }

  sessionStorage.setItem(
    'asientos_seleccionados',
    JSON.stringify(this.selectedSeats)
  );

  this.cdr.detectChanges();
}


estaSeleccionado(id: string): boolean {
  return this.selectedSeats.some(
    (asiento) => asiento.id === id
  );
}

  get totalExtra(): number {
    return this.selectedSeats.reduce(
      (suma, asiento) => suma + asiento.precio,
      0
    );
  }

  get total(): number {
    return this.basePrice * this.seatsNeeded + this.totalExtra;
  }

  get puedeContinuar(): boolean {
    return this.selectedSeats.length === this.seatsNeeded;
  }

  get asientosTexto(): string {
    return this.selectedSeats.length
      ? this.selectedSeats.map((asiento) => asiento.id).join(', ')
      : 'Ninguno aún';
  }

  continuarPago(): void {
    if (!this.puedeContinuar) {
      return;
    }

    sessionStorage.setItem(
      'asientos_seleccionados',
      JSON.stringify(this.selectedSeats)
    );

    this.router.navigate(['/pago']);
  }
}
