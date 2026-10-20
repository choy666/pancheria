/**
 * Logger estructurado para el proyecto.
 *
 * En producción emite JSON para que los agregadores de logs (Vercel, etc.)
 * puedan parsear las entradas. En desarrollo emite texto plano legible.
 * En tests se silencia para no ensuciar la salida de Jest.
 *
 * No filtra errores en producción, pero serializa el objeto Error de forma
 * controlada (mensaje y stack) para evitar exponer datos sensibles por
 * defecto. Evitar pasar objetos de request o respuesta completos en `extra`.
 */

import { isProduction, isTest } from '@/config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const isBrowser = typeof window !== 'undefined';

function shouldEmit(level: LogLevel): boolean {
  if (isTest()) return false;
  // En producción omitir logs de debug para reducir ruido.
  if (level === 'debug' && isProduction()) return false;
  return true;
}

function preparePayload(
  level: LogLevel,
  message: string,
  extra: Record<string, unknown> = {}
): LogPayload {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(extra)) {
    if (key === 'error' && value instanceof Error) {
      payload.errorMessage = redactString(value.message);
      payload.errorStack = value.stack && redactString(value.stack);
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

const SENSITIVE_KEYS = new Set([
  'token',
  'cancellationToken',
  'password',
  'authorization',
  'cookie',
]);

const SENSITIVE_QUERY_PARAM =
  /([?&](?:token|cancellationToken|password)=)[^&#\s"']*/gi;

function redactString(text: string): string {
  return text.replace(SENSITIVE_QUERY_PARAM, '$1[redacted]');
}

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) return '[redacted]';
  return typeof value === 'string' ? redactString(value) : value;
}

function writeLog(
  level: LogLevel,
  message: string,
  extra: Record<string, unknown> = {}
): void {
  if (!shouldEmit(level)) return;

  const safeMessage = redactString(message);
  const safeExtra = Object.fromEntries(
    Object.entries(extra).map(([key, value]) => [key, redactValue(key, value)])
  );
  const payload = preparePayload(level, safeMessage, safeExtra);

  // En el navegador usar siempre texto plano; en el servidor usar JSON en prod.
  if (isProduction() && !isBrowser) {
    writeConsoleLog(level, JSON.stringify(payload));
  } else {
    writeConsoleLog(level, safeMessage, safeExtra);
  }
}

function writeConsoleLog(
  level: LogLevel,
  ...args: unknown[]
): void {
  switch (level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }
}

export const logger = {
  debug: (message: string, extra?: Record<string, unknown>) =>
    writeLog('debug', message, extra),
  info: (message: string, extra?: Record<string, unknown>) =>
    writeLog('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) =>
    writeLog('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) =>
    writeLog('error', message, extra),
};

/**
 * Wrapper de compatibilidad para los consumidores actuales que usan
 * `logError`. Ahora delega en `logger.error` y acepta contexto adicional.
 */
export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  logger.error(message, { ...context, error });
}
