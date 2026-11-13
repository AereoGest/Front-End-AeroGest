export type MetodoPago = 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'TRANSFERENCIA' | 'MERCADOPAGO';

/** Total vendido en un día (ya descontadas las devoluciones de reservas canceladas). */
export interface VentaDiaria {
  fecha: string;     // 'yyyy-MM-dd'
  cantidad: number;  // cantidad de transacciones
  total: number;     // monto neto: cobrado - devuelto
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
  total: number;          // monto cobrado en la factura
  montoReembolso: number; // devuelto al cliente si la reserva se canceló (0 si no)
  totalNeto: number;      // total - montoReembolso
  estadoReserva: string;
}