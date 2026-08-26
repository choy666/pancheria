import { test, expect } from '@playwright/test';

/**
 * Valida rate limiting de creación de pedidos públicos.
 *
 * Requiere E2E_ENABLE_RATE_LIMIT=true y un PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS
 * bajo (por ejemplo 2) en .env.e2e para que el límite se alcance rápidamente.
 */
test.describe.skip('Rate limit de pedidos públicos', () => {
  test.skip('bloquea la tercera solicitud con 429', async ({ page }) => {
    const body = {
      customerName: 'Cliente rate limit',
      deliveryType: 'pickup',
      branchId: 1,
      items: [{ productId: 0, quantity: 1 }],
    };

    const first = await page.request.post('/api/public/pedido?branchId=1', {
      data: body,
    });
    expect([400, 429]).toContain(first.status());

    if (first.status() === 429) {
      return;
    }

    const second = await page.request.post('/api/public/pedido?branchId=1', {
      data: body,
    });
    expect([400, 429]).toContain(second.status());

    if (second.status() === 429) {
      return;
    }

    const third = await page.request.post('/api/public/pedido?branchId=1', {
      data: body,
    });
    expect(third.status()).toBe(429);

    const thirdBody = (await third.json()) as { error?: string };
    expect(thirdBody.error).toContain('Demasiados pedidos');
  });
});
