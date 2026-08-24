import { db } from '../../src/db';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import { rmSync } from 'fs';
import path from 'path';
import { setupSecondBranchForE2E } from './helpers';

function getDatabaseUrlForE2E(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    ''
  );
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/\/\/[^@]+@/, '//***@');
}

function isAllowedE2EDatabase(url: string): boolean {
  if (!url) return false;

  // Localhost o conexión por socket Unix: seguro para tests.
  const isLocalhost = /\/\/(?:[^@]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(
    url
  );
  if (isLocalhost) return true;

  // Bases remotas explícitamente marcadas como descartables.
  const pathMatch = url.match(/\/([^/?]+)(?:\?|$)/);
  const dbName = pathMatch?.[1] ?? '';
  if (/(^|[-_.])(test|e2e|testing|qa|staging)([-_.]?|\d*)$/i.test(dbName)) {
    return true;
  }

  // Neon branch con sufijo de test/e2e en el hostname.
  const hostMatch = url.match(/@([^/:]+)/);
  const host = hostMatch?.[1] ?? '';
  if (/(^|[-_.])(test|e2e|testing|qa|staging)([-_.]?|\d*)\./i.test(host)) {
    return true;
  }

  return false;
}

function isAllowedE2EStoragePath(storagePath?: string): boolean {
  if (!storagePath) return true;

  const normalized = path.resolve(storagePath);
  const cwd = path.resolve(process.cwd());
  const isInsideCwd = normalized === cwd || normalized.startsWith(cwd + path.sep);
  const isInsideTmp =
    normalized.includes(`${path.sep}tmp${path.sep}`) ||
    normalized.includes(`${path.sep}temp${path.sep}`);
  const isE2ELabeled =
    normalized.includes('e2e') ||
    normalized.includes('test');

  return isInsideCwd && (isInsideTmp || isE2ELabeled);
}

function validateE2EEnvironment(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'El global setup de E2E debe ejecutarse con NODE_ENV=test. ' +
        'Corré los tests con `npm run test:e2e` o `npx playwright test`.'
    );
  }

  const databaseUrl = getDatabaseUrlForE2E();

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL no está definida para los tests E2E. ' +
        'Configurala en .env.e2e apuntando a una base de datos descartable.'
    );
  }

  const allowRemote = process.env.E2E_ALLOW_REMOTE_DB === 'true';
  if (!isAllowedE2EDatabase(databaseUrl) && !allowRemote) {
    throw new Error(
      `La base de datos configurada para E2E no parece ser descartable: ${maskDatabaseUrl(
        databaseUrl
      )}. ` +
        'Usá una base local o un nombre que termine en test/e2e/qa/staging, ' +
        'o definí E2E_ALLOW_REMOTE_DB=true si estás seguro.'
    );
  }

  const storagePath = process.env.LOCAL_STORAGE_PATH;
  if (storagePath && !isAllowedE2EStoragePath(storagePath)) {
    throw new Error(
      `LOCAL_STORAGE_PATH para E2E apunta a un directorio inseguro: ${storagePath}. ` +
        'Debe estar dentro del proyecto y bajo tmp/ o contener "e2e"/"test" en la ruta.'
    );
  }
}

export default async function globalSetup() {
  if (process.env.NO_GLOBAL_SETUP) {
    return;
  }

  validateE2EEnvironment();

  if (process.env.LOCAL_STORAGE_PATH) {
    rmSync(process.env.LOCAL_STORAGE_PATH, { recursive: true, force: true });
  }

  await db.execute(sql`
    TRUNCATE TABLE
      sale_items,
      order_items,
      order_messages,
      stock_movements,
      sales,
      orders,
      recipes,
      products,
      videos,
      cash_registers,
      daily_closures,
      public_order_rate_limits,
      login_attempts,
      users,
      branches
    RESTART IDENTITY CASCADE;
  `);

  execSync('npx tsx src/db/seeds.ts', { cwd: process.cwd(), stdio: 'inherit' });

  if (!process.env.NEW_BRANCH_NAME) {
    try {
      const second = await setupSecondBranchForE2E();
      console.log(`Sucursal de E2E creada: ${second.branchName} (id: ${second.branchId})`);
      console.log(`Operador de E2E: ${second.username}`);
    } catch (error) {
      console.error('Error creando la sucursal/operador de prueba:', error);
      throw error;
    }
  }
}
