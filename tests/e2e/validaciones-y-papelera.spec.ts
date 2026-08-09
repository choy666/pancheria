import { test, expect, type Page } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
} from './helpers';

const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

function unique(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', adminUsername);
  await page.fill('input[name="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

async function createProduct(page: Page, data: Record<string, unknown>) {
  const response = await page.request.post('/api/productos', { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number; name: string };
}

test.describe('Validaciones y casos límite', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('rechaza abrir una caja cuando ya hay una abierta', async ({ page }) => {
    await ensureCashRegisterClosed(page);
    const abrir1 = await page.request.post('/api/caja/abrir');
    expect(abrir1.status()).toBe(201);

    const abrir2 = await page.request.post('/api/caja/abrir');
    expect(abrir2.status()).toBe(400);
    const body = (await abrir2.json()) as { error?: string };
    expect(body.error).toContain('Ya existe una caja abierta');

    await ensureCashRegisterClosed(page);
  });

  test('rechaza venta cuando no hay caja abierta', async ({ page }) => {
    await ensureCashRegisterClosed(page);

    const bebida = await createProduct(page, {
      name: unique('Bebida sin caja'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      stock: 10,
      minStock: 2,
      isActive: true,
    });

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: `sin-caja-${Date.now()}`,
      },
    });

    expect(venta.status()).toBe(400);
    const body = (await venta.json()) as { error?: string };
    expect(body.error).toContain('No hay una caja abierta');
  });

  test('rechaza venta por stock insuficiente', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProduct(page, {
      name: unique('Bebida stock bajo'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      stock: 1,
      minStock: 0,
      isActive: true,
    });

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 2 }],
        paymentMethod: 'cash',
        idempotencyKey: `stock-bajo-${Date.now()}`,
      },
    });

    expect(venta.status()).toBe(409);
    const body = (await venta.json()) as { error?: string };
    expect(body.error).toContain('Stock insuficiente');

    await ensureCashRegisterClosed(page);
  });

  test('idempotencia: reenviar la misma venta devuelve error', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProduct(page, {
      name: unique('Bebida idempotencia'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      stock: 5,
      minStock: 0,
      isActive: true,
    });

    const key = `idempotencia-${Date.now()}`;

    const venta1 = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        paymentMethod: 'transfer',
        idempotencyKey: key,
      },
    });
    expect(venta1.status()).toBe(201);

    const venta2 = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        paymentMethod: 'transfer',
        idempotencyKey: key,
      },
    });
    expect(venta2.status()).toBe(400);
    const body = (await venta2.json()) as { error?: string };
    expect(body.error).toContain('ya fue procesada');

    await ensureCashRegisterClosed(page);
  });

  test('rechaza cierre duplicado para la misma fecha', async ({ page }) => {
    const base = new Date(Date.now() - 1000 * 365 * 86400000);
    let target = '';

    for (let i = 0; i < 10; i++) {
      const candidate = base.toISOString().split('T')[0];
      const existente = await page.request.get(`/api/cierre?date=${candidate}`);
      const cierre = (await existente.json()) as { id?: number } | null;

      if (!cierre) {
        target = candidate;
        break;
      }

      base.setDate(base.getDate() + 1);
    }

    expect(target).not.toBe('');

    const cierre1 = await page.request.post('/api/cierre', {
      data: { date: target },
    });
    expect(cierre1.status()).toBe(201);

    const cierre2 = await page.request.post('/api/cierre', {
      data: { date: target },
    });
    expect(cierre2.status()).toBe(400);
    const body = (await cierre2.json()) as { error?: string };
    expect(body.error).toContain('Ya existe un cierre');
  });

  test('rechaza anulación de venta de caja eliminada', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProduct(page, {
      name: unique('Bebida anulación caja eliminada'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      stock: 10,
      minStock: 0,
      isActive: true,
    });

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: `caja-eliminada-${Date.now()}`,
      },
    });
    expect(venta.status()).toBe(201);
    const { id: ventaId, cashRegisterId } = (await venta.json()) as {
      id: number;
      cashRegisterId: number;
    };
    expect(cashRegisterId).toBeTruthy();

    const cerrar = await page.request.post('/api/caja/cerrar', {
      data: { id: cashRegisterId },
    });
    expect(cerrar.status()).toBe(200);

    const eliminar = await page.request.delete(`/api/caja/${cashRegisterId}`);
    expect(eliminar.status()).toBe(200);

    const anular = await page.request.post(`/api/ventas/${ventaId}/anular`, {
      data: { reason: 'Error de carga' },
    });
    expect(anular.status()).toBe(400);
    const body = (await anular.json()) as { error?: string };
    expect(body.error).toContain('caja cerrada o eliminada');

    const historial = await page.request.get(
      `/api/ventas?cashRegisterId=${cashRegisterId}`
    );
    expect(historial.status()).toBe(200);

    await page.request.post(`/api/caja/${cashRegisterId}/restaurar`);
    await page.request.delete(`/api/caja/${cashRegisterId}/permanente`);
  });
});

test.describe('Historial, papelera y restauración de cajas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await ensureCashRegisterClosed(page);
  });

  test('elimina, restaura y elimina permanentemente una caja', async ({
    page,
  }) => {
    const abrir = await page.request.post('/api/caja/abrir');
    expect(abrir.status()).toBe(201);
    const caja = (await abrir.json()) as { id: number };

    const cerrar = await page.request.post('/api/caja/cerrar', {
      data: { id: caja.id },
    });
    expect(cerrar.status()).toBe(200);

    const eliminar = await page.request.delete(`/api/caja/${caja.id}`);
    expect(eliminar.status()).toBe(200);

    const eliminadas = await page.request.get('/api/caja/eliminadas');
    expect(eliminadas.status()).toBe(200);
    const listaEliminadas = (await eliminadas.json()) as { id: number }[];
    expect(listaEliminadas.some((c) => c.id === caja.id)).toBe(true);

    const restaurar = await page.request.post(`/api/caja/${caja.id}/restaurar`);
    expect(restaurar.status()).toBe(200);

    const reEliminar = await page.request.delete(`/api/caja/${caja.id}`);
    expect(reEliminar.status()).toBe(200);

    const permanente = await page.request.delete(
      `/api/caja/${caja.id}/permanente`
    );
    expect(permanente.status()).toBe(200);

    const confirmar = await page.request.get(`/api/caja/${caja.id}`);
    expect(confirmar.status()).toBe(404);
  });

  test('vaciar papelera de cajas', async ({ page }) => {
    const abrir = await page.request.post('/api/caja/abrir');
    expect(abrir.status()).toBe(201);
    const caja = (await abrir.json()) as { id: number };

    const cerrar = await page.request.post('/api/caja/cerrar', {
      data: { id: caja.id },
    });
    expect(cerrar.status()).toBe(200);

    const eliminar = await page.request.delete(`/api/caja/${caja.id}`);
    expect(eliminar.status()).toBe(200);

    const start = new Date(Date.now() - 86400000).toISOString();
    const end = new Date().toISOString();
    const vaciar = await page.request.delete(
      `/api/caja/eliminadas?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
    expect(vaciar.status()).toBe(200);
    const body = (await vaciar.json()) as { deleted?: number };
    expect(body.deleted).toBeGreaterThan(0);

    const confirmar = await page.request.get(`/api/caja/${caja.id}`);
    expect(confirmar.status()).toBe(404);
  });
});
