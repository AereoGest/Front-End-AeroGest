import { EstadoReserva } from './Reserva';

export type SituacionFiscal = 'Consumidor Final' | 'Responsable Inscripto' | 'Monotributista' | 'Exento';

/** Cuerpo de POST /api/reservas/mis-reservas/{id}/pagar. El token lo genera el SDK de Mercado Pago. */
export interface PagoRequest {
  token: string;
  installments: number;
  paymentMethodId: string;
  issuerId: string | null;
  payerEmail: string;
  payerDocType: string;
  payerDocNumber: string;
  cuil: string;
  situacionFiscal: SituacionFiscal;
}

/** Respuesta del pago. status es el de Mercado Pago: approved, rejected, in_process, pending. */
export interface PagoResponse {
  status: string;
  statusDetail: string | null;
  codigoReserva: string;
  estadoReserva: EstadoReserva;
}
