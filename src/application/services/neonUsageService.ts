/**
 * Consulta el consumo de compute del proyecto Neon vía su API de control.
 * Solo datos de lectura: sirve para mostrar en el panel cuántas CU-horas
 * del ciclo mensual se usaron y cuántas quedan antes de quedarse sin cuota
 * (plan free = 100 CU-h; una vez agotada, Neon corta la base).
 */

import {
  getNeonApiBaseUrl,
  getNeonApiKey,
  getNeonProjectId,
  getNeonQuotaCuHours,
} from '@/config/neon';

const REQUEST_TIMEOUT_MS = 8000;

type NeonProjectResponse = {
  name?: string;
  compute_time_seconds?: number;
  active_time_seconds?: number;
  consumption_period_start?: string;
  consumption_period_end?: string;
};

type NeonEndpointsResponse = {
  endpoints?: Array<{
    type?: string;
    autoscaling_limit_min_cu?: number;
    autoscaling_limit_max_cu?: number;
    current_state?: string;
  }>;
};

export type NeonUsage =
  | { configured: false }
  | {
      configured: true;
      projectName: string | null;
      usedCuHours: number;
      quotaCuHours: number;
      remainingCuHours: number;
      usedPercent: number;
      computeSeconds: number;
      activeSeconds: number;
      cuSize: number;
      periodStart: string | null;
      periodEnd: string | null;
    };

async function neonFetch<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${getNeonApiBaseUrl()}${path}`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(
      `La API de Neon respondió ${response.status} al consultar ${path}.`
    );
  }
  return (await response.json()) as T;
}

/**
 * Devuelve `configured: false` si faltan NEON_API_KEY o NEON_PROJECT_ID:
 * el card del panel muestra entonces cómo habilitar el medidor en vez de
 * un error. Ante un fallo de la API externa lanza Error (502 vía handler).
 */
export async function getNeonUsage(): Promise<NeonUsage> {
  const apiKey = getNeonApiKey();
  const projectId = getNeonProjectId();
  if (!apiKey || !projectId) {
    return { configured: false };
  }

  const [project, endpoints] = await Promise.all([
    neonFetch<NeonProjectResponse>(`/projects/${projectId}`, apiKey),
    neonFetch<NeonEndpointsResponse>(`/projects/${projectId}/endpoints`, apiKey),
  ]);

  const rwEndpoint = endpoints.endpoints?.find((e) => e.type === 'read_write');
  const cuSize =
    rwEndpoint?.autoscaling_limit_min_cu ??
    rwEndpoint?.autoscaling_limit_max_cu ??
    0.25;

  const computeSeconds = project.compute_time_seconds ?? 0;
  const quotaCuHours = getNeonQuotaCuHours();
  const usedCuHours = (computeSeconds * cuSize) / 3600;

  return {
    configured: true,
    projectName: project.name ?? null,
    usedCuHours,
    quotaCuHours,
    remainingCuHours: Math.max(0, quotaCuHours - usedCuHours),
    usedPercent: quotaCuHours > 0 ? (usedCuHours / quotaCuHours) * 100 : 0,
    computeSeconds,
    activeSeconds: project.active_time_seconds ?? 0,
    cuSize,
    periodStart: project.consumption_period_start ?? null,
    periodEnd: project.consumption_period_end ?? null,
  };
}
