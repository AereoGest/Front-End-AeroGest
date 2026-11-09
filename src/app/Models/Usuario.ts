export type RolUsuario = 'ROLE_INCOMPLETO' | 'ROLE_USUARIO' | 'ROLE_EMPLEADO' | 'ROLE_ADMIN';
export type TipoIdentificador = 'DNI' | 'PASAPORTE';
export type Sexo = 'MASCULINO' | 'FEMENINO' | 'OTRO';

export interface Usuario {
  id: number;
  personaId?: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  role: RolUsuario;
  identificador?: TipoIdentificador;
  numeroIdentificador?: string;
  fechaNacimiento?: string;
  sexo?: Sexo;
}

export interface CrearUsuarioRequest {
  nombre: string;
  apellido: string;
  identificador: TipoIdentificador;
  numeroIdentificador: string;
  fechaNacimiento: string;
  sexo: Sexo;
  email: string;
  telefono: string;
  password: string;
  role: RolUsuario;
}

export interface ActualizarUsuarioRequest {
  nombre: string;
  apellido: string;
  identificador: TipoIdentificador;
  numeroIdentificador: string;
  fechaNacimiento: string;
  sexo: Sexo;
  email: string;
  telefono: string;
  password?: string;
  role: RolUsuario;
}

export interface FiltrosUsuarioRequest {
  texto?: string;
  role?: RolUsuario | 'TODOS';
  identificador?: TipoIdentificador | 'TODOS';
  numeroIdentificador?: string;
  orden?: 'NOMBRE_ASC' | 'NOMBRE_DESC' | 'RECIENTES' | 'ANTIGUOS';
}
