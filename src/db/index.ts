import dotenv from 'dotenv';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import * as schema from './schema';

// Cargar .env.local para scripts que corren fuera de Next.js (seed, drizzle-kit).
// En Vercel el archivo no existe, por lo que dotenv no hace nada y process.env
// sigue viniendo de las variables configuradas en la plataforma.
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

// En runtime DATABASE_URL debe estar definida en las variables de entorno.
if (!databaseUrl) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno.');
}

function isNeonDatabase(url: string): boolean {
  return url.includes('neon.tech');
}

const db = isNeonDatabase(databaseUrl)
  ? drizzleNeon(new NeonPool({ connectionString: databaseUrl }), { schema })
  : drizzlePg(new PgPool({ connectionString: databaseUrl }), { schema });

export { db };
