/**
 * Configuración de cron. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}
