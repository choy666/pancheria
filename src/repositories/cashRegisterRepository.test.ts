import * as cashRegisterRepository from './cashRegisterRepository';
import { executeInTransaction } from '@/application/transactionService';

/* eslint-disable no-var */

// Variables de mock asignadas desde el factory de `jest.mock` para evitar
// problemas de hoisting con `const`.
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

var mockExecuteInTransaction: jest.Mock;

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

  return {
    db: {
      query: {
        cashRegisters: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };
});

jest.mock('@/application/transactionService', () => {
  mockExecuteInTransaction = jest.fn();
  return { executeInTransaction: mockExecuteInTransaction };
});

const mockedExecuteInTransaction = executeInTransaction as jest.MockedFunction<
  typeof executeInTransaction
>;

describe('cashRegisterRepository', () => {
  // Mocks para la transacción usada en `hardDelete` y `hardDeleteAllDeletedInRange`.
  let txSelectWhere: jest.Mock;
  let txFrom: jest.Mock;
  let txSelect: jest.Mock;
  let txUpdateWhere: jest.Mock;
  let txSet: jest.Mock;
  let txUpdate: jest.Mock;
  let txDeleteWhere: jest.Mock;
  let txDelete: jest.Mock;

  beforeEach(() => {
    txSelectWhere = jest.fn();
    txFrom = jest.fn(() => ({ where: txSelectWhere }));
    txSelect = jest.fn(() => ({ from: txFrom }));
    txUpdateWhere = jest.fn();
    txSet = jest.fn(() => ({ where: txUpdateWhere }));
    txUpdate = jest.fn(() => ({ set: txSet }));
    txDeleteWhere = jest.fn();
    txDelete = jest.fn(() => ({ where: txDeleteWhere }));

    const mockTx: any = {
      select: txSelect,
      update: txUpdate,
      delete: txDelete,
    };

    mockedExecuteInTransaction.mockImplementation(async (fn: any) =>
      fn(mockTx)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOpen', () => {
    test('devuelve la caja abierta cuando existe', async () => {
      const expected = {
        id: 1,
        openedAt: new Date(),
        openedBy: 'admin',
        status: 'open',
        deletedAt: null,
      };
      mockFindFirst.mockResolvedValue(expected);

      const result = await cashRegisterRepository.findOpen();

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve undefined si no hay caja abierta', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await cashRegisterRepository.findOpen();

      expect(result).toBeUndefined();
    });
  });

  describe('findById', () => {
    test('obtiene una caja por su id incluyendo relaciones', async () => {
      const expected = {
        id: 1,
        openedAt: new Date(),
        openedBy: 'admin',
        status: 'open',
        sales: [],
      };
      mockFindFirst.mockResolvedValue(expected);

      const result = await cashRegisterRepository.findById(1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: expect.objectContaining({
            sales: expect.anything(),
          }),
        })
      );
    });

    test('devuelve undefined cuando la caja no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await cashRegisterRepository.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('findInRange', () => {
    test('devuelve las cajas en un rango sin filtro de estado', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      const expected = [{ id: 1 }, { id: 2 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await cashRegisterRepository.findInRange(start, end);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.any(Array),
        })
      );
    });

    test('devuelve las cajas filtradas por estado', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      const expected = [{ id: 1, status: 'closed' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await cashRegisterRepository.findInRange(
        start,
        end,
        'closed'
      );

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.any(Array),
        })
      );
    });

    test('devuelve un array vacío cuando no hay resultados', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await cashRegisterRepository.findInRange(
        new Date(),
        new Date()
      );

      expect(result).toEqual([]);
    });
  });

  describe('findClosedInRange', () => {
    test('delega a findInRange con el estado closed', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      const expected = [{ id: 1, status: 'closed' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await cashRegisterRepository.findClosedInRange(start, end);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.any(Array),
        })
      );
    });
  });

  describe('findDeletedInRange', () => {
    test('devuelve las cajas eliminadas en el rango', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      const expected = [{ id: 1, deletedAt: new Date() }];
      mockFindMany.mockResolvedValue(expected);

      const result = await cashRegisterRepository.findDeletedInRange(start, end);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.any(Array),
        })
      );
    });
  });

  describe('create', () => {
    test('crea una caja abierta y devuelve el registro', async () => {
      const openedAt = new Date('2026-08-01T08:00:00.000Z');
      const expected = {
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
      };
      mockReturning.mockResolvedValue([expected]);

      const result = await cashRegisterRepository.create({
        openedAt,
        openedBy: 'admin',
      });

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
    });

    test('devuelve undefined si la inserción no devuelve filas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await cashRegisterRepository.create({
        openedAt: new Date(),
        openedBy: 'admin',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('update', () => {
    test('actualiza una caja y devuelve el registro', async () => {
      const expected = { id: 1, openedBy: 'otro' };
      mockReturning.mockResolvedValue([expected]);

      const result = await cashRegisterRepository.update(1, { openedBy: 'otro' });

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
    });

    test('devuelve null si la caja no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await cashRegisterRepository.update(999, {
        openedBy: 'otro',
      });

      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    test('marca la caja como eliminada y devuelve el registro', async () => {
      const expected = { id: 1, deletedAt: new Date() };
      mockReturning.mockResolvedValue([expected]);

      const result = await cashRegisterRepository.softDelete(1);

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
    });

    test('devuelve null si la caja no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await cashRegisterRepository.softDelete(999);

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    test('restaura una caja eliminada', async () => {
      const expected = { id: 1, deletedAt: null };
      mockReturning.mockResolvedValue([expected]);

      const result = await cashRegisterRepository.restore(1);

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
    });

    test('devuelve null si la caja no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await cashRegisterRepository.restore(999);

      expect(result).toBeNull();
    });
  });

  describe('hardDelete', () => {
    test('elimina definitivamente una caja previamente marcada como eliminada', async () => {
      txSelectWhere.mockResolvedValue([{ deletedAt: new Date() }]);
      txUpdateWhere.mockResolvedValue(undefined);
      txDeleteWhere.mockResolvedValue(undefined);

      const result = await cashRegisterRepository.hardDelete(1);

      expect(result).toEqual({ deleted: true });
      expect(txSelect).toHaveBeenCalled();
      expect(txUpdate).toHaveBeenCalled();
      expect(txDelete).toHaveBeenCalled();
    });

    test('no elimina si la caja no está marcada como eliminada', async () => {
      txSelectWhere.mockResolvedValue([{ deletedAt: null }]);

      const result = await cashRegisterRepository.hardDelete(1);

      expect(result).toEqual({ deleted: false });
      expect(txSelect).toHaveBeenCalled();
      expect(txUpdate).not.toHaveBeenCalled();
      expect(txDelete).not.toHaveBeenCalled();
    });

    test('no elimina si la caja no existe', async () => {
      txSelectWhere.mockResolvedValue([]);

      const result = await cashRegisterRepository.hardDelete(999);

      expect(result).toEqual({ deleted: false });
      expect(txSelect).toHaveBeenCalled();
      expect(txDelete).not.toHaveBeenCalled();
    });
  });

  describe('hardDeleteAllDeletedInRange', () => {
    test('elimina todas las cajas eliminadas en el rango', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      txSelectWhere.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      txUpdateWhere.mockResolvedValue(undefined);
      txDeleteWhere.mockResolvedValue(undefined);

      const result = await cashRegisterRepository.hardDeleteAllDeletedInRange(
        start,
        end
      );

      expect(result).toEqual({ deleted: 2 });
      expect(txUpdate).toHaveBeenCalled();
      expect(txDelete).toHaveBeenCalled();
    });

    test('devuelve deleted: 0 si no hay cajas eliminadas en el rango', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      txSelectWhere.mockResolvedValue([]);

      const result = await cashRegisterRepository.hardDeleteAllDeletedInRange(
        start,
        end
      );

      expect(result).toEqual({ deleted: 0 });
      expect(txUpdate).not.toHaveBeenCalled();
      expect(txDelete).not.toHaveBeenCalled();
    });
  });
});
