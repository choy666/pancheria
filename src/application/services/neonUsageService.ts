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

/**
 * Status de la API de Neon que indican configuración inválida: la key no
 * existe, está vencida, está scopeada a otro proyecto, o el proyecto de
 * NEON_PROJECT_ID fue eliminado (Neon responde 404 también en ese caso).
 */
const NEON_CONFIG_ERROR_STATUSES = new Set([401, 403, 404]);

/** Error HTTP de la API de Neon; conserva el status para degradar config inválida. */
class NeonApiError extends Error {
  constructor(
    public readonly status: number,
    path: string
  ) {
    super(`La API de Neon respondió ${status} al consultar ${path}.`);
  }
}

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
  | { configured: false; configError?: 'invalid_credentials' }
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
    throw new NeonApiError(response.status, path);
  }
  return (await response.json()) as T;
}

/**
 * Devuelve `configured: false` si faltan NEON_API_KEY o NEON_PROJECT_ID:
 * el card del panel muestra entonces cómo habilitar el medidor en vez de
 * un error. Si la API responde 401/403/404 (key inválida, scopeada a otro
 * proyecto o proyecto eliminado) devuelve `configError: 'invalid_credentials'`
 * para que la card indique cómo regenerar la key en vez de un 500 con stack.
 * Otros fallos de la API externa lanzan Error (500 vía handler).
 */
export async function getNeonUsage(): Promise<NeonUsage> {
  const apiKey = getNeonApiKey();
  const projectId = getNeonProjectId();
  if (!apiKey || !projectId) {
    return { configured: false };
  }

  let projectRes: { project?: NeonProjectResponse } | NeonProjectResponse;
  let endpoints: NeonEndpointsResponse;
  try {
    [projectRes, endpoints] = await Promise.all([
      neonFetch<{ project?: NeonProjectResponse } | NeonProjectResponse>(
        `/projects/${projectId}`,
        apiKey
      ),
      neonFetch<NeonEndpointsResponse>(
        `/projects/${projectId}/endpoints`,
        apiKey
      ),
    ]);
  } catch (error) {
    if (
      error instanceof NeonApiError &&
      NEON_CONFIG_ERROR_STATUSES.has(error.status)
    ) {
      return { configured: false, configError: 'invalid_credentials' };
    }
    throw error;
  }
  // La API de Neon envuelve el recurso: GET /projects/{id} → { project: {...} }.
  const project =
    'project' in projectRes && projectRes.project
      ? projectRes.project
      : (projectRes as NeonProjectResponse);

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
