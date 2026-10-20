
import { Aeropuerto } from "./Aeropuerto";
import { Avion } from "./Avion";

export type EstadoVuelo =  'PROGRAMADO' | 'BOARDING' | 'ACTIVO' | 'CANCELADO' | 'REPROGRAMADO';

export interface Vuelo {
  id?: string,
  aeropuertoOrigenId: Aeropuerto;
  aeropuertoDestinoId: Aeropuerto;
  avion: Avion;
  fechaSalida: string;   
  fechaLlegada: string;
  horaSalida: string;
  horaLlegada: string;
  estado: EstadoVuelo;
  precioVuelo: number;
  escala: boolean;
}
