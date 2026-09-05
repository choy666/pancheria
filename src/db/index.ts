import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { getDatabaseUrl } from '@/config/database';
import * as schema from './schema';

type Db =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

function resolveDatabaseUrl(): string {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      'No se encontró una URL de conexión a PostgreSQL. Definí DATABASE_URL, POSTGRES_URL o POSTGRES_PRISMA_URL en las variables de entorno.'
    );
  }

  return databaseUrl;
}

function isNeonDatabase(url: string): boolean {
  return url.includes('neon.tech');
}

let dbInstance: Db | undefined;

function getDb(): Db {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = resolveDatabaseUrl();

  dbInstance = isNeonDatabase(databaseUrl)
    ? (drizzleNeon(
        new NeonPool({ connectionString: databaseUrl }),
        { schema }
      ) as Db)
    : (drizzlePg(new PgPool({ connectionString: databaseUrl }), { schema }) as Db);

  return dbInstance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
}) as Db;
