import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import {
  getDatabaseUrl,
  getDbPoolMax,
  getDbConnectionTimeoutMs,
  getDbIdleTimeoutMs,
} from '@/config/database';
import { DatabaseConnectionError } from '@/domain/errors';
import * as schema from './schema';

type Db =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

function resolveDatabaseUrl(): string {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new DatabaseConnectionError(
      'No se encontró una URL de conexión a PostgreSQL. Definí DATABASE_URL, POSTGRES_URL o POSTGRES_PRISMA_URL en las variables de entorno.'
    );
  }

  return databaseUrl;
}

function isNeonDatabase(url: string): boolean {
  return url.includes('neon.tech');
}

// Opciones del pool solo con las propiedades configuradas: sin variables
// de entorno se conservan los defaults de `pg`/`@neondatabase/serverless`.
function buildPoolOptions(databaseUrl: string): {
  connectionString: string;
  max?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
} {
  const options: {
    connectionString: string;
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  } = { connectionString: databaseUrl };

  const max = getDbPoolMax();
  if (max !== undefined) options.max = max;

  const connectionTimeoutMillis = getDbConnectionTimeoutMs();
  if (connectionTimeoutMillis !== undefined) {
    options.connectionTimeoutMillis = connectionTimeoutMillis;
  }

  const idleTimeoutMillis = getDbIdleTimeoutMs();
  if (idleTimeoutMillis !== undefined) {
    options.idleTimeoutMillis = idleTimeoutMillis;
  }

  return options;
}

let dbInstance: Db | undefined;

function getDb(): Db {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = resolveDatabaseUrl();
  const poolOptions = buildPoolOptions(databaseUrl);

  dbInstance = isNeonDatabase(databaseUrl)
    ? (drizzleNeon(new NeonPool(poolOptions), { schema }) as Db)
    : (drizzlePg(new PgPool(poolOptions), { schema }) as Db);

  return dbInstance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
}) as Db;
