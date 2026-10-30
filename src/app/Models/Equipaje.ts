export type TipoEquipaje = 'CABINA' | 'BODEGA' | 'MANO';

/** Equipaje tal como lo devuelve GET /api/equipajes. */
export interface Equipaje {
  id: number;
  peso: number;
  tipo: TipoEquipaje;
  precio: number;
}
