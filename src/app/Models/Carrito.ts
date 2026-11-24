export type ClaseVuelo = 'TURISTA' | 'ECONOMICA' | 'BUSINESS' | 'PRIMERA';

/** Ítem del carrito tal como lo devuelve la API. */
export interface CarritoItem {
  id: number;
  carritoId: number;
  vueloId: number;
  cantidad: number;
  claseVuelo: ClaseVuelo;
  /** Asientos libres que quedan en el vuelo (tope de pasajes). */
  asientosDisponibles?: number;
}

/** Carrito tal como lo devuelve GET /api/carrito. */
export interface Carrito {
  id: number;
  personaId: number;
  items: CarritoItem[];
}
