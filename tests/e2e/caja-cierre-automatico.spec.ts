import { test, expect } from '@playwright/test';
import { getAutoCloseHours } from '../../src/config/caja';
import {
  login,
  ensureCashRegisterClosed,
  setCashRegisterOpenedAt,
} from './helpers';

/**
 * Valida el cierre automático de cajas abiertas por más de
 * CAJA_AUTO_CLOSE_HOURS.
 *
 * Requiere CAJA_AUTO_CLOSE_HOURS bajo en .env.e2e (por ejemplo 1).
 */
test.describe('Cierre automático de caja', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('cierra la caja automáticamente cuando supera el límite de horas', async ({
    page,
  }) => {
    const openRes = await page.request.post('/api/caja/abrir');
    expect(openRes.status()).toBe(201);
    const { id } = (await openRes.json()) as { id: number };

    const hours = getAutoCloseHours();
    const oldOpenedAt = new Date(Date.now() - (hours + 1) * 60 * 60 * 1000);
    await setCashRegisterOpenedAt(id, oldOpenedAt);

    await page.goto('/ventas');
    await expect(
      page.getByText('No hay una caja abierta. Abrí una caja para comenzar a vender.')
    ).toBeVisible({ timeout: 10000 });

    const historyRes = await page.request.get('/api/caja/resumen');
    expect(historyRes.status()).toBe(200);
    const history = (await historyRes.json()) as {
      status?: string;
      cashRegister?: { status: string; autoClosed: boolean } | null;
    };
    expect(history.status === 'closed' || history.cashRegister == null).toBe(
      true
    );

    const detailRes = await page.request.get(`/api/caja/${id}`);
    expect(detailRes.status()).toBe(200);
    const detail = (await detailRes.json()) as {
      status: string;
      autoClosed: boolean;
      closedBy: string;
    };
    expect(detail.status).toBe('closed');
    expect(detail.autoClosed).toBe(true);
    expect(detail.closedBy).toContain('Sistema');
  });
});
