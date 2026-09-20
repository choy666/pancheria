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

const DEFAULT_EXPIRE_ORDERS_TIME_BUDGET_MS = 240_000;
const MIN_EXPIRE_ORDERS_TIME_BUDGET_MS = 5_000;

/**
 * Presupuesto de tiempo para una corrida del cron `expire-orders`. Al
 * agotarse, la corrida se corta dejando el resto para la próxima invocación
 * (la operación es reentrante). Default 4 minutos: queda dentro del
 * `maxDuration` de la ruta (300 s) con margen para responder.
 */
export function getExpireOrdersTimeBudgetMs(): number {
  const raw = process.env.EXPIRE_ORDERS_TIME_BUDGET_MS;
  if (!raw) return DEFAULT_EXPIRE_ORDERS_TIME_BUDGET_MS;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_EXPIRE_ORDERS_TIME_BUDGET_MS;
  }
  if (parsed < MIN_EXPIRE_ORDERS_TIME_BUDGET_MS) {
    return MIN_EXPIRE_ORDERS_TIME_BUDGET_MS;
  }

  return parsed;
}

export function getOrderRateLimitWindowMs(): number {
  const raw = process.env.PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS;
  if (!raw) return 60_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 60_000;

  return parsed;
}

export function getOrderRateLimitMaxRequests(): number {
  const raw = process.env.PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS;
  if (!raw) return 10;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return 10;

  return parsed;
}

export function getPedidosRefreshIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS;
  if (!raw) return 0; // deshabilitado por defecto

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  if (parsed < 1_000) return 10_000;

  return parsed;
}
