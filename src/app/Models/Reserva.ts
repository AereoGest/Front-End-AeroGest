export type EstadoReserva = 'ACTIVO' | 'CANCELADA' | 'PROCESANDO' | 'CONFIRMADO';

/** Reserva tal como la devuelve GET /api/reservas/mis-reservas. */
export interface Reserva {
  id: number;
  persona: {
    nombre: string;
    apellido: string;
  };
  valor: number;
  cantidadPasajes: number;
  estadoReserva: EstadoReserva;
  fechaReserva: string;
}
