import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

// Durante el build de Next.js no se realiza ninguna consulta,
// por lo que se permite un placeholder para evitar errores de inicialización.
// En runtime, DATABASE_URL debe estar definida en .env.local.
const pool = new Pool({
  connectionString:
    databaseUrl || 'postgresql://placeholder',
});

export const db = drizzle(pool, { schema });
