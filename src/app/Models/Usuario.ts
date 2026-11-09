export type RolUsuario = 'ROLE_INCOMPLETO' | 'ROLE_USUARIO' | 'ROLE_EMPLEADO' | 'ROLE_ADMIN';

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  role: RolUsuario;
}