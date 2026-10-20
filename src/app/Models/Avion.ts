export type EstadoAvion =  'DISPONIBLE' | 'MANTENIMIENTO' | 'ACTIVO' | 'BAJA';

export interface Avion {
  id: number;
  identificador: string,
  capacidadBodega: number,
  capacidadPasajeros: number,
  modelo: string,
  estado: EstadoAvion
}