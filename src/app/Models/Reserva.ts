import { ClaseVuelo } from './Carrito';
import { TipoDocumento } from './Perfil';

export type EstadoReserva = 'ACTIVO' | 'CANCELADA' | 'PROCESANDO' | 'CONFIRMADO';

/** Persona asociada como titular de una reserva o listada en GET /api/personas. */
export interface PersonaResumen {
  id: number;
  nombre: string;
  apellido: string;
  identificador?: TipoDocumento | null;
  numeroIdentificador?: string | null;
  email?: string | null;
}

/** Pasaje tal como viene dentro de cada reserva en GET /api/reservas o GET /api/pasajes/reserva/{id}. */
export interface PasajeReserva {
  id: number;
  codigoReserva: string | null;
  codigoPasaje: string;
  clasesVuelo: ClaseVuelo;
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  fechaNacimiento: string | null;
  email: string | null;
  asiento: {
    id: number;
    codigo: string;
    precioExtra: number | null;
  } | null;
  vuelo: {
    id: number;
    aeropuertoOrigen: { codigoIata: string; ciudad: string };
    aeropuertoDestino: { codigoIata: string; ciudad: string };
    avion?: { id: number; modelo?: string; identificador?: string };
    fechaSalida: string;   // yyyy-mm-dd
    horaSalida: string;    // HH:mm:ss
    fechaLlegada: string;
    horaLlegada: string;
    precioVuelo?: number;
  };
  equipajes: {
    id: number;
    tipo: 'CABINA' | 'BODEGA' | 'MANO';
    peso: number | null;
    precio?: number | null;
  }[];
  asistenciaAlViajero: {
    id: number;
    nombrePlan: string;
    precio?: number | null;
  } | null;
}

/** Reserva tal como la devuelve GET /api/reservas o GET /api/reservas/mis-reservas. */
export interface Reserva {
  id: number;
  codigoReserva: string | null;
  persona: {
    id?: number;
    nombre: string;
    apellido: string;
    identificador?: TipoDocumento | null;
    numeroIdentificador?: string | null;
    email?: string | null;
  };
  valor: number;
  cantidadPasajes: number;
  estadoReserva: EstadoReserva;
  fechaReserva: string;
  fechaCheckIn?: string | null;
  pasajes?: PasajeReserva[];
}

/** Respuesta de POST /api/reservas/mis-reservas/{id}/check-in. */
export interface CheckInResponse {
  reservaId: number;
  fechaCheckIn: string;
  pasajes: {
    pasajeId: number;
    pasajero: string;
    vueloId: number;
    asiento: string;
    asignadoAutomaticamente: boolean;
  }[];
}

/** Datos de un pasajero para POST /api/reservas o POST /api/reservas/mis-reservas. */
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

/** Cuerpo de POST /api/reservas (Admin). Incluye personaId del titular seleccionado. */
export interface ReservaAdminRequest extends ReservaRequest {
  personaId: number;
}

/** Cuerpo de PUT /api/reservas/{id} (Admin). */
export interface ReservaUpdateDTO {
  clienteId: number;
  valor: number;
  cantidadPasajes?: number;
  estadoReserva: EstadoReserva;
  fechaReserva?: string;
}

/** Cuerpo de PUT /api/pasajes/{id} (Admin). */
export interface PasajeUpdateDTO {
  codigoPasaje?: string | null;
  reservaId: number;
  vueloId: number;
  asientoId: number | null;
  clasesVuelo: ClaseVuelo;
  equipajeIds: number[];
  asistenciaId: number | null;
  nombre: string;
  apellido: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  fechaNacimiento: string | null;
  email: string | null;
}
