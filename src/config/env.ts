/**
 * Configuración del entorno de ejecución. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

import { getDatabaseUrl } from './database';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

export function isDevelopment(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'development';
}

export function isVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

export function getTrustedProxyIpHeader(): string | undefined {
  const header = process.env.TRUSTED_PROXY_IP_HEADER;
  if (!header) return undefined;
  return header.trim();
}

export function hasDatabaseUrl(): boolean {
  return Boolean(getDatabaseUrl());
}
