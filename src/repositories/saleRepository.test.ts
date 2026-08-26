import * as saleRepository from './saleRepository';


var mockFindFirst: jest.Mock;
var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockWhereReturning: jest.Mock;
var mockSet: jest.Mock;
var mockUpdate: jest.Mock;
var mockDeleteWhere: jest.Mock;
var mockDelete: jest.Mock;
var mockSelect: jest.Mock;

jest.mock('@/db', () => {
  mockFindFirst = jest.fn();
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockWhereReturning = jest.fn(() => ({ returning: mockReturning }));
  mockSet = jest.fn(() => ({ where: mockWhereReturning }));
  mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockDeleteWhere = jest.fn();
  mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));
  mockSelect = jest.fn().mockImplementation(() => ({
    from: jest.fn().mockImplementation(() => ({
      where: jest.fn().mockResolvedValue([{ count: 0 }]),
    })),
  }));

  return {
    db: {
      query: {
        sales: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
    },
  };
});

const BRANCH_ID = 1;

describe('saleRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    test('devuelve una venta por su id con sus items y productos', async () => {
      const expected = {
        id: 1,
        total: 1000,
        items: [{ product: { id: 1, name: 'Panchuque' } }],
      };
      mockFindFirst.mockResolvedValue(expected);

      const result = await saleRepository.findById(BRANCH_ID, 1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: expect.objectContaining({
            items: expect.objectContaining({
              with: expect.objectContaining({
                product: true,
              }),
            }),
          }),
        })
      );
    });

    test('devuelve null si la venta no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await saleRepository.findById(BRANCH_ID, 999);

      expect(result).toBeNull();
    });
  });

  describe('findByDateRange', () => {
    test('devuelve ventas en un rango de fechas', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-02T00:00:00.000Z');
      const expected = [{ id: 1, total: 1000 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await saleRepository.findByDateRange(BRANCH_ID, start, end);

      expect(result.items).toEqual(expected);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(0);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve ventas filtradas por estado', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-02T00:00:00.000Z');
      const expected = [{ id: 1, status: 'cancelled' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await saleRepository.findByDateRange(BRANCH_ID, start, end, 'cancelled');

      expect(result.items).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve un array vacío si no hay ventas en el rango', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await saleRepository.findByDateRange(
        BRANCH_ID,
        new Date(),
        new Date()
      );

      expect(result.items).toEqual([]);
    });
  });

  describe('findByCashRegisterId', () => {
    test('devuelve las ventas de una caja registradora', async () => {
      const expected = [{ id: 1, cashRegisterId: 1 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await saleRepository.findByCashRegisterId(BRANCH_ID, 1);

      expect(result.items).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('puede filtrar las ventas de una caja por estado', async () => {
      const expected = [{ id: 1, cashRegisterId: 1, status: 'active' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await saleRepository.findByCashRegisterId(BRANCH_ID, 1, 'active');

      expect(result.items).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('puede paginar las ventas de una caja', async () => {
      const expected = [{ id: 1, cashRegisterId: 1 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await saleRepository.findByCashRegisterId(BRANCH_ID, 1, undefined, {
        page: 2,
        limit: 50,
      });

      expect(result.items).toEqual(expected);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
          limit: 50,
          offset: 50,
        })
      );
    });
  });

  describe('create', () => {
    test('crea una venta con sus items', async () => {
      const sale = {
        id: 1,
        branchId: BRANCH_ID,
        total: 1000,
        paymentMethod: 'cash',
        cashRegisterId: 1,
        idempotencyKey: 'abc',
      };
      const items = [
        { productId: 1, quantity: 2, unitPrice: 500, subtotal: 1000 },
      ];
      mockReturning.mockResolvedValue([sale]);

      const result = await saleRepository.create({
        branchId: BRANCH_ID,
        total: 1000,
        paymentMethod: 'cash',
        cashRegisterId: 1,
        idempotencyKey: 'abc',
        items,
      });

      expect(result).toEqual(sale);
      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(mockValues).toHaveBeenNthCalledWith(1, {
        branchId: BRANCH_ID,
        total: 1000,
        paymentMethod: 'cash',
        cashRegisterId: 1,
        idempotencyKey: 'abc',
      });
      expect(mockValues).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([
          expect.objectContaining({
            saleId: 1,
            productId: 1,
            quantity: 2,
            unitPrice: 500,
            subtotal: 1000,
          }),
        ])
      );
    });

    test('lanza error si no se pudo crear la venta', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(
        saleRepository.create({
          branchId: BRANCH_ID,
          total: 1000,
          paymentMethod: 'cash',
          cashRegisterId: 1,
          idempotencyKey: 'abc',
          items: [
            { productId: 1, quantity: 1, unitPrice: 1000, subtotal: 1000 },
          ],
        })
      ).rejects.toThrow('No se pudo crear la venta.');
    });
  });

  describe('cancel', () => {
    test('cancela una venta y devuelve el registro', async () => {
      const expected = {
        id: 1,
        status: 'cancelled',
        cancellationReason: 'Error en pedido',
      };
      mockReturning.mockResolvedValue([expected]);

      const result = await saleRepository.cancel(BRANCH_ID, 1, 'Error en pedido');

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          cancelledAt: expect.any(Date),
          cancellationReason: 'Error en pedido',
        })
      );
    });

    test('devuelve null si la venta no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await saleRepository.cancel(BRANCH_ID, 999, 'Error');

      expect(result).toBeNull();
    });
  });
});
