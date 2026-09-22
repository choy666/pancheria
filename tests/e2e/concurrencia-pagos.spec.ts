import { test, expect, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { sales, salePayments } from '../../src/db/schema';
import {
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
  ensureCashRegisterOpen,
  setUniqueClientIp,
  getDefaultBranchId,
} from './helpers';

/**
 * Concurrencia e idempotencia sobre ventas y pagos (C2.4, C2.9 del plan).
 *
 * El índice único `(branchId, idempotencyKey)` de `sales` es la última
 * línea de defensa ante doble submit en paralelo: ambos requests pueden
 * responder 201 pero debe quedar una sola venta y `sale_payments` debe
 * sumar exactamente `sales.total`.
 */

type CreatedPublicOrder = {
  id: number;
  status: string;
  total: number;
  customerName: string;
};

function randomClientIp() {
  const octet = () => Math.floor(Math.random() * 253) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function createBeverage(
  page: Page,
  name: string,
  stock: number,
  price = 500
): Promise<{ id: number }> {
  const product = await createProductViaApi(page, {
    name: unique(name),
    type: 'critical_supply',
    criticalSupplyType: 'beverage',
    price,
    unit: 'unidad',
    isActive: true,
  });
  await restockProductViaApi(page, product.id, stock);
  return product;
}

async function createPublicOrder(
  page: Page,
  productId: number
): Promise<CreatedPublicOrder> {
  const response = await page.request.post('/api/public/pedido', {
    headers: { 'x-forwarded-for': randomClientIp() },
    data: {
      items: [{ productId, quantity: 1 }],
      customerName: unique('Cliente Pago'),
      customerPhone: '3415551234',
      deliveryType: 'pickup',
      idempotencyKey: `pago-${Date.now()}-${Math.random()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { order: CreatedPublicOrder };
  return body.order;
}

/** Ventas almacenadas con la clave prefijada por sucursal (`{branchId}:{key}`). */
async function findSalesByIdempotencyKey(key: string) {
  const branchId = await getDefaultBranchId();
  return db
    .select()
    .from(sales)
    .where(eq(sales.idempotencyKey, `${branchId}:${key}`));
}

/** Invariante de dinero: `sale_payments` debe sumar exactamente `sales.total`. */
async function sumSalePayments(saleId: number): Promise<number> {
  const rows = await db
    .select({ amount: salePayments.amount })
    .from(salePayments)
    .where(eq(salePayments.saleId, saleId));
  return rows.reduce((total, row) => total + row.amount, 0);
}

test.describe('Concurrencia y validación de pagos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterOpen(page);
    await setUniqueClientIp(page);
  });

  test('doble POST /api/ventas con la misma clave en paralelo crea una sola venta', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida venta doble', 5);
    const key = `venta-doble-${Date.now()}`;
    const payload = {
      items: [{ productId: bebida.id, quantity: 1 }],
      payments: [{ method: 'cash', amount: 500 }],
      idempotencyKey: key,
    };

    const [a, b] = await Promise.all([
      page.request.post('/api/ventas', { data: payload }),
      page.request.post('/api/ventas', { data: payload }),
    ]);

    // Según cómo se resuelva la carrera el perdedor ve la venta existente
    // (201 idempotente) o una violación de unicidad controlada: ambos son
    // resultados válidos; lo que importa es el invariante persistido.
    for (const response of [a, b]) {
      expect(response.status()).toBeLessThan(500);
    }
    expect(a.status() === 201 || b.status() === 201).toBe(true);

    // Invariantes SQL: una sola venta y pagos que suman el total exacto.
    const ventas = await findSalesByIdempotencyKey(key);
    expect(ventas).toHaveLength(1);
    expect(await sumSalePayments(ventas[0].id)).toBeCloseTo(ventas[0].total);
  });

  test('doble POST /confirmar con la misma clave en paralelo crea una sola venta', async ({
    page,
  }) => {
    const bebida = await createBeverage(page, 'Bebida confirmar doble', 5);
    const pedido = await createPublicOrder(page, bebida.id);
    const key = `confirmar-doble-${Date.now()}`;
    const payload = {
      payments: [{ method: 'cash', amount: pedido.total }],
      idempotencyKey: key,
    };

    const [a, b] = await Promise.all([
      page.request.post(`/api/pedidos/${pedido.id}/confirmar`, {
        data: payload,
      }),
      page.request.post(`/api/pedidos/${pedido.id}/confirmar`, {
        data: payload,
      }),
    ]);

    for (const response of [a, b]) {
      expect(response.status()).toBeLessThan(500);
    }

    // El pedido queda pagado una sola vez: una venta, un cobro consistente.
    const ventas = await findSalesByIdempotencyKey(key);
    expect(ventas).toHaveLength(1);
    expect(await sumSalePayments(ventas[0].id)).toBeCloseTo(ventas[0].total);
  });

  test('un pago mixto que no suma el total es rechazado', async ({ page }) => {
    const bebida = await createBeverage(page, 'Bebida pago mixto', 5, 1500);
    const pedido = await createPublicOrder(page, bebida.id);

    const confirmar = await page.request.post(
      `/api/pedidos/${pedido.id}/confirmar`,
      {
        data: {
          // cash 500 + transfer 400 = 900 ≠ total 1500.
          payments: [
            { method: 'cash', amount: 500 },
            { method: 'transfer', amount: 400 },
          ],
          idempotencyKey: `mixto-insuficiente-${Date.now()}`,
        },
      }
    );

    expect(confirmar.status()).toBe(400);
  });

  test('pagos con montos negativos o cero son rechazados', async ({ page }) => {
    const bebida = await createBeverage(page, 'Bebida pago inválido', 5, 1500);
    const pedido = await createPublicOrder(page, bebida.id);

    const negativo = await page.request.post(
      `/api/pedidos/${pedido.id}/confirmar`,
      {
        data: {
          payments: [{ method: 'cash', amount: -1500 }],
          idempotencyKey: `negativo-${Date.now()}`,
        },
      }
    );
    expect(negativo.status()).toBe(400);

    const cero = await page.request.post(
      `/api/pedidos/${pedido.id}/confirmar`,
      {
        data: {
          payments: [{ method: 'cash', amount: 0 }],
          idempotencyKey: `cero-${Date.now()}`,
        },
      }
    );
    expect(cero.status()).toBe(400);
  });
});
