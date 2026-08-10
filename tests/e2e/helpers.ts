import { expect, type Page } from '@playwright/test';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

export function unique(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

export async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', adminUsername);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

export async function ensureLoggedIn(page: Page) {
  const resumen = await page.request.get('/api/caja/resumen');
  if (resumen.status() === 401) {
    await login(page);
  }
}

export async function getCashRegister(page: Page) {
  const resumen = await page.request.get('/api/caja/resumen');
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
  }
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
  expect(response.status()).toBe(200);
}
