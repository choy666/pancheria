/**
 * @jest-environment node
 */
import {
  findByOrderId,
  findActiveReservationsByProductIds,
  insertReservations,
  deleteByOrderId,
} from './orderStockReservationRepository';
import { orderStockReservations, orders } from '@/db/schema';
import { db } from '@/db';

jest.mock('@/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  delete: jest.Mock;
};

const BRANCH_ID = 1;

function createSelectBuilder(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

function createSubqueryBuilder(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

describe('orderStockReservationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByOrderId', () => {
    test('devuelve las reservas de un pedido', async () => {
      const rows = [
        { branchId: BRANCH_ID, orderId: 1, productId: 10, quantity: 2 },
      ];
      mockedDb.select.mockReturnValue(createSelectBuilder(rows));

      const result = await findByOrderId(db, 1);

      expect(result).toEqual(rows);
      expect(mockedDb.select).toHaveBeenCalled();
    });
  });

  describe('findActiveReservationsByProductIds', () => {
    test('devuelve las reservas activas agrupadas por producto', async () => {
      const orderRows = [{ orderId: 1 }];
      const reservationRows = [
        { productId: 10, quantity: 2 },
        { productId: 10, quantity: 1 },
        { productId: 20, quantity: 5 },
      ];

      mockedDb.select
        .mockReturnValueOnce(createSubqueryBuilder(orderRows))
        .mockReturnValueOnce(createSelectBuilder(reservationRows));

      const result = await findActiveReservationsByProductIds(
        db,
        BRANCH_ID,
        [10, 20]
      );

      expect(result).toEqual([
        { productId: 10, quantity: 3 },
        { productId: 20, quantity: 5 },
      ]);
    });

    test('excluye el pedido indicado', async () => {
      const orderRows = [{ orderId: 1 }, { orderId: 2 }];
      const reservationRows = [{ productId: 10, quantity: 2 }];

      mockedDb.select
        .mockReturnValueOnce(createSubqueryBuilder(orderRows))
        .mockReturnValueOnce(createSelectBuilder(reservationRows));

      const result = await findActiveReservationsByProductIds(
        db,
        BRANCH_ID,
        [10],
        2
      );

      expect(result).toEqual([{ productId: 10, quantity: 2 }]);
    });

    test('devuelve array vacío si no hay productIds', async () => {
      const result = await findActiveReservationsByProductIds(db, BRANCH_ID, []);

      expect(result).toEqual([]);
      expect(mockedDb.select).not.toHaveBeenCalled();
    });
  });

  describe('insertReservations', () => {
    test('inserta las reservas', async () => {
      const values = jest.fn().mockReturnValue({});
      mockedDb.insert.mockReturnValue({ values });

      const reservations = [
        { branchId: BRANCH_ID, orderId: 1, productId: 10, quantity: 2 },
      ];

      await insertReservations(db, reservations);

      expect(mockedDb.insert).toHaveBeenCalledWith(orderStockReservations);
      expect(values).toHaveBeenCalledWith(reservations);
    });

    test('no inserta si el array está vacío', async () => {
      await insertReservations(db, []);

      expect(mockedDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('deleteByOrderId', () => {
    test('elimina las reservas de un pedido', async () => {
      const where = jest.fn().mockReturnValue({});
      mockedDb.delete.mockReturnValue({ where });

      await deleteByOrderId(db, 1);

      expect(mockedDb.delete).toHaveBeenCalledWith(orderStockReservations);
      expect(where).toHaveBeenCalled();
    });
  });
});
