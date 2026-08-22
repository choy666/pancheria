/**
 * @jest-environment jsdom
 */
import {
  getRecentOrders,
  addRecentOrder,
  removeRecentOrder,
  buildChatUrl,
  type RecentOrder,
} from './recent-orders';

const STORAGE_KEY = 'pancheria-recent-orders-v1';

function makeOrder(overrides: Partial<RecentOrder> = {}): RecentOrder {
  return {
    id: 1,
    orderNumber: 'PED-1-1234567890-abc',
    cancellationToken: 'token',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    branchId: 1,
    branchName: 'Sucursal A',
    ...overrides,
  };
}

describe('recent-orders', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('devuelve un arreglo vacío cuando no hay pedidos guardados', () => {
    expect(getRecentOrders()).toEqual([]);
  });

  test('guarda y recupera un pedido', () => {
    const order = makeOrder();
    addRecentOrder(order);

    const orders = getRecentOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(order.id);
  });

  test('descarta pedidos vencidos al leer', () => {
    const expired = makeOrder({
      id: 1,
      expiresAt: new Date(Date.now() - 1).toISOString(),
    });
    const active = makeOrder({ id: 2 });

    addRecentOrder(expired);
    addRecentOrder(active);

    const orders = getRecentOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(2);
  });

  test('limita la cantidad de pedidos guardados', () => {
    for (let i = 1; i <= 7; i += 1) {
      addRecentOrder(makeOrder({ id: i, orderNumber: `PED-${i}` }));
    }

    const orders = getRecentOrders();
    expect(orders).toHaveLength(5);
    expect(orders[0].id).toBe(7);
  });

  test('reemplaza un pedido existente si se vuelve a agregar', () => {
    addRecentOrder(makeOrder({ id: 1, orderNumber: 'PED-1' }));
    addRecentOrder(makeOrder({ id: 1, orderNumber: 'PED-1-updated' }));

    const orders = getRecentOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber).toBe('PED-1-updated');
  });

  test('elimina un pedido por id', () => {
    addRecentOrder(makeOrder({ id: 1 }));
    addRecentOrder(makeOrder({ id: 2 }));

    removeRecentOrder(1);

    const orders = getRecentOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(2);
  });

  test('no guarda pedidos vencidos', () => {
    const expired = makeOrder({
      expiresAt: new Date(Date.now() - 1).toISOString(),
    });

    addRecentOrder(expired);

    expect(getRecentOrders()).toEqual([]);
  });

  test('buildChatUrl construye la ruta del chat', () => {
    expect(buildChatUrl(1, 'token abc')).toBe(
      '/pedido/1/chat?token=token%20abc'
    );
  });
});
