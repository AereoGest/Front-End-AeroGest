import AsientoVista from "./AsientoVista";

export default interface FilaAsientos {
  numero: number;
  asientosIzquierda: AsientoVista[];
  asientosDerecha: AsientoVista[];
}