import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local de forma dinámica.
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
