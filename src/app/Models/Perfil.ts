export type TipoDocumento = 'DNI' | 'PASAPORTE';
export type Genero = 'MASCULINO' | 'FEMENINO' | 'OTRO';
export type Rol = 'ROLE_ADMIN' | 'ROLE_EMPLEADO' | 'ROLE_USUARIO' | 'ROLE_INCOMPLETO';

export interface Opcion<T extends string> {
  valor: T;
  etiqueta: string;
}

/** Perfil tal como lo devuelve GET /api/auth/perfil. */
export interface Perfil {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  identificador: TipoDocumento;
  numeroIdentificador: string;
  sexo: Genero | '';
  fechaNacimiento: string;
  role: Rol;
  isVerified: boolean;
  twoFactorEnabled: boolean;
}

/** Campos que el usuario puede editar desde la vista de perfil. */
export type DatosPerfil = Pick<
  Perfil,
  'nombre' | 'apellido' | 'telefono' | 'identificador' | 'numeroIdentificador' | 'sexo' | 'fechaNacimiento'
>;

export const TIPOS_DOCUMENTO: Opcion<TipoDocumento>[] = [
  { valor: 'DNI', etiqueta: 'DNI' },
  { valor: 'PASAPORTE', etiqueta: 'Pasaporte' },
];

export const GENEROS: Opcion<Genero>[] = [
  { valor: 'MASCULINO', etiqueta: 'Masculino' },
  { valor: 'FEMENINO', etiqueta: 'Femenino' },
  { valor: 'OTRO', etiqueta: 'Otro' },
];
