import type { Page } from '@playwright/test';

export async function ensureCashRegisterOpen(page: Page) {
  const resumen = await page.request.get('/api/caja/resumen');
  const data = (await resumen.json()) as { status?: string };

  if (data.status === 'closed') {
    const abrir = await page.request.post('/api/caja/abrir');
    if (!abrir.ok()) {
      throw new Error('No se pudo abrir la caja para los tests.');
    }
  }
}
