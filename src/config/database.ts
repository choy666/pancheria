/**
 * Configuración de conexión a la base de datos. Valores leídos de variables de entorno.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL
  );
}

export function getDatabaseUrlUnpooled(): string | undefined {
  return process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING;
}

function parseOptionalPositiveInt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

/**
 * Máximo de conexiones del pool por instancia (`DATABASE_POOL_MAX`).
 * `undefined` conserva el default de la librería (~10 en `pg`).
 */
export function getDbPoolMax(): number | undefined {
  return parseOptionalPositiveInt(process.env.DATABASE_POOL_MAX);
}

/**
 * Timeout al establecer una conexión en milisegundos
 * (`DATABASE_CONNECTION_TIMEOUT_MS`). `undefined` conserva el default de
 * la librería.
 */
export function getDbConnectionTimeoutMs(): number | undefined {
  return parseOptionalPositiveInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS);
}

/**
 * Tiempo máximo de una conexión inactiva en el pool en milisegundos
 * (`DATABASE_IDLE_TIMEOUT_MS`). `undefined` conserva el default de la
 * librería.
 */
export function getDbIdleTimeoutMs(): number | undefined {
  return parseOptionalPositiveInt(process.env.DATABASE_IDLE_TIMEOUT_MS);
}
