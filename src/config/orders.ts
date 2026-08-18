/**
 * Configuración de pedidos. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getOrderExpirationMs(): number {
  const raw = process.env.ORDER_EXPIRATION_MS;
  if (!raw) return 3_600_000; // 1 hora por defecto

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 60_000) {
    // Mínimo 1 minuto para evitar expiraciones agresivas por configuración errónea.
    return 3_600_000;
  }

  return parsed;
}
