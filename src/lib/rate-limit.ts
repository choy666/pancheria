import { NextRequest } from 'next/server';
import { DomainError } from '@/domain/errors';
import { createPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';
import {
  isProduction,
  isTest,
  isDevelopment,
  isVercel,
  getTrustedProxyIpHeader,
} from '@/config/env';
import {
  getE2eEnableRateLimit,
  getPublicOrderRateLimitEnableInDev,
} from '@/config/rate-limit';

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(',')[0].trim();
}

function getLastHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split(',');
  return parts[parts.length - 1].trim();
}

export function getClientIp(request: NextRequest): string {
  // En Vercel, el header x-vercel-forwarded-for es confiable.
  if (isVercel()) {
    const vercelForwarded = getFirstHeaderValue(
      request.headers.get('x-vercel-forwarded-for')
    );
    if (vercelForwarded) return vercelForwarded;
  }

  // Permitir configurar un header de proxy confiable explícito.
  const trustedHeader = getTrustedProxyIpHeader();
  if (trustedHeader) {
    const headerValue = request.headers.get(trustedHeader.toLowerCase());
    // X-Forwarded-For puede contener una cadena de IPs; el proxy más cercano
    // agrega la IP al final, por lo que se usa el último valor para evitar spoofing.
    const isForwardedFor =
      trustedHeader.toLowerCase() === 'x-forwarded-for' ||
      trustedHeader.toLowerCase() === 'x-real-ip';
    const trustedValue = isForwardedFor
      ? getLastHeaderValue(headerValue)
      : getFirstHeaderValue(headerValue);
    if (trustedValue) return trustedValue;
  }

  // En desarrollo local sin proxy, usar X-Forwarded-For como fallback.
  if (isDevelopment()) {
    const forwarded = getFirstHeaderValue(request.headers.get('x-forwarded-for'));
    if (forwarded) return forwarded;
  }

  if (isProduction()) {
    throw new DomainError(
      'No se pudo resolver una IP confiable para aplicar rate limit. ' +
        'Configurá TRUSTED_PROXY_IP_HEADER si no usás Vercel.'
    );
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
    if (isTest() && !getE2eEnableRateLimit()) {
      return false;
    }

    // En desarrollo se desactiva por defecto para evitar falsos positivos
    // por la IP compartida de loopback (127.0.0.1 / ::1). Se puede activar
    // explícitamente para pruebas manuales de rate limit.
    if (isDevelopment() && !getPublicOrderRateLimitEnableInDev()) {
      return false;
    }

    return store.recordRequest(ip, windowMs, maxRequests);
  };
}
