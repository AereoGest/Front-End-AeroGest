export interface FiltroVuelos {
  origen?: string;
  destino?: string;
  fechaSalida?: string;
  fechaLlegada?: string;
  precioMaximo?: number;
  escala?: boolean;
  [key: string]: any;
}