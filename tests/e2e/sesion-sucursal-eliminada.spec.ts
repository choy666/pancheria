import { test, expect } from '@playwright/test';
import * as bcrypt from 'bcrypt';
import { db } from '../../src/db';
import { branches, users } from '../../src/db/schema';
import { deleteBranch } from '../../src/application/services/branchService';
import { login, loginAs, unique } from './helpers';

/**
 * E4 — sesión autenticada cuya sucursal fue eliminada (hard delete en
 * cascada + JWT sin revalidación: el `branchId` del token queda huérfano).
 *
 * Pre-fix: las escrituras con insert directo (`caja/abrir`, `productos`)
 * llegaban a la FK de `branches` y respondían 500; las páginas del panel
 * renderizaban con un `branchId` inexistente.
 *
 * Post-fix: `requireAuth`/`getCurrentBranchId` validan que la sucursal
 * exista → 403 "La sucursal asignada ya no existe." en APIs, y el layout
 * del panel redirige al catálogo público (`/pedido`, ruta pública que no
 * rebota al login — el middleware vería la sesión viva y produciría un
 * loop de redirects).
 */
const OPEN_24_7 = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  open: '00:00',
  close: '23:59',
}));

async function createBranchWithOperator(): Promise<{
  branchId: number;
  username: string;
  password: string;
}> {
  const [branch] = await db
    .insert(branches)
    .values({ name: unique('Sucursal E4'), openingHours: OPEN_24_7 })
    .returning();

  const username = unique('op-e4');
  const password = `e4-${Date.now()}`;
  await db.insert(users).values({
    username,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'operator',
    branchId: branch.id,
  });

  return { branchId: branch.id, username, password };
}

test.describe('Sesión con sucursal eliminada (E4)', () => {
  test('un operador con sesión viva recibe 403 en escrituras y es expulsado del panel', async ({
    page,
  }) => {
    const { branchId, username, password } = await createBranchWithOperator();

    await loginAs(page, username, password);

    // La sesión funciona mientras la sucursal existe.
    const resumenAntes = await page.request.get('/api/caja/resumen');
    expect(resumenAntes.status()).toBe(200);

    // El admin elimina la sucursal (hard delete en cascada): el JWT del
    // operador sigue válido pero su branchId queda huérfano.
    await deleteBranch(branchId);

    const abrir = await page.request.post('/api/caja/abrir', { data: {} });
    expect(abrir.status()).toBe(403);
    expect((await abrir.json()).error).toContain('sucursal');

    const producto = await page.request.post('/api/productos', {
      data: {
        name: unique('Producto E4'),
        type: 'manual_supply',
        price: 100,
        unit: 'unidad',
      },
    });
    expect(producto.status()).toBe(403);

    const video = await page.request.post('/api/videos/upload', {
      multipart: {
        key: `videos/${branchId}/e4.mp4`,
        file: {
          name: 'e4.mp4',
          mimeType: 'video/mp4',
          buffer: Buffer.from('contenido de prueba'),
        },
      },
    });
    expect(video.status()).toBe(403);

    // Las páginas del panel expulsan al catálogo público: `getCurrent-
    // BranchIdOrRedirect` redirige a /pedido en vez de encadenar
    // login → home → login (la sesión sigue viva y el middleware rebotaría).
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/pedido/);

    // La gestión de usuarios (server action con `requireAdmin`) tampoco es
    // accesible: la sesión huérfana queda expulsada antes de cualquier
    // escritura, no solo en las rutas que resuelven branchId.
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/pedido/);
  });

  test('admin con cookie de sucursal eliminada cae al fallback de su propia sucursal', async ({
    page,
  }) => {
    // Regresión del fallback del admin: la cookie `activeBranchId`
    // apuntando a una sucursal inexistente se ignora y se usa la sucursal
    // propia del usuario — nunca un 403/500.
    await login(page);

    // Sucursal realmente eliminada (no un id inventado) para que el valor
    // de la cookie sea un huérfano genuino.
    const [branch] = await db
      .insert(branches)
      .values({ name: unique('Sucursal E4 cookie'), openingHours: OPEN_24_7 })
      .returning();
    await deleteBranch(branch.id);

    await page.context().addCookies([
      {
        name: 'activeBranchId',
        value: String(branch.id),
        url: 'http://localhost:3000',
      },
    ]);

    const abrir = await page.request.post('/api/caja/abrir', { data: {} });
    // Cae al fallback: abre la caja de su sucursal (201) o informa que ya
    // existe una abierta (400). Lo que no puede pasar es 403 ni 500.
    expect([201, 400]).toContain(abrir.status());
  });
});
