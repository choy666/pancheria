import { test, expect, type Page } from '@playwright/test';
import {
  login,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  unique,
  createProductViaApi,
  countOrdersByCustomerName,
} from './helpers';

/**
 * Idempotencia del cliente y validación del fingerprint del servidor.
 *
 * El servidor compara una huella SHA-256 canónica: la misma clave y el
 * mismo payload recuperan el recurso; la misma clave con datos distintos
 * responde 409. El cliente conserva la clave en reintentos idénticos y la
 * rota cuando cambia cualquier campo relevante, incluidos los pagos.
 *
 * `page.route` reproduce de forma determinística una respuesta perdida:
 * deja llegar el request al servidor y aborta la respuesta al navegador.
 */

type PublicOrderResponse = {
  order: {
    id: number;
    orderNumber: string;
    total: number;
    items: { productId: number; quantity: number }[];
  };
  deduplicated?: boolean;
};

function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function createServiceProduct(page: Page, name: string) {
  return createProductViaApi(page, {
    name: unique(name),
    type: 'service',
    price: 1500,
    unit: 'unidad',
    isActive: true,
  });
}

test.describe('Idempotencia de checkout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('un reintento tras una respuesta cortada no duplica el pedido', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio Reintento');
    const customerName = unique('Cliente Reintento');

    await page.goto('/pedido');
    await page.getByTestId(`add-product-${product.id}`).click();
    await page.getByRole('button', { name: 'Hacer pedido' }).click();
    await page.locator('#customerName').fill(customerName);
    await page.locator('#customerPhone').fill('3415551234');

    // La primera request llega al servidor (crea el pedido) y la
    // respuesta se corta: el cliente ve un error de red.
    const sentKeys: string[] = [];
    let firstAttemptIntercepted = false;
    await page.route('**/api/public/pedido*', async (route, request) => {
      const isSubmit =
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/public/pedido';
      if (!isSubmit || firstAttemptIntercepted) {
        if (isSubmit) {
          sentKeys.push(
            (request.postDataJSON() as { idempotencyKey?: string })
              .idempotencyKey ?? ''
          );
        }
        return route.continue();
      }
      firstAttemptIntercepted = true;
      sentKeys.push(
        (request.postDataJSON() as { idempotencyKey?: string })
          .idempotencyKey ?? ''
      );
      await route.fetch();
      return route.abort();
    });

    await page.getByTestId('confirm-order-button').click();
    await expect(page.getByTestId('checkout-error')).toBeVisible();

    // Reintento del usuario: debe reutilizar la misma clave y el servidor
    // debe devolver el pedido ya creado en vez de insertar otro. Se espera
    // a que el botón se rehabilite (isSubmitting vuelve a false).
    const confirmButton = page.getByTestId('confirm-order-button');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    await expect(page.getByTestId('order-success-title')).toBeVisible();

    // El servidor marcó la respuesta como deduplicada y la interfaz lo
    // avisa: el pedido mostrado es el original registrado, no uno nuevo.
    await expect(page.getByTestId('order-dedup-notice')).toBeVisible();

    expect(sentKeys).toHaveLength(2);
    expect(sentKeys[0]).not.toBe('');
    expect(sentKeys[1]).toBe(sentKeys[0]);
    expect(await countOrdersByCustomerName(customerName)).toBe(1);
  });

  test('la misma clave con un payload distinto responde 409 sin crear otro pedido', async ({
    page,
  }) => {
    const productA = await createServiceProduct(page, 'Servicio A');
    const productB = await createServiceProduct(page, 'Servicio B');
    const customerName = unique('Cliente Misma Clave');
    const otherCustomerName = unique('Otro Nombre');
    const key = `key-reuso-${unique('x')}`;

    const first = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': randomClientIp() },
      data: {
        items: [{ productId: productA.id, quantity: 1 }],
        customerName,
        customerPhone: '3415551234',
        deliveryType: 'pickup',
        idempotencyKey: key,
      },
    });
    expect(first.status()).toBe(201);

    const second = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': randomClientIp() },
      data: {
        items: [{ productId: productB.id, quantity: 3 }],
        customerName: otherCustomerName,
        customerPhone: '3415559999',
        deliveryType: 'pickup',
        idempotencyKey: key,
      },
    });
    expect(second.status()).toBe(409);
    const body = (await second.json()) as { error?: string };
    expect(body.error).toContain('clave de idempotencia');
    expect(await countOrdersByCustomerName(customerName)).toBe(1);
    expect(await countOrdersByCustomerName(otherCustomerName)).toBe(0);
  });

  test('reutilizar la clave de confirmación con pagos distintos responde 409', async ({
    page,
  }) => {
    const product = await createServiceProduct(page, 'Servicio Confirma');
    const orderResponse = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': randomClientIp() },
      data: {
        items: [{ productId: product.id, quantity: 1 }],
        customerName: unique('Cliente Confirma'),
        customerPhone: '3415551234',
        deliveryType: 'pickup',
        idempotencyKey: `pedido-${unique('k')}`,
      },
    });
    expect(orderResponse.status()).toBe(201);
    const { order } = (await orderResponse.json()) as PublicOrderResponse;

    const confirmKey = `confirm-${order.id}-${Date.now()}`;
    const first = await page.request.post(
      `/api/pedidos/${order.id}/confirmar`,
      {
        data: {
          payments: [{ method: 'cash', amount: order.total }],
          idempotencyKey: confirmKey,
        },
      }
    );
    expect(first.status()).toBe(201);

    const second = await page.request.post(
      `/api/pedidos/${order.id}/confirmar`,
      {
        data: {
          payments: [
            { method: 'cash', amount: order.total - 100 },
            { method: 'transfer', amount: 100 },
          ],
          idempotencyKey: confirmKey,
        },
      }
    );
    expect(second.status()).toBe(409);
    const body = (await second.json()) as { error?: string; sale?: { id: number } };
    expect(body.error).toContain('clave de idempotencia');
    expect(body.sale).toBeUndefined();
  });
});
