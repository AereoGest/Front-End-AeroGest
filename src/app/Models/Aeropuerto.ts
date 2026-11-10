export interface Aeropuerto {
  id: number;
  nombre: string;
  codigoIata: string;
  ciudad: string;
  pais: string;
}

/** Datos que se envían al crear o modificar un aeropuerto (POST / PUT /api/aeropuertos). */
export interface AeropuertoRequest {
  nombre: string;
  codigoIata: string;
  ciudad: string;
  pais: string;
}