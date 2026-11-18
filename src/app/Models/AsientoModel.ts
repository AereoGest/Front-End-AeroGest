import { ClaseVuelo } from './Carrito';

export default interface AsientoModel {
  id: string;
  backendId?: number;
  clase: string;
  categoria?: ClaseVuelo;
  precio: number;
}