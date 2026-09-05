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
  getPublicRateLimitTrustPrivateIps,
} from '@/config/rate-limit';

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  return value.split(',')[0].trim();
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
    // X-Forwarded-For puede contener una cadena de IPs. Si confiamos en el
    // header porque está detrás de un proxy controlado, el primer valor es la
    // IP del cliente original. X-Real-IP suele traer un solo valor.
    const trustedValue = getFirstHeaderValue(headerValue);
    if (trustedValue) return trustedValue;
  }

  // En desarrollo local sin proxy, usar X-Forwarded-For como fallback.
  if (isDevelopment()) {
    const forwarded = getFirstHeaderValue(request.headers.get('x-forwarded-for'));
    if (forwarded) return forwarded;
  }

  // Escape controlado para producción auto-alojada sin proxy confiable.
  // Usar el primer valor de X-Forwarded-For puede ser vulnerable a spoofing,
  // por eso requiere activación explícita mediante variable de entorno.
  if (isProduction() && getPublicRateLimitTrustPrivateIps()) {
    const forwarded = getFirstHeaderValue(request.headers.get('x-forwarded-for'));
    if (forwarded) return forwarded;
  }

  if (isProduction()) {
    throw new DomainError(
      'No se pudo resolver una IP confiable para aplicar rate limit. ' +
        'Configurá TRUSTED_PROXY_IP_HEADER o PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS=true si no usás Vercel.'
    );
  }

  return 'unknown';
}

export function createRateLimiter(
  scope: string,
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

    return store.recordRequest(scope, ip, windowMs, maxRequests);
  };
}
