import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

// Cargar .env.local como base y luego .env.e2e con prioridad.
// Se ignoran las entradas vacías de .env.e2e para evitar que dotenv pise
// valores de .env.local con cadenas vacías (comportamiento de override).
dotenv.config({ path: '.env.local' });

try {
  const e2ePath = path.resolve('.env.e2e');
  const e2eEnv = dotenv.parse(fs.readFileSync(e2ePath));
  for (const [key, value] of Object.entries(e2eEnv)) {
    if (value.trim() !== '') {
      process.env[key] = value;
    }
  }
} catch {
  // Si .env.e2e no existe, .env.local sigue siendo la fuente.
}

function resolveNextBin(): string {
  const require = createRequire(import.meta.url);
  const nextPkgPath = require.resolve('next/package.json');
  const nextPkg = require(nextPkgPath) as {
    bin: string | { next: string };
  };

  const binEntry =
    typeof nextPkg.bin === 'string' ? nextPkg.bin : nextPkg.bin.next;

  if (!binEntry) {
    throw new Error('No se pudo resolver el binario de Next.js.');
  }

  return path.resolve(path.dirname(nextPkgPath), binEntry);
}

async function main() {
  const nextBin = resolveNextBin();

  // El binario de Next espera argv[2] como comando (dev, build, start, etc.).
  // Se usa --turbopack para la compilación rápida en E2E. El flag está
  // explícito por claridad aunque sea el modo por defecto en Next.js 16.
  process.argv = ['node', 'next', 'dev', '--turbopack'];

  try {
    await import(pathToFileURL(nextBin).href);
  } catch (error) {
    console.error('Error al iniciar el servidor de Next.js para E2E:', error);
    process.exit(1);
  }
}

main();
