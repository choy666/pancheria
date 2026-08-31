import { expect, type Page } from '@playwright/test';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { branches, cashRegisters, orders, users } from '../../src/db/schema';
import { copyCatalogToBranch } from '../../src/db/catalog-copy';
import { getOrderExpirationMs } from '../../src/config/orders';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

let defaultOperatorCredentials: { username: string; password: string } | null = null;
let defaultBranchIdCache: number | null = null;
let secondBranchSetupPromise: Promise<{
  branchId: number;
  branchName: string;
  username: string;
  password: string;
}> | null = null;

function generateTestPassword(): string {
  return randomBytes(16).toString('hex');
}

export function unique(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

let clientIpCounter = 1;

/**
 * Asigna un IP de cliente único a la página para aislar el rate limit
 * entre tests de pedidos públicos.
 */
export async function setUniqueClientIp(page: Page): Promise<void> {
  const ip = `203.0.113.${clientIpCounter % 254}`;
  clientIpCounter += 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': ip });
}

const LOGIN_NAVIGATION_TIMEOUT = 60_000;
const LOGIN_REDIRECT_TIMEOUT = 30_000;

/**
 * Limpia la sesión del contexto de Playwright de forma robusta.
 *
 * `page.context().clearCookies()` no siempre invalida la sesión de NextAuth v5
 * si quedan cookies `httpOnly` o si el server component redirige antes de que
 * el cliente descarte el estado. Este helper combina la navegación a `/login`,
 * la limpieza de cookies y el borrado de `localStorage`/`sessionStorage` para
 * evitar que `loginAs` caiga en `/` por una sesión residual.
 */
export async function clearSession(page: Page): Promise<void> {
  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
    timeout: LOGIN_NAVIGATION_TIMEOUT,
  });
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Inicia sesión con credenciales genéricas.
 *
 * El timeout de redirección es generoso (30 s) porque el primer envío del
 * formulario bajo `next dev` + Turbopack debe compilar la Server Action de
 * login; en CI o equipos lentos ese primer intento puede superar los 15 s
 * anteriores y dejar a Playwright en `/login`, lo que se confunde con un
 * error de credenciales.
 */
export async function loginAs(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
    timeout: LOGIN_NAVIGATION_TIMEOUT,
  });

  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    throw new Error(
      `La navegación a /login terminó en "${currentUrl}". ` +
        'Esto suele pasar cuando la sesión anterior no se limpió por completo. ' +
        'Usá clearSession(page) antes de loginAs(page, ...) si el test cambia de usuario.'
    );
  }

  await expect(page.getByLabel('Usuario')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  try {
    await expect(page).toHaveURL('/', { timeout: LOGIN_REDIRECT_TIMEOUT });
  } catch (error) {
    const url = page.url();
    if (url.includes('/login')) {
      const alertText = await page
        .locator('[role="alert"]')
        .textContent()
        .catch(() => undefined);
      throw new Error(
        `El login de "${username}" no redirigió a / dentro de ${LOGIN_REDIRECT_TIMEOUT} ms. ` +
          `URL actual: ${url}. ` +
          (alertText ? `Mensaje del formulario: "${alertText.trim()}". ` : '') +
          'Revisá que el secreto de autenticación, la base de datos y las credenciales estén configurados.'
      );
    }
    throw error;
  }
}

/**
 * Inicia sesión como administrador usando variables de entorno.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!adminUsername || !adminPassword) {
    throw new Error('ADMIN_USERNAME y ADMIN_PASSWORD deben estar definidos para el login de administrador.');
  }
  await loginAs(page, adminUsername, adminPassword);
}

/**
 * Devuelve el id de la sucursal por defecto, cacheándolo entre llamadas.
 */
export async function getDefaultBranchId(): Promise<number> {
  if (defaultBranchIdCache !== null) {
    return defaultBranchIdCache;
  }

  const defaultBranchName = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto';
  const branch = await db.query.branches.findFirst({
    where: eq(branches.name, defaultBranchName),
  });

  if (!branch) {
    throw new Error('No se encontró la sucursal por defecto.');
  }

  defaultBranchIdCache = branch.id;
  return branch.id;
}

/**
 * Crea o actualiza un usuario operador en la base de datos.
 * Si el usuario ya existe, conserva su sucursal asignada pero actualiza la contraseña.
 */
async function ensureOperatorUser(
  username = 'operator',
  password?: string,
  branchId?: number
): Promise<{ username: string; password: string; branchId: number }> {
  const finalPassword = password ?? generateTestPassword();
  const targetBranchId = branchId ?? (await getDefaultBranchId());
  const passwordHash = await bcrypt.hash(finalPassword, 10);

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, existing.id));

    return { username, password: finalPassword, branchId: existing.branchId };
  }

  await db.insert(users).values({
    username,
    passwordHash,
    role: 'operator',
    branchId: targetBranchId,
  });

  return { username, password: finalPassword, branchId: targetBranchId };
}

/**
 * Inicia sesión como operador.
 * Si E2E_OPERATOR_USERNAME y E2E_OPERATOR_PASSWORD están definidos, los usa.
 * De lo contrario, crea un operador en la sucursal por defecto.
 */
export async function loginAsOperator(page: Page): Promise<void> {
  const envUsername = process.env.E2E_OPERATOR_USERNAME;
  const envPassword = process.env.E2E_OPERATOR_PASSWORD;

  if (envUsername && envPassword) {
    await ensureOperatorUser(envUsername, envPassword, await getDefaultBranchId());
    await loginAs(page, envUsername, envPassword);
    return;
  }

  if (!defaultOperatorCredentials) {
    defaultOperatorCredentials = await ensureOperatorUser('operator');
  }

  await loginAs(page, defaultOperatorCredentials.username, defaultOperatorCredentials.password);
}

/**
 * Crea o asegura una segunda sucursal con un operador para tests de cambio de sucursal.
 * Utiliza variables de entorno si están definidas o valores internos solo para tests.
 */
export async function setupSecondBranchForE2E(): Promise<{
  branchId: number;
  branchName: string;
  username: string;
  password: string;
}> {
  const branchName =
    process.env.E2E_SECOND_BRANCH_NAME ??
    process.env.NEW_BRANCH_NAME ??
    'Sucursal Test';
  const username =
    process.env.E2E_SECOND_OPERATOR_USERNAME ??
    process.env.NEW_BRANCH_USERNAME ??
    'e2e-operator-segunda';
  const password =
    process.env.E2E_SECOND_OPERATOR_PASSWORD ??
    process.env.NEW_BRANCH_PASSWORD ??
    generateTestPassword();

  let branch = await db.query.branches.findFirst({
    where: eq(branches.name, branchName),
  });

  if (!branch) {
    const [created] = await db
      .insert(branches)
      .values({ name: branchName })
      .returning();
    branch = created;
  }

  if (!branch) {
    throw new Error('No se pudo crear u obtener la sucursal de prueba.');
  }

  const defaultBranch = await db.query.branches.findFirst({
    orderBy: (branches, { asc }) => [asc(branches.id)],
  });

  if (defaultBranch && defaultBranch.id !== branch.id) {
    await copyCatalogToBranch(defaultBranch.id, branch.id);
  }

  const operatorCreds = await ensureOperatorUser(username, password, branch.id);

  // Se exponen como variables de entorno del proceso para que los tests las lean.
  process.env.E2E_SECOND_BRANCH_ID = String(branch.id);
  process.env.E2E_SECOND_BRANCH_NAME = branch.name;
  process.env.E2E_SECOND_OPERATOR_USERNAME = operatorCreds.username;
  process.env.E2E_SECOND_OPERATOR_PASSWORD = operatorCreds.password;

  return {
    branchId: branch.id,
    branchName: branch.name,
    username: operatorCreds.username,
    password: operatorCreds.password,
  };
}

/**
 * Devuelve la segunda sucursal y operador de tests.
 * Si aún no están configurados, los crea en el momento.
 */
export async function getTestSecondBranch(): Promise<{
  branchId: number;
  branchName: string;
  username: string;
  password: string;
}> {
  if (
    process.env.E2E_SECOND_BRANCH_ID &&
    process.env.E2E_SECOND_OPERATOR_USERNAME &&
    process.env.E2E_SECOND_OPERATOR_PASSWORD
  ) {
    return {
      branchId: Number(process.env.E2E_SECOND_BRANCH_ID),
      branchName: process.env.E2E_SECOND_BRANCH_NAME ?? 'Sucursal Test',
      username: process.env.E2E_SECOND_OPERATOR_USERNAME,
      password: process.env.E2E_SECOND_OPERATOR_PASSWORD,
    };
  }

  if (!secondBranchSetupPromise) {
    secondBranchSetupPromise = setupSecondBranchForE2E();
  }

  return secondBranchSetupPromise;
}

export async function login(page: Page) {
  if (!adminUsername || !adminPassword) {
    throw new Error(
      'ADMIN_USERNAME y ADMIN_PASSWORD deben estar definidos para iniciar sesión en los tests E2E. ' +
        'Configuralos en .env.e2e o en los repository secrets de GitHub Actions.'
    );
  }

  const resumen = await page.request.get('/api/caja/resumen');
  const contentType = resumen.headers()['content-type'] ?? '';

  if (!contentType.includes('application/json')) {
    const text = await resumen.text();
    throw new Error(
      `GET /api/caja/resumen devolvió status ${resumen.status()} con content-type ${contentType}. Body: ${text.slice(0, 500)}`
    );
  }

  if (resumen.status() === 200) {
    return;
  }

  if (resumen.status() !== 401) {
    const data = (await resumen.json()) as { error?: string };
    throw new Error(
      `GET /api/caja/resumen devolvió status ${resumen.status()}: ${data.error ?? 'sin error'}`
    );
  }

  await loginAs(page, adminUsername, adminPassword);
}

export async function ensureLoggedIn(page: Page) {
  // `login` ya verifica el estado vía /api/caja/resumen y solo navega si es
  // necesario; así unificamos el manejo de 503/errores inesperados.
  await login(page);
}

export async function getCashRegister(page: Page) {
  const resumen = await page.request.get('/api/caja/resumen');
  const contentType = resumen.headers()['content-type'] ?? '';

  if (!contentType.includes('application/json')) {
    const text = await resumen.text();
    throw new Error(
      `GET /api/caja/resumen devolvió status ${resumen.status()} con content-type ${contentType}. Body: ${text.slice(0, 500)}`
    );
  }

  const data = (await resumen.json()) as { status?: string; id?: number };
  return data.status === 'closed' ? null : data;
}

export async function ensureCashRegisterOpen(page: Page) {
  const data = await getCashRegister(page);

  if (!data || data.status === 'closed') {
    const abrir = await page.request.post('/api/caja/abrir');
    if (!abrir.ok()) {
      throw new Error('No se pudo abrir la caja para los tests.');
    }
  }
}

export async function ensureCashRegisterClosed(page: Page) {
  const data = await getCashRegister(page);

  if (data && data.id) {
    const cerrar = await page.request.post('/api/caja/cerrar', {
      data: { id: data.id },
    });
    if (!cerrar.ok()) {
      throw new Error('No se pudo cerrar la caja para los tests.');
    }

    const after = await getCashRegister(page);
    if (after && after.status !== 'closed') {
      throw new Error('La caja sigue abierta tras intentar cerrarla.');
    }
  }
}

export async function openCashRegisterFromUI(page: Page) {
  await page.getByTestId('open-cash-register').click();
  await page.getByTestId('confirm-open-cash-register').click();
  await expect(page.getByTestId('close-cash-register')).toBeVisible({ timeout: 10000 });
}

export async function closeCashRegisterFromUI(page: Page) {
  await page.getByTestId('close-cash-register').click();
  await page.getByTestId('confirm-close-cash-register').click();
  await expect(page.getByText('No hay una caja abierta.')).toBeVisible({ timeout: 10000 });
}

export async function createProductViaApi(page: Page, data: Record<string, unknown>) {
  const productData = { ...data, stock: 0, minStock: 0 };
  const response = await page.request.post('/api/productos', { data: productData });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; name: string };
}

export async function restockProductViaApi(
  page: Page,
  productId: number,
  quantity: number,
  reason = 'Stock inicial'
) {
  const response = await page.request.post('/api/stock/ajustar', {
    data: {
      productId,
      quantity,
      reason,
      type: 'restock',
    },
  });

  if (!response.ok()) {
    const contentType = response.headers()['content-type'] ?? '';
    const body = contentType.includes('application/json')
      ? JSON.stringify(await response.json())
      : await response.text();
    throw new Error(
      `POST /api/stock/ajustar devolvió status ${response.status()}. Body: ${body.slice(0, 500)}`
    );
  }
}

/**
 * Actualiza la fecha de creación de un pedido en la base de datos.
 * Útil para forzar la expiración de pedidos pending sin esperar el tiempo real.
 */
export async function setOrderCreatedAt(
  orderId: number,
  createdAt: Date
): Promise<void> {
  await db.update(orders).set({ createdAt }).where(eq(orders.id, orderId));
}

/**
 * Retrocede el createdAt de un pedido para que quede vencido según
 * ORDER_EXPIRATION_MS. No ejecuta la lógica de negocio de expiración;
 * la cancelación automática se dispara al consultar el listado de pedidos.
 */
export async function expireOrderById(orderId: number): Promise<void> {
  const expirationMs = getOrderExpirationMs();
  const expiredCreatedAt = new Date(Date.now() - expirationMs - 1000);
  await setOrderCreatedAt(orderId, expiredCreatedAt);
}

/**
 * Actualiza la fecha de apertura de una caja en la base de datos.
 * Útil para forzar el cierre automático sin esperar las horas reales.
 */
export async function setCashRegisterOpenedAt(
  cashRegisterId: number,
  openedAt: Date
): Promise<void> {
  await db
    .update(cashRegisters)
    .set({ openedAt })
    .where(eq(cashRegisters.id, cashRegisterId));
}
