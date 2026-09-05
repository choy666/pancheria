/**
 * Configuración de rate limiting. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getRateLimitStoreProvider(): 'memory' | 'db' | undefined {
  const provider = process.env.RATE_LIMIT_STORE_PROVIDER;
  if (provider === 'memory' || provider === 'db') return provider;
  return undefined;
}

export function getPublicOrderRateLimitStoreProvider(): 'memory' | 'db' | undefined {
  const provider = process.env.PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER;
  if (provider === 'memory' || provider === 'db') return provider;
  return undefined;
}

export function getE2eEnableRateLimit(): boolean {
  return process.env.E2E_ENABLE_RATE_LIMIT === 'true';
}

export function getPublicOrderRateLimitEnableInDev(): boolean {
  return process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV === 'true';
}

export function getPublicRateLimitTrustPrivateIps(): boolean {
  return process.env.PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS === 'true';
}
