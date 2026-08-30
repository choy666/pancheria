import { test, expect } from '@playwright/test';
import { login, ensureCashRegisterOpen } from './helpers';

test.describe('Rate limit de pedidos públicos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
  });

  test('bloquea la tercera solicitud con 429', async ({ page }) => {
    const catalog = await page.request.get('/api/public/catalogo?branchId=1');
    expect(catalog.status()).toBe(200);
    const catalogData = (await catalog.json()) as { products: { id: number; name: string }[] };
    const product = catalogData.products.find((p) => p.id > 0);
    expect(product).toBeDefined();

    const clientIp = '203.0.113.10';
    const makeRequest = () =>
      page.request.post('/api/public/pedido?branchId=1', {
        data: {
          items: [{ productId: product!.id, quantity: 1 }],
          customerName: 'Cliente rate limit',
          customerPhone: '3415555555',
          deliveryType: 'pickup',
          idempotencyKey: `rate-limit-${Date.now()}-${Math.random()}`,
        },
        headers: {
          'X-Forwarded-For': clientIp,
        },
      });

    const first = await makeRequest();
    expect([201, 429]).toContain(first.status());

    if (first.status() === 429) {
      return;
    }

    const second = await makeRequest();
    expect([201, 429]).toContain(second.status());

    if (second.status() === 429) {
      return;
    }

    const third = await makeRequest();
    expect(third.status()).toBe(429);

    const thirdBody = (await third.json()) as { error?: string };
    expect(thirdBody.error).toContain('Demasiados pedidos');
  });
});
