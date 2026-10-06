/**
 * Configuración de la auditoría de cordura (`GET /api/cron/sanity-audit`).
 * Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

const DEFAULT_STALE_PENDING_MAX_AGE_HOURS = 24;

/**
 * Edad máxima tolerada para un pedido `pending` ya vencido que todavía no fue
 * barrido ni por la expiración lazy ni por el scheduler externo. Superada, la
 * auditoría lo reporta con severidad `warning`: indica que el scheduler no
 * corrió en ese lapso y que nadie leyó el pedido (el barrido efectivo queda
 * en manos del próximo acceso o de la próxima corrida del workflow).
 */
export function getSanityAuditStalePendingMaxAgeHours(): number {
  const raw = process.env.SANITY_AUDIT_STALE_PENDING_MAX_AGE_HOURS;
  if (!raw) return DEFAULT_STALE_PENDING_MAX_AGE_HOURS;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_STALE_PENDING_MAX_AGE_HOURS;
  }
  return parsed;
}

const DEFAULT_AUDIT_SAMPLE_LIMIT = 50;

/**
 * Tope de filas de muestra que devuelve la auditoría por hallazgo, para no
 * inflar el payload cuando un chequeo encuentra muchas coincidencias.
 */
export function getSanityAuditSampleLimit(): number {
  const raw = process.env.SANITY_AUDIT_SAMPLE_LIMIT;
  if (!raw) return DEFAULT_AUDIT_SAMPLE_LIMIT;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_AUDIT_SAMPLE_LIMIT;
  return Math.floor(parsed);
}
