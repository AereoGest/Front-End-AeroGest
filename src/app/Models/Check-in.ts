export interface CheckinMostradorRequest {
  codigoReserva: string;
  documento: string;
}

export interface PasajeroCheckin {
  pasajeId: number;
  pasajero: string;
  documento: string;
  vueloId: number;
  origen: string | null;
  destino: string | null;
  fechaSalida: string; // "2026-12-15"
  horaSalida: string;  // "14:30:00"
  asiento: string | null;
}

export interface ReservaCheckin {
  reservaId: number;
  codigoReserva: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADA' | 'ACTIVO' | string;
  fechaCheckIn: string | null;
  titular: string;
  pasajes: PasajeroCheckin[];
}

export interface PasajeCheckinResultado {
  pasajeId: number;
  pasajero: string;
  vueloId: number;
  asiento: string | null;
  asignadoAutomaticamente: boolean;
}

export interface CheckinResultado {
  reservaId: number;
  fechaCheckIn: string;
  pasajes: PasajeCheckinResultado[];
}