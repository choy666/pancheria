import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local de forma dinámica.
// En Vercel el archivo no existe, por lo que dotenv no hace nada y process.env
// sigue viniendo de las variables configuradas en la plataforma.
dotenv.config({ path: '.env.local' });

function resolveDatabaseUrl(): string {
  const candidate =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;

  if (!candidate) {
    throw new Error(
      'No se encontró una URL de conexión a PostgreSQL. Definí DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL o POSTGRES_URL en las variables de entorno.'
    );
  }

  return candidate;
}

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
