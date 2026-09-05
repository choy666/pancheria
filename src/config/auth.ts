/**
 * Configuración de autenticación. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

export function getAdminUsername(): string | undefined {
  return process.env.ADMIN_USERNAME;
}

export function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}
