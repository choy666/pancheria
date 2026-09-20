import { test, expect, type Page } from '@playwright/test';
import {
  login,
  unique,
  createProductViaApi,
  setUniqueClientIp,
} from './helpers';

/**
 * Cobertura E2E del spike SSE de chat (T13).
 *
 * Los tests ejercitan los endpoints `.../chat/stream` con un `budget` corto
 * (el stream se cierra solo al agotarlo) y un `interval` acotado, sin
 * requerir `NEXT_PUBLIC_CHAT_STREAM_ENABLED` en la UI: el fallback a polling
 * ya está cubierto por `pedido-chat.spec.ts`, que corre con el flag
 * deshabilitado y usa el poll REST de siempre.
 */

interface PublicOrder {
  id: number;
  cancellationToken: string;
}

async function createPublicOrderViaApi(
  page: Page,
  productId: number
): Promise<PublicOrder> {
  const response = await page.request.post('/api/public/pedido', {
    data: {
      items: [{ productId, quantity: 1 }],
      customerName: unique('Cliente stream'),
      customerPhone: `3415${Math.floor(100000 + Math.random() * 899999)}`,
      deliveryType: 'pickup',
      idempotencyKey: `stream-${Date.now()}-${Math.random()}`,
    },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: PublicOrder };
  return body.order;
}

test.describe('SSE del chat de pedidos (spike T13)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await setUniqueClientIp(page);
  });

  test('el stream público emite estado inicial y mensajes nuevos', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Stream público'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      isActive: true,
    });
    const order = await createPublicOrderViaApi(page, product.id);
    const token = encodeURIComponent(order.cancellationToken);

    const streamPromise = page.request.get(
      `/api/public/pedido/${order.id}/chat/stream?token=${token}&budget=2500&interval=500`
    );

    // Deja que el stream conecte y luego publica un mensaje del cliente.
    await page.waitForTimeout(300);
    const post = await page.request.post(
      `/api/public/pedido/${order.id}/chat?token=${token}`,
      { data: { content: 'hola por stream' } }
    );
    expect(post.status()).toBe(201);

    const response = await streamPromise;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');

    const body = await response.text();
    expect(body).toContain('event: state');
    expect(body).toContain('"status":"pending"');
    expect(body).toMatch(/id: \d+\nevent: messages/);
    expect(body).toContain('hola por stream');
  });

  test('el stream del operador emite mensajes del cliente', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Stream operador'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      isActive: true,
    });
    const order = await createPublicOrderViaApi(page, product.id);
    const token = encodeURIComponent(order.cancellationToken);

    const streamPromise = page.request.get(
      `/api/pedidos/${order.id}/chat/stream?budget=2500&interval=500`
    );

    await page.waitForTimeout(300);
    const post = await page.request.post(
      `/api/public/pedido/${order.id}/chat?token=${token}`,
      { data: { content: 'mensaje para el operador' } }
    );
    expect(post.status()).toBe(201);

    const response = await streamPromise;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');

    const body = await response.text();
    expect(body).toContain('event: state');
    expect(body).toMatch(/id: \d+\nevent: messages/);
    expect(body).toContain('mensaje para el operador');
  });

  test('el stream público rechaza un token inválido', async ({ page }) => {
    const product = await createProductViaApi(page, {
      name: unique('Stream token'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      isActive: true,
    });
    const order = await createPublicOrderViaApi(page, product.id);

    const response = await page.request.get(
      `/api/public/pedido/${order.id}/chat/stream?token=token-invalido&budget=1000`
    );

    expect(response.status()).toBe(404);
  });
});
