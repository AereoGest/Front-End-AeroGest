import { ClaseVuelo } from './Carrito';

export default interface AsientoVista {
  id: string;
  backendId?: number;
  clase: string;
  categoria?: ClaseVuelo;
  precio?: number;
  zona: string;
  ocupado: boolean;
}