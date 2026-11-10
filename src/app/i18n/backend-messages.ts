export const BACKEND_MESSAGES_TO_EN: Record<string, string> = {
  'Email o contraseña incorrectos': 'Incorrect email or password',
  'Tu cuenta no ha sido verificada o se encuentra desactivada.': 'Your account has not been verified or is deactivated.',
  'Tu cuenta se encuentra bloqueada.': 'Your account is locked.',
  'No autenticado': 'Not authenticated',
  'No tenés permisos para acceder a este recurso': 'You do not have permission to access this resource',
  'El email ya está registrado': 'Email is already registered',
  'El email ya se encuentra registrado': 'Email is already registered',
  'El email ya está en uso por otro usuario': 'Email is already in use by another user',
  'El número de documento ya está registrado por otro usuario.': 'Document number is already registered by another user.',
  'El número de documento ya está en uso por otro usuario': 'Document number is already in use by another user',
  'El número de documento ya se encuentra registrado': 'Document number is already registered',
  'Token de verificación inválido o ausente': 'Invalid or missing verification token',
  'Token inválido': 'Invalid token',
  'Token inválido o expirado': 'Invalid or expired token',
  'Token de restablecimiento inválido o ausente': 'Invalid or missing reset token',
  'El código 2FA ha expirado o no es válido. Vuelve a iniciar sesión.': '2FA code has expired or is invalid. Please log in again.',
  'Código 2FA incorrecto': 'Incorrect 2FA code',
  'El correo electrónico es obligatorio': 'Email is required',
  'La cuenta ya se encuentra verificada.': 'Account is already verified.',
  'La contraseña debe tener al menos 8 caracteres': 'Password must be at least 8 characters',
  'La nueva contraseña debe tener al menos 6 caracteres': 'New password must be at least 6 characters',
  'El token ha expirado. Solicita un nuevo restablecimiento.': 'Token has expired. Please request a new password reset.',
  'Usuario no encontrado': 'User not found',
  'Todos los campos son obligatorios': 'All fields are required',
  'Ya existe un registro con esos datos': 'A record with these details already exists',
  'Error de validación': 'Validation error',
  'No se pudo cargar el perfil.': 'Could not load profile.',
  'No se pudo actualizar el perfil.': 'Could not update profile.',
  'No se pudo reenviar el correo de verificación.': 'Could not resend verification email.',
  'No se pudo cambiar el 2FA.': 'Could not toggle 2FA.',
  'No podés eliminar tu propia cuenta de administrador en uso': 'You cannot delete your own admin account while in use',
  'No se puede eliminar el usuario porque tiene reservas registradas en el sistema.': 'Cannot delete user because they have reservations registered in the system.',
  'No se puede eliminar el usuario porque tiene asignaciones de vuelo registradas.': 'Cannot delete user because they have flight assignments registered.',
  'La reserva no pertenece al usuario autenticado.': 'The reservation does not belong to the authenticated user.',
  'No se puede hacer check-in de una reserva cancelada': 'Cannot check in a cancelled reservation',
  'El vuelo ya se encuentra dado de baja (CANCELADO).': 'Flight is already cancelled.',
  'No se puede dar de alta un vuelo en estado CANCELADO.': 'Cannot create a flight in CANCELLED status.',
  'La fecha y hora de salida debe ser posterior al momento actual.': 'Departure date and time must be later than the current time.',
  'El estado del vuelo es obligatorio.': 'Flight status is required.',
  'Los datos del vuelo son obligatorios.': 'Flight data is required.',
  'El aeropuerto de origen y destino son obligatorios.': 'Origin and destination airports are required.',
  'El avión es obligatorio.': 'Aircraft is required.',
  'La fecha de salida y llegada son obligatorias.': 'Departure and arrival dates are required.',
  'La hora de salida y llegada son obligatorias.': 'Departure and arrival times are required.',
  'Indicá si el vuelo es directo o con escala.': 'Please indicate if flight is direct or with layover.',
  'No hay asientos economicos disponibles en este avion': 'No economy seats available on this plane',
  'Los datos de la asignación son obligatorios': 'Assignment data is required',
  'El tipo y número de documento son obligatorios': 'Document type and number are required',
  'Los datos de la reserva son obligatorios': 'Reservation data is required',
  'El titular de la reserva es obligatorio': 'Reservation holder is required',
  'El valor de la reserva debe ser mayor o igual a cero': 'Reservation value must be greater than or equal to zero',
  'El estado de la reserva es obligatorio': 'Reservation status is required',
};

export const BACKEND_MESSAGES_TO_ES: Record<string, string> = Object.entries(
  BACKEND_MESSAGES_TO_EN
).reduce((acc, [es, en]) => {
  acc[en] = es;
  return acc;
}, {} as Record<string, string>);

const PREFIX_MAPPINGS_EN: Array<[string, string]> = [
  ['Formato de JSON inválido:', 'Invalid JSON format:'],
  ['Falta el parámetro:', 'Missing parameter:'],
  ['Método no permitido:', 'Method not allowed:'],
  ['Ruta no encontrada:', 'Route not found:'],
  ['Error interno del servidor:', 'Internal server error:'],
];

const PREFIX_MAPPINGS_ES: Array<[string, string]> = [
  ['Invalid JSON format:', 'Formato de JSON inválido:'],
  ['Missing parameter:', 'Falta el parámetro:'],
  ['Method not allowed:', 'Método no permitido:'],
  ['Route not found:', 'Ruta no encontrada:'],
  ['Internal server error:', 'Error interno del servidor:'],
];

export function translateBackendMessage(
  message: string | null | undefined,
  targetLang: 'es' | 'en'
): string {
  if (!message) return '';
  const trimmed = message.trim();

  if (targetLang === 'en') {
    if (BACKEND_MESSAGES_TO_EN[trimmed]) {
      return BACKEND_MESSAGES_TO_EN[trimmed];
    }
    for (const [esPrefix, enPrefix] of PREFIX_MAPPINGS_EN) {
      if (trimmed.startsWith(esPrefix)) {
        return trimmed.replace(esPrefix, enPrefix);
      }
    }
    return message;
  }

  if (BACKEND_MESSAGES_TO_ES[trimmed]) {
    return BACKEND_MESSAGES_TO_ES[trimmed];
  }
  for (const [enPrefix, esPrefix] of PREFIX_MAPPINGS_ES) {
    if (trimmed.startsWith(enPrefix)) {
      return trimmed.replace(enPrefix, esPrefix);
    }
  }
  return message;
}
