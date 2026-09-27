/**
 * Configuración de autenticación. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

/**
 * Coste de bcrypt para hashear contraseñas (seed y servicios de usuario).
 * 12 ≈ ~250 ms por hash en instancias serverless: el margen sobre cost 10
 * compensa el impacto en el login sin acercarse a timeouts. Los hashes
 * existentes con cost 10 siguen verificando correctamente porque el coste
 * viaja embebido en el hash (`$2b$10$...`).
 */
export const BCRYPT_HASH_COST = 12;

export function getAdminUsername(): string | undefined {
  return process.env.ADMIN_USERNAME;
}

export function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}
