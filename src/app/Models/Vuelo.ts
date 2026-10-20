export type EstadoVuelo = 'PROGRAMADO' | 'BOARDING' | 'ACTIVO' | 'CANCELADO' | 'REPROGRAMADO';

export interface Aeropuerto {
  id: number;
  nombre: string;
  codigoIata: string;
  ciudad: string;
  pais: string;
}

export interface Avion {
  id: number;
  identificador: string;
  capacidadBodega: number;
  capacidadPasajeros: number;
  modelo: string;
  estado: 'DISPONIBLE' | 'MANTENIMIENTO' | 'ACTIVO' | 'BAJA';
}

export interface Vuelo {
  id: number;
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

export interface VueloFiltros {
  origen?: string;
  destino?: string;
  fechaSalida?: string;
  fechaLlegada?: string;
  precioMaximo?: number;
  escala?: boolean;
  [key: string]: any;
}
