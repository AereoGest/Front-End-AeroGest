export type EstadoVuelo =  'DISPONIBLE' | 'MANTENIMIENTO' | 'ACTIVO' | 'BAJA';

export interface Vuelo {
  aeropuertoOrigenId: number;
  aeropuertoDestinoId: number;
  avionId: number;
  fechaSalida: string;   
  fechaLlegada: string;
  horaSalida: string;    
  horaLlegada: string;
  estado: EstadoVuelo;
  precioVuelo: number;
  escala: boolean;
}