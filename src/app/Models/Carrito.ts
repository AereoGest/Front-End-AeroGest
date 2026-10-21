export type ClaseVuelo = 'TURISTA' | 'ECONOMICA' | 'BUSINESS' | 'PRIMERA';

/** Ítem del carrito tal como lo devuelve la API. */
export interface CarritoItem {
  id: number;
  carritoId: number;
  vueloId: number;
  cantidad: number;
  claseVuelo: ClaseVuelo;
}

/** Carrito tal como lo devuelve GET /api/carrito. */
export interface Carrito {
  id: number;
  personaId: number;
  items: CarritoItem[];
}
