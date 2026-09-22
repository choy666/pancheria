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
 * Idempotencia del lado del cliente (hallazgo QA-2026-09-21-02).
 *
 * El servidor deduplica por `(branchId, idempotencyKey)`, pero el cliente
 * generaba una clave nueva en cada intento (`nanoid()` dentro del submit).
 * El escenario crítico es el reintento tras una respuesta perdida: la
 * request llega al servidor, el pedido se crea, pero la respuesta se
 * corta y el usuario vuelve a intentar. Con una clave nueva el reintento
 * crea un segundo pedido.
 *
 * `page.route` permite reproducirlo de forma determinística: se deja que
 * la request viaje al servidor (`route.fetch()`) y se aborta la respuesta
 * hacia el navegador (`route.abort()`), que es exactamente lo que ve un
 * cliente real cuando se cae la red después de procesada la request.
 *
 * La política implementada: la clave se genera una vez por intento de
 * checkout, se conserva en reintentos y se rota solo tras el éxito o
 * cuando cambia el carrito.
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

  test('la misma clave con un carrito distinto devuelve el pedido original', async ({
    page,
  }) => {
    // Contrato del servidor que obliga al cliente a rotar la clave al
    // cambiar el carrito: la deduplicación es solo por clave, sin
    // comparación de payload.
    const productA = await createServiceProduct(page, 'Servicio A');
    const productB = await createServiceProduct(page, 'Servicio B');
    const key = `key-reuso-${unique('x')}`;

    const first = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': randomClientIp() },
      data: {
        items: [{ productId: productA.id, quantity: 1 }],
        customerName: unique('Cliente Misma Clave'),
        customerPhone: '3415551234',
        deliveryType: 'pickup',
        idempotencyKey: key,
      },
    });
    expect(first.status()).toBe(201);
    const firstBody = (await first.json()) as PublicOrderResponse;

    const second = await page.request.post('/api/public/pedido', {
      headers: { 'x-forwarded-for': randomClientIp() },
      data: {
        items: [{ productId: productB.id, quantity: 3 }],
        customerName: 'Otro Nombre Distinto',
        customerPhone: '3415559999',
        deliveryType: 'pickup',
        idempotencyKey: key,
      },
    });
    expect(second.status()).toBe(201);
    const secondBody = (await second.json()) as PublicOrderResponse;

    // Misma clave → mismo pedido; el segundo payload se ignora por
    // completo (ni siquiera el nombre ni el carrito cambian).
    expect(secondBody.order.id).toBe(firstBody.order.id);
    expect(secondBody.order.items).toHaveLength(1);
    expect(secondBody.order.items[0].productId).toBe(productA.id);
    expect(secondBody.order.items[0].quantity).toBe(1);
    // La respuesta queda marcada como deduplicada para que el cliente
    // pueda avisar que no se creó un pedido nuevo (QA-04 queda como
    // hardening del lado del servidor para payloads distintos).
    expect(secondBody.deduplicated).toBe(true);
  });

  test('reintentar la confirmación con la misma clave devuelve la venta original marcada como deduplicada', async ({
    page,
  }) => {
    // El caso del operador: confirmó, la respuesta se perdió, editó los
    // pagos y reintentó. El servidor devuelve la venta original (con los
    // primeros pagos) y la marca para que la interfaz avise.
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
    const firstBody = (await first.json()) as {
      sale: { id: number };
      deduplicated?: boolean;
    };
    expect(firstBody.deduplicated).toBe(false);

    // Reintento con la misma clave pero con los pagos cambiados.
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
    expect(second.status()).toBe(201);
    const secondBody = (await second.json()) as {
      sale: { id: number };
      deduplicated?: boolean;
    };

    // Devuelve la venta original y la marca: los pagos editados del
    // reintento no se aplicaron.
    expect(secondBody.sale.id).toBe(firstBody.sale.id);
    expect(secondBody.deduplicated).toBe(true);
  });
});
