import { db } from '../../src/db';
import { sql, eq } from 'drizzle-orm';
import { products } from '../../src/db/schema';
import { execSync } from 'child_process';
import { rmSync } from 'fs';
import http from 'http';
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

  const pathMatch = url.match(/\/([^/?]+)(?:\?|$)/);
  const dbName = pathMatch?.[1] ?? '';
  const isSafeName =
    /(^|[-_.])(test|e2e|testing|qa|staging)([-_.]?|\d*)$/i.test(dbName);

  // Bases locales sin nombre seguro NO son permitidas. El nombre debe terminar
  // en test/e2e/qa/staging para evitar truncar por accidente una base de
  // desarrollo cuando falta .env.e2e y se cae a .env.local.
  const isLocalhost = /\/\/(?:[^@]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(
    url
  );
  if (isLocalhost) {
    return isSafeName;
  }

  // Bases remotas explícitamente marcadas como descartables por nombre.
  if (isSafeName) {
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

  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    throw new Error(
      'Falta el secreto de autenticación (AUTH_SECRET o NEXTAUTH_SECRET) para los tests E2E. ' +
        'Configuralo en .env.e2e o en los repository secrets de GitHub Actions.'
    );
  }

  if (authSecret.length < 32) {
    throw new Error(
      'El secreto de autenticación para E2E debe tener al menos 32 caracteres. ' +
        'Generalo con "npx auth secret" o "openssl rand -base64 32".'
    );
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    throw new Error(
      'Faltan ADMIN_USERNAME y/o ADMIN_PASSWORD para los tests E2E. ' +
        'El seed del administrador las requiere. Configuralas en .env.e2e o en los repository secrets de GitHub Actions.'
    );
  }

  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!authUrl) {
    throw new Error(
      'Falta la URL de autenticación (AUTH_URL o NEXTAUTH_URL) para los tests E2E. ' +
        'Debe apuntar a http://localhost:3000.'
    );
  }
}

function fetchOnce(
  url: string,
  options: { method?: string; body?: string } = {}
): Promise<number> {
  return new Promise((resolve) => {
    const method = options.method ?? 'GET';
    const clientUrl = new URL(url);
    const req = http.request(
      {
        hostname: clientUrl.hostname,
        port: clientUrl.port,
        path: clientUrl.pathname + clientUrl.search,
        method,
        headers:
          method === 'POST'
            ? { 'Content-Type': 'application/json' }
            : undefined,
        timeout: 30000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );
    req.on('error', () => resolve(0));
    req.on('timeout', () => {
      req.destroy();
      resolve(0);
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function preheatDevServer(): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const defaultBranchId = 1;

  // Usar un producto real del seed para que el endpoint de disponibilidad
  // recorra el mismo código que los tests (consulta de producto, recetas e
  // insumos) y evite la compilación bajo demanda en el primer test.
  const product = await db.query.products.findFirst({
    where: eq(products.branchId, defaultBranchId),
  });
  const productId = product?.id ?? 1;
  const cartItem = { productId, quantity: 1 };

  // Calentar las páginas y rutas API críticas (chat y pedido público) antes
  // de que comiencen los tests, para evitar timeouts por compilación bajo
  // Turbopack. Se usan peticiones reales; el cuerpo vacío/inválido hace que
  // algunas devuelvan 400/401, pero ya fuerzan la compilación del handler.
  const requests = [
    { path: '/login' },
    { path: '/api/caja/resumen' },
    { path: '/pedido?branchId=1' },
    { path: '/api/public/catalogo?branchId=1' },
    {
      path: '/api/public/disponibilidad?branchId=1',
      method: 'POST',
      body: JSON.stringify({ items: [cartItem] }),
    },
    {
      path: '/api/public/pedido?branchId=1',
      method: 'POST',
      body: JSON.stringify({
        items: [cartItem],
        customerName: 'Pre Heat',
        customerPhone: '3415555555',
        deliveryType: 'pickup',
        idempotencyKey: 'preheat-1',
      }),
    },
    { path: '/pedido/1/chat?token=invalid' },
    { path: '/api/public/pedido/1/chat?token=invalid&after=0&limit=50' },
    {
      path: '/api/public/pedido/1/chat?token=invalid',
      method: 'POST',
      body: JSON.stringify({ content: 'preheat' }),
    },
    {
      path: '/api/public/pedido/1/chat/upload?token=invalid',
      method: 'POST',
      body: JSON.stringify({ content: 'preheat' }),
    },
    { path: '/pedidos/1' },
    { path: '/api/pedidos/1/chat' },
    {
      path: '/api/pedidos/1/chat',
      method: 'POST',
      body: JSON.stringify({ content: 'preheat' }),
    },
    { path: '/pedidos' },
  ];

  // Secuencial para no saturar el dev server durante el precalentamiento.
  for (const r of requests) {
    await fetchOnce(`${baseUrl}${r.path}`, { method: r.method, body: r.body });
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

  await preheatDevServer();

  // Limpiar el pedido de precalentamiento para no contaminar el estado de los
  // tests, pero dejar productos, sucursales y catálogos ya cargados.
  await db.execute(sql`
    TRUNCATE TABLE
      order_items,
      order_messages,
      public_order_rate_limits,
      orders
    RESTART IDENTITY CASCADE;
  `);
}
