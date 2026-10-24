/**
 * Configuración de la integración con la API de Neon (consumo del proyecto).
 * Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getNeonApiKey(): string | undefined {
  return process.env.NEON_API_KEY?.trim() || undefined;
}

export function getNeonProjectId(): string | undefined {
  return process.env.NEON_PROJECT_ID?.trim() || undefined;
}

export function getNeonApiBaseUrl(): string {
  return (
    process.env.NEON_API_BASE_URL?.trim() || 'https://console.neon.tech/api/v2'
  );
}

/**
 * Techo de compute del plan en CU-horas por ciclo de consumo. Default 100,
 * el free tier de Neon; configurarlo si el proyecto cambia de plan.
 */
export function getNeonQuotaCuHours(): number {
  const raw = process.env.NEON_COMPUTE_QUOTA_CU_HOURS?.trim();
  if (!raw) return 100;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}
