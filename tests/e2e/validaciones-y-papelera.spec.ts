import { test, expect } from '@playwright/test';
import {
  ensureCashRegisterClosed,
  ensureCashRegisterOpen,
  login,
  unique,
  createProductViaApi,
  restockProductViaApi,
} from './helpers';

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

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida sin caja'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      
      minStock: 2,
      isActive: true,
    });
    await restockProductViaApi(page, bebida.id, 10);

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 500 }],
        idempotencyKey: `sin-caja-${Date.now()}`,
      },
    });

    expect(venta.status()).toBe(400);
    const body = (await venta.json()) as { error?: string };
    expect(body.error).toContain('No hay una caja abierta');
  });

  test('rechaza venta por stock insuficiente', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida stock bajo'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      
      minStock: 0,
      isActive: true,
    });
    await restockProductViaApi(page, bebida.id, 1);

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 2 }],
        payments: [{ method: 'cash', amount: 500 * 2 }],
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

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida idempotencia'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      
      minStock: 0,
      isActive: true,
    });
    await restockProductViaApi(page, bebida.id, 5);

    const key = `idempotencia-${Date.now()}`;

    const venta1 = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        payments: [{ method: 'transfer', amount: 500 }],
        idempotencyKey: key,
      },
    });
    expect(venta1.status()).toBe(201);

    const venta2 = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        payments: [{ method: 'transfer', amount: 500 }],
        idempotencyKey: key,
      },
    });
    expect(venta2.status()).toBe(400);
    const body = (await venta2.json()) as { error?: string };
    expect(body.error).toContain('ya fue procesada');

    await ensureCashRegisterClosed(page);
  });

  test('rechaza anulación de venta de caja eliminada', async ({ page }) => {
    await ensureCashRegisterOpen(page);

    const bebida = await createProductViaApi(page, {
      name: unique('Bebida anulación caja eliminada'),
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 500,
      unit: 'unidad',
      
      minStock: 0,
      isActive: true,
    });
    await restockProductViaApi(page, bebida.id, 10);

    const venta = await page.request.post('/api/ventas', {
      data: {
        items: [{ productId: bebida.id, quantity: 1 }],
        payments: [{ method: 'cash', amount: 500 }],
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
    const bodyEliminadas = (await eliminadas.json()) as { items: { id: number }[] };
    const listaEliminadas = bodyEliminadas.items;
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
