export type MetodoPago = 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA' | 'MERCADOPAGO';

/** Total vendido en un día. */
export interface VentaDiaria {
  fecha: string;     // 'yyyy-MM-dd'
  cantidad: number;  // cantidad de transacciones
  total: number;     // monto cobrado
}

/** Una transacción del historial (una factura). */
export interface Transaccion {
  facturaId: number;
  fechaEmision: string; // 'yyyy-MM-ddTHH:mm:ss'
  reservaId: number;
  codigoReserva: string | null;
  cliente: string | null;
  cuil: string | null;
  cantidadPasajes: number;
  metodoDePago: MetodoPago;
  cuotas: number | null;
  total: number;
  estadoReserva: string;
}