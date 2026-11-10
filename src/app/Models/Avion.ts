export type EstadoAvion =  'DISPONIBLE' | 'MANTENIMIENTO' | 'ACTIVO' | 'BAJA';

export interface Avion {
  id: number;
  identificador: string,
  capacidadBodega: number,
  capacidadPasajeros: number,
  modelo: string,
  estado: EstadoAvion
}

/** Cuerpo que espera el backend para el alta (POST) y la modificación (PUT) de un avión. */
export interface AvionRequest {
  identificador: string;      // formato LV-A + números (ej. LV-A25)
  modelo: string;
  capacidadPasajeros: number;
  capacidadBodega: number;    // en kg
  estado?: EstadoAvion;       // en el alta, si no se envía queda DISPONIBLE
}
