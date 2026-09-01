import { NextRequest } from 'next/server';
import { createPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(',')[0].trim();
}

export function getClientIp(request: NextRequest): string {
  // Log temporal para depurar rate limit en CI.
  console.error('[RATE_LIMIT_DEBUG] env:', {
    NODE_ENV: process.env.NODE_ENV,
    E2E_ENABLE_RATE_LIMIT: process.env.E2E_ENABLE_RATE_LIMIT,
    PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS: process.env.PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS,
    TRUSTED_PROXY_IP_HEADER: process.env.TRUSTED_PROXY_IP_HEADER,
    'x-vercel-forwarded-for': request.headers.get('x-vercel-forwarded-for'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
  });

  // En Vercel, el header x-vercel-forwarded-for es confiable.
  if (process.env.VERCEL) {
    const vercelForwarded = getFirstHeaderValue(
      request.headers.get('x-vercel-forwarded-for')
    );
    if (vercelForwarded) return vercelForwarded;
  }

  // Permitir configurar un header de proxy confiable explícito.
  const trustedHeader = process.env.TRUSTED_PROXY_IP_HEADER;
  if (trustedHeader) {
    const trustedValue = getFirstHeaderValue(
      request.headers.get(trustedHeader.toLowerCase())
    );
    if (trustedValue) return trustedValue;
  }

  // En desarrollo local sin proxy, usar X-Forwarded-For como fallback.
  if (process.env.NODE_ENV === 'development') {
    const forwarded = getFirstHeaderValue(request.headers.get('x-forwarded-for'));
    if (forwarded) return forwarded;
  }

  return 'unknown';
}

export function createRateLimiter(
  _scope: string,
  windowMs: number,
  maxRequests: number
) {
  const store = createPublicOrderRateLimitStore();

  return async function isRateLimited(ip: string): Promise<boolean> {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.E2E_ENABLE_RATE_LIMIT !== 'true'
    ) {
      console.error('[RATE_LIMIT_DEBUG] desactivado en test por E2E_ENABLE_RATE_LIMIT');
      return false;
    }

    // En desarrollo se desactiva por defecto para evitar falsos positivos
    // por la IP compartida de loopback (127.0.0.1 / ::1). Se puede activar
    // explícitamente para pruebas manuales de rate limit.
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV !== 'true'
    ) {
      return false;
    }

    const blocked = await store.recordRequest(ip, windowMs, maxRequests);
    console.error('[RATE_LIMIT_DEBUG] recordRequest', { ip, windowMs, maxRequests, blocked });
    return blocked;
  };
}
