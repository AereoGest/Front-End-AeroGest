export type RolEmpleado = 'AZAFATA' | 'PILOTO' | 'COPILOTO';
export type EstadoVuelo = 'PROGRAMADO' | 'BOARDING' | 'ACTIVO' | 'CANCELADO' | 'REPROGRAMADO';

export interface AeropuertoAsignacion {
  id: number;
  nombre: string;
  codigoIata: string;
  ciudad: string;
  pais: string;
}

export interface AvionAsignacion {
  id: number;
  identificador: string;
  modelo: string;
  capacidadPasajeros: number;
}

export interface VueloAsignacion {
  id: number;
  aeropuertoOrigen: AeropuertoAsignacion;
  aeropuertoDestino: AeropuertoAsignacion;
  avion: AvionAsignacion;
  fechaSalida: string;   // 'yyyy-MM-dd'
  fechaLlegada: string;
  horaSalida: string;    // 'HH:mm:ss'
  horaLlegada: string;
  estado: EstadoVuelo;
  escala?: boolean;
}

export interface Asignacion {
  id: number;
  vuelo: VueloAsignacion;
  empleado?: EmpleadoAsignacion;
  rolEmpleado: RolEmpleado;
}

export interface EmpleadoAsignacion {
  id: number;
  nombre: string;
  apellido: string;
  identificador?: 'DNI' | 'PASAPORTE';
  numeroIdentificador?: string;
}

export interface AsignacionRequest {
  vueloId: number;
  empleadoId: number;
  rolEmpleado: RolEmpleado;
}
