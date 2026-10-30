/** Asistencia al viajero tal como la devuelve GET /api/asistenciasAlViajero. */
export interface Asistencia {
  id: number;
  nombrePlan: string;
  descripcion: string;
  precio: number;
}
