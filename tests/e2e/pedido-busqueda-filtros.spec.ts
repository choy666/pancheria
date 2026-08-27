import { test, expect } from '@playwright/test';
import { login, unique, createProductViaApi, ensureCashRegisterOpen } from './helpers';

type CreatedOrder = {
  id: number;
  customerName: string;
  customerPhone: string;
  status: string;
};

async function createPublicOrderViaApi(
  page: import('@playwright/test').Page,
  productId: number,
  customerName: string
): Promise<CreatedOrder> {
  const customerPhone = `3415${Math.floor(100000 + Math.random() * 899999)}`;
  // Se usa un IP único por pedido para evitar el rate limit por IP
  // cuando el servidor corre con NODE_ENV=development.
  const clientIp = `10.0.0.${Math.floor(Math.random() * 1000000) % 254}`;

  const response = await page.request.post('/api/public/pedido', {
    data: {
      items: [{ productId, quantity: 1 }],
      customerName,
      customerPhone,
      deliveryType: 'pickup',
      idempotencyKey: `${customerName}-${Date.now()}-${Math.random()}`,
    },
    headers: {
      'X-Forwarded-For': clientIp,
    },
  });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as {
    order: { id: number; customerName: string; customerPhone: string; status: string };
  };

  return body.order;
}

test.describe('Búsqueda, filtros y paginación de pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
  });

  test('busca pedidos por nombre de cliente y permite limpiar la búsqueda', async ({
    page,
  }) => {
    const product = await createProductViaApi(page, {
      name: unique('Producto búsqueda'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const customerA = unique('Búsqueda Alfa');
    const customerB = unique('Búsqueda Beta');
    const customerC = unique('Otro Nombre');

    await createPublicOrderViaApi(page, product.id, customerA);
    await createPublicOrderViaApi(page, product.id, customerB);
    await createPublicOrderViaApi(page, product.id, customerC);

    await page.goto('/pedidos');
    await expect(page.getByTestId('orders-search')).toBeVisible();

    const matchingLocator = page
      .getByTestId('order-customer-name')
      .filter({ hasText: /Búsqueda/ });
    const nonMatchingLocator = page
      .getByTestId('order-customer-name')
      .filter({ hasText: customerC });

    await page.getByTestId('orders-search').fill('Búsqueda');
    await expect(matchingLocator).toHaveCount(2);
    await expect(nonMatchingLocator).toHaveCount(0);

    await page.getByTestId('orders-search-clear').click();
    await expect(page.getByTestId('orders-search')).toHaveValue('');

    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: customerA })
    ).toBeVisible();
    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: customerB })
    ).toBeVisible();
    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: customerC })
    ).toBeVisible();
  });

  test('filtra pedidos por estado pendiente y cancelado', async ({ page }) => {
    const product = await createProductViaApi(page, {
      name: unique('Producto estado'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const pendingCustomer = unique('Estado Pendiente');
    const cancelledCustomer = unique('Estado Cancelado');

    const pendingOrder = await createPublicOrderViaApi(
      page,
      product.id,
      pendingCustomer
    );
    const cancelledOrder = await createPublicOrderViaApi(
      page,
      product.id,
      cancelledCustomer
    );

    expect(pendingOrder.status).toBe('pending');

    const cancelResponse = await page.request.post(
      `/api/pedidos/${cancelledOrder.id}/cancelar`,
      {
        data: { reason: 'Cancelado para el test de filtros' },
      }
    );
    expect(cancelResponse.status()).toBe(200);

    await page.goto('/pedidos');

    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: pendingCustomer })
    ).toBeVisible();
    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: cancelledCustomer })
    ).toHaveCount(0);

    await page.getByTestId('orders-status-filter').click();
    await page.getByRole('option', { name: 'Cancelado' }).click();

    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: cancelledCustomer })
    ).toBeVisible();
    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: pendingCustomer })
    ).toHaveCount(0);

    await page.getByTestId('orders-status-filter').click();
    await page.getByRole('option', { name: 'Pendiente' }).click();

    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: pendingCustomer })
    ).toBeVisible();
    await expect(
      page.getByTestId('order-customer-name').filter({ hasText: cancelledCustomer })
    ).toHaveCount(0);
  });

  test('navega a la página 2 y el listado cambia', async ({ page }) => {
    const product = await createProductViaApi(page, {
      name: unique('Producto paginación'),
      type: 'service',
      price: 1000,
      unit: 'unidad',
      stock: 0,
      minStock: 0,
      isActive: true,
    });

    const createdCustomers: string[] = [];
    for (let i = 1; i <= 12; i += 1) {
      const customerName = unique(`Paginación Cliente ${i.toString().padStart(2, '0')}`);
      const order = await createPublicOrderViaApi(page, product.id, customerName);
      createdCustomers.push(order.customerName);
    }

    await page.goto('/pedidos');

    await expect(page.getByText(/Página 1 de/)).toBeVisible();

    const page1Names = await page.getByTestId('order-customer-name').allTextContents();
    expect(page1Names.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Página siguiente' }).click();

    await expect(page.getByText(/Página 2 de/)).toBeVisible();

    const page2Names = await page.getByTestId('order-customer-name').allTextContents();
    expect(page2Names.length).toBeGreaterThan(0);
    expect(page2Names).not.toEqual(page1Names);

    expect(createdCustomers.some((name) => page2Names.includes(name))).toBe(true);
  });
});
