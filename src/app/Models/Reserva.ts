import { ClaseVuelo } from './Carrito';
import { TipoDocumento } from './Perfil';

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

/** Datos de un pasajero para POST /api/reservas/mis-reservas. */
export interface PasajeRequest {
  clasesVuelo: ClaseVuelo;
  asientoId?: number;
  equipajeIds: number[];
  asistenciaId: number | null;
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  fechaNacimiento: string;
  email: string;
}

/** Cuerpo de POST /api/reservas/mis-reservas. La persona la toma el backend del usuario logueado. */
export interface ReservaRequest {
  vueloId: number;
  cantidadPasajes: number;
  pasajes: PasajeRequest[];
}
