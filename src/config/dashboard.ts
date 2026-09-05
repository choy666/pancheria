/**
 * Configuración del panel de control. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getDashboardRefreshIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS;
  if (!raw) return 30_000; // 30 segundos por defecto

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 30_000;
  if (parsed < 1_000) return 5_000; // mínimo práctico de 5 segundos

  return parsed;
}
