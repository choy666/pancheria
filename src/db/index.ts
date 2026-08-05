import dotenv from 'dotenv';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// Cargar .env.local para scripts que corren fuera de Next.js (seed, drizzle-kit).
// En Vercel el archivo no existe, por lo que dotenv no hace nada y process.env
// sigue viniendo de las variables configuradas en la plataforma.
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

// En runtime DATABASE_URL debe estar definida en las variables de entorno.
// El placeholder permite que el build de Next.js no falle si aún no está cargada.
const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://placeholder',
});

export const db = drizzle(pool, { schema });
