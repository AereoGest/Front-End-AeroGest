export type TipoDocumento = 'DNI' | 'PASAPORTE';
export type Genero = 'MASCULINO' | 'FEMENINO' | 'OTRO';
export type Rol = 'ROLE_ADMIN' | 'ROLE_EMPLEADO' | 'ROLE_USUARIO' | 'ROLE_INCOMPLETO';

export interface Opcion<T extends string> {
  valor: T;
  etiqueta: string;
}

export interface Perfil {
  personaId: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  numeroIdentificador: string | null;
  identificador: TipoDocumento | null;
  fechaNacimiento: string | null;
  sexo: Genero | null;
  twoFactorEnabled: boolean;
  isVerified: boolean;
  role: Rol;
}

export interface DatosPerfil {
  nombre: string;
  apellido: string;
  telefono: string;
  identificador: TipoDocumento | '';
  numeroIdentificador: string;
  sexo: Genero | '';
  fechaNacimiento: string;
}

export interface AuthResponse {
  token: string | null;
  email: string;
  userId: number;
  perfilCompleto: boolean;
  requires2fa: boolean;
  role?: Rol;
}

export const TIPOS_DOCUMENTO: Opcion<TipoDocumento>[] = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
];

export const GENEROS: Opcion<Genero>[] = [
  { valor: 'MASCULINO', etiqueta: 'Masculino' },
  { valor: 'FEMENINO', etiqueta: 'Femenino' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];
