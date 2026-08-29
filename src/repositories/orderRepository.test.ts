import * as orderRepository from './orderRepository';
import { orders, orderItems } from '@/db/schema';


var mockFindFirst: jest.Mock;
var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockWhereReturning: jest.Mock;
var mockSet: jest.Mock;
var mockUpdate: jest.Mock;
var mockFrom: jest.Mock;
var mockWhere: jest.Mock;
var mockSelect: jest.Mock;

jest.mock('@/db', () => {
  mockFindFirst = jest.fn();
  mockFindMany = jest.fn();
  const mockOrderMessagesFindMany = jest.fn().mockResolvedValue([]);
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockWhereReturning = jest.fn(() => ({ returning: mockReturning }));
  mockSet = jest.fn(() => ({ where: mockWhereReturning }));
  mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockWhere = jest.fn().mockResolvedValue([{ count: '1' }]);
  mockFrom = jest.fn(() => ({ where: mockWhere }));
  mockSelect = jest.fn(() => ({ from: mockFrom }));

  return {
    db: {
      query: {
        orders: { findFirst: mockFindFirst, findMany: mockFindMany },
        orderMessages: { findMany: mockOrderMessagesFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
    },
  };
});

const BRANCH_ID = 1;
const ORDER_ID = 10;

function buildOrder(overrides: Partial<typeof orders.$inferSelect> = {}): typeof orders.$inferSelect {
  return {
    id: ORDER_ID,
    branchId: BRANCH_ID,
    orderNumber: 'PED-1-1234567890-abc123',
    total: 5000,
    status: 'pending',
    customerName: 'Juan',
    customerPhone: '3415555555',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    cancellationToken: 'token',
    convertedSaleId: null,
    idempotencyKey: null,
    createdAt: new Date('2024-01-01'),
    cancelledAt: null,
    cancellationReason: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('orderRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    test('devuelve un pedido con items y sucursal', async () => {
      const expected = { ...buildOrder(), items: [] };
      mockFindFirst.mockResolvedValue(expected);

      const result = await orderRepository.findById(BRANCH_ID, ORDER_ID);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: {
            branch: true,
            items: { with: { product: true, recipeSnapshots: true } },
          },
        })
      );
    });

    test('devuelve undefined si no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await orderRepository.findById(BRANCH_ID, 999);

      expect(result).toBeUndefined();
    });
  });

  describe('findByIdForCancel', () => {
    test('devuelve pedido con items simples', async () => {
      const expected = {
        ...buildOrder(),
        items: [{ productId: 1, quantity: 2 }],
      };
      mockFindFirst.mockResolvedValue(expected);

      const result = await orderRepository.findByIdForCancel(BRANCH_ID, ORDER_ID);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          with: {
            branch: true,
            items: true,
          },
        })
      );
    });
  });

  describe('findByIdempotencyKey', () => {
    test('devuelve el pedido existente', async () => {
      const expected = { ...buildOrder(), items: [] };
      mockFindFirst.mockResolvedValue(expected);

      const result = await orderRepository.findByIdempotencyKey(BRANCH_ID, 'key-1');

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: {
            branch: true,
            items: { with: { product: true, recipeSnapshots: true } },
          },
        })
      );
    });

    test('devuelve null si no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await orderRepository.findByIdempotencyKey(BRANCH_ID, 'key-x');

      expect(result).toBeNull();
    });
  });

  describe('findPending', () => {
    test('devuelve pedidos pendientes ordenados por fecha', async () => {
      mockFindMany.mockResolvedValue([buildOrder()]);

      const result = await orderRepository.findPending(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });
  });

  describe('findOrders', () => {
    test('devuelve pedidos paginados', async () => {
      mockFindMany.mockResolvedValue([buildOrder()]);
      mockReturning.mockResolvedValue([{ count: '1' }]);

      const result = await orderRepository.findOrders(BRANCH_ID, { page: 1, limit: 5 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(orders);
    });

    test('filtra por status', async () => {
      mockFindMany.mockResolvedValue([buildOrder({ status: 'paid' })]);
      mockReturning.mockResolvedValue([{ count: '0' }]);

      await orderRepository.findOrders(BRANCH_ID, { status: 'paid' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
    });
  });

  describe('findExpiredPending', () => {
    test('devuelve pedidos pendientes vencidos para una sucursal', async () => {
      const cutoff = new Date('2024-01-01');
      mockFindMany.mockResolvedValue([buildOrder()]);

      const result = await orderRepository.findExpiredPending(BRANCH_ID, cutoff);

      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          with: { items: { with: { recipeSnapshots: true } } },
        })
      );
    });
  });

  describe('findExpiredPendingAll', () => {
    test('devuelve pedidos pendientes vencidos sin filtrar sucursal', async () => {
      const cutoff = new Date('2024-01-01');
      mockFindMany.mockResolvedValue([buildOrder()]);

      const result = await orderRepository.findExpiredPendingAll(cutoff);

      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: { items: { with: { recipeSnapshots: true } } },
        })
      );
    });
  });

  describe('insertOrder', () => {
    test('inserta un pedido y devuelve el registro', async () => {
      const expected = buildOrder();
      mockReturning.mockResolvedValue([expected]);

      const tx: any = { insert: mockInsert };
      const result = await orderRepository.insertOrder(tx, expected);

      expect(result).toEqual(expected);
      expect(mockValues).toHaveBeenCalledWith(expected);
    });

    test('lanza error si no se pudo crear', async () => {
      mockReturning.mockResolvedValue([]);

      const tx: any = { insert: mockInsert };

      await expect(orderRepository.insertOrder(tx, buildOrder())).rejects.toThrow(
        'No se pudo crear el pedido.'
      );
    });
  });

  describe('insertOrderItems', () => {
    test('inserta los items del pedido', async () => {
      mockReturning.mockResolvedValue([]);

      const tx: any = { insert: mockInsert };
      const values = [{ orderId: ORDER_ID, productId: 1, quantity: 2, unitPrice: 1000, subtotal: 2000 }];

      await orderRepository.insertOrderItems(tx, values);

      expect(mockValues).toHaveBeenCalledWith(values);
    });
  });

  describe('updateStatus', () => {
    test('actualiza el estado y devuelve el pedido', async () => {
      const expected = buildOrder({ status: 'paid', convertedSaleId: 5 });
      mockReturning.mockResolvedValue([expected]);

      const tx: any = { update: mockUpdate };
      const result = await orderRepository.updateStatus(tx, BRANCH_ID, ORDER_ID, {
        status: 'paid',
        convertedSaleId: 5,
      });

      expect(result).toEqual(expected);
      expect(mockSet).toHaveBeenCalledWith({ status: 'paid', convertedSaleId: 5 });
    });

    test('lanza error si no encuentra el pedido', async () => {
      mockReturning.mockResolvedValue([]);

      const tx: any = { update: mockUpdate };

      await expect(
        orderRepository.updateStatus(tx, BRANCH_ID, ORDER_ID, { status: 'paid' })
      ).rejects.toThrow('No se pudo actualizar el pedido.');
    });
  });

  describe('cancel', () => {
    test('cancela el pedido y devuelve el registro actualizado', async () => {
      const expected = buildOrder({ status: 'cancelled' });
      mockReturning.mockResolvedValue([expected]);

      const tx: any = { update: mockUpdate };
      const result = await orderRepository.cancel(tx, BRANCH_ID, ORDER_ID, {
        status: 'cancelled',
        cancelledAt: new Date(),
      });

      expect(result).toEqual(expected);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      );
    });

    test('lanza error si no encuentra el pedido', async () => {
      mockReturning.mockResolvedValue([]);

      const tx: any = { update: mockUpdate };
      await expect(
        orderRepository.cancel(tx, BRANCH_ID, ORDER_ID, { status: 'cancelled' })
      ).rejects.toThrow('No se pudo cancelar el pedido.');
    });
  });

});
