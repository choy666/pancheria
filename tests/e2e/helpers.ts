import type { Page } from '@playwright/test';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

export async function ensureLoggedIn(page: Page) {
  const resumen = await page.request.get('/api/caja/resumen');
  if (resumen.status() === 401) {
    await page.goto('/login');
    await page.fill('input[name="username"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });
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
