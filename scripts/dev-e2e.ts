import dotenv from 'dotenv';
import path from 'path';
import { createRequire } from 'module';

// Cargar las variables de entorno de E2E con prioridad sobre .env.local.
dotenv.config({ path: '.env.e2e', override: true });

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
  process.argv = ['node', 'next', 'dev'];

  try {
    await import(nextBin);
  } catch (error) {
    console.error('Error al iniciar el servidor de Next.js para E2E:', error);
    process.exit(1);
  }
}

main();
