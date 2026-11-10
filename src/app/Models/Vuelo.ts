
import { Aeropuerto } from "./Aeropuerto";
import { Avion } from "./Avion";

export type EstadoVuelo =  'PROGRAMADO' | 'BOARDING' | 'ACTIVO' | 'CANCELADO' | 'REPROGRAMADO';

export interface Vuelo {
  id?: string,
  aeropuertoOrigen: Aeropuerto;
  aeropuertoDestino: Aeropuerto;
  avion: Avion;
  fechaSalida: string;   
  fechaLlegada: string;
  horaSalida: string;
  horaLlegada: string;
  estado: EstadoVuelo;
  precioVuelo: number;
  escala: boolean;
}

/** Respuesta de GET /api/vuelos/{id}/impacto-cancelacion: qué pasa con los clientes si se cancela el vuelo. */
export interface ImpactoCancelacion {
  reservas: number;
  pasajeros: number;
  montoReembolso: number;   // 100% de lo pagado
}

/** Respuesta de POST /api/vuelos/validar */
export interface ValidacionVuelo {
  valido: boolean;
  mensaje: string | null;
}

/** Cuerpo que espera el backend para el alta (POST) y la modificación (PUT) de un vuelo. */
export interface VueloRequest {
  aeropuertoOrigenId: number;
  aeropuertoDestinoId: number;
  avionId: number;
  fechaSalida: string;   // yyyy-MM-dd
  fechaLlegada: string;  // yyyy-MM-dd
  horaSalida: string;    // HH:mm
  horaLlegada: string;   // HH:mm
  estado?: EstadoVuelo;  // en el alta, si no se envía queda PROGRAMADO
  precioVuelo: number;
  escala: boolean;
}
