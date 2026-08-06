import {
  getOpenCashRegister,
  openCashRegister,
  closeCashRegister,
  deleteCashRegister,
  restoreCashRegister,
  permanentlyDeleteCashRegister,
  getCashRegisterById,
} from './cashRegisterService';
import * as cashRegisterRepository from '@/repositories/cashRegisterRepository';
import { executeInTransaction } from '@/application/transactionService';
import { db } from '@/db';
import { ValidationError, NotFoundError } from '@/domain/errors';

jest.mock('@/repositories/cashRegisterRepository');
jest.mock('@/application/transactionService', () => ({
  executeInTransaction: jest.fn(),
}));
jest.mock('@/db', () => ({
  db: {
    query: {
      sales: {
        findMany: jest.fn(),
      },
      recipes: {
        findMany: jest.fn(),
      },
      products: {
        findMany: jest.fn(),
      },
    },
  },
}));

const mockedCashRegisterRepository = cashRegisterRepository as jest.Mocked<
  typeof cashRegisterRepository
>;
const mockedDb = db as jest.Mocked<typeof db>;
const mockedExecuteInTransaction = executeInTransaction as jest.MockedFunction<
  typeof executeInTransaction
>;

let mockUpdate: jest.Mock;

function createMockCashRegister() {
  return {
    id: 1,
    status: 'closed',
    total: 1000,
    cashTotal: 1000,
    transferTotal: 0,
    totalSales: 1,
    productsSummary: '{"Panchuque":1}',
    criticalSuppliesSummary: '{"Pan":1}',
  };
}

describe('cashRegisterService', () => {
  beforeEach(() => {
    mockUpdate = jest.fn();
    mockedExecuteInTransaction.mockImplementation(async (fn) =>
      fn({
        update: () => ({
          set: () => ({
            where: () => ({
              returning: mockUpdate,
            }),
          }),
        }),
      } as any)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOpenCashRegister', () => {
    test('devuelve la caja abierta si no superó las 12 horas', async () => {
      const openedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
      } as any);

      const result = await getOpenCashRegister();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    test('cierra automáticamente la caja si superó las 12 horas', async () => {
      const openedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
      } as any);

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getOpenCashRegister();

      expect(result).toBeNull();
    });
  });

  describe('openCashRegister', () => {
    test('crea una caja nueva si no hay abierta', async () => {
      mockedCashRegisterRepository.findOpen.mockResolvedValue(undefined);
      mockedCashRegisterRepository.create.mockResolvedValue({
        id: 1,
        openedAt: new Date(),
        openedBy: 'admin',
        status: 'open',
      } as any);

      const result = await openCashRegister('admin');

      expect(result?.openedBy).toBe('admin');
      expect(result?.status).toBe('open');
    });

    test('rechaza apertura si ya existe una caja abierta', async () => {
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        openedAt: new Date(),
        openedBy: 'admin',
        status: 'open',
      } as any);

      await expect(openCashRegister('admin')).rejects.toThrow(ValidationError);
    });
  });

  describe('closeCashRegister', () => {
    test('calcula totales y resumen al cerrar caja', async () => {
      mockUpdate.mockResolvedValue([createMockCashRegister()]);

      const openedAt = new Date();
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
      } as any);

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          total: 1000,
          paymentMethod: 'cash',
          status: 'active',
          items: [
            {
              quantity: 1,
              product: { id: 1, name: 'Panchuque', type: 'compound' },
            },
          ],
        },
      ] as any);

      (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          compoundProductId: 1,
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supply: { id: 2, name: 'Pan' },
        },
      ] as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, name: 'Pan', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await closeCashRegister(1, 'admin');

      expect(result?.status).toBe('closed');
      expect(result?.totalSales).toBe(1);
    });
  });

  describe('getCashRegisterById', () => {
    test('obtiene una caja por su ID', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: null,
      } as any);

      const result = await getCashRegisterById(1);

      expect(result?.id).toBe(1);
      expect(mockedCashRegisterRepository.findById).toHaveBeenCalledWith(1, false);
    });
  });

  describe('deleteCashRegister', () => {
    test('realiza soft delete de una caja cerrada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: null,
      } as any);
      mockedCashRegisterRepository.softDelete.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: new Date(),
      } as any);

      const result = await deleteCashRegister(1);

      expect(result?.id).toBe(1);
      expect(mockedCashRegisterRepository.softDelete).toHaveBeenCalledWith(1);
    });

    test('rechaza eliminar una caja abierta', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'open',
        deletedAt: null,
      } as any);

      await expect(deleteCashRegister(1)).rejects.toThrow(ValidationError);
      expect(mockedCashRegisterRepository.softDelete).not.toHaveBeenCalled();
    });

    test('lanza NotFoundError si la caja no existe', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue(undefined);

      await expect(deleteCashRegister(1)).rejects.toThrow(NotFoundError);
    });
  });

  describe('restoreCashRegister', () => {
    test('restaura una caja eliminada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: new Date(),
      } as any);
      mockedCashRegisterRepository.restore.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: null,
      } as any);

      const result = await restoreCashRegister(1);

      expect(result?.deletedAt).toBeNull();
      expect(mockedCashRegisterRepository.restore).toHaveBeenCalledWith(1);
    });

    test('rechaza restaurar una caja no eliminada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: null,
      } as any);

      await expect(restoreCashRegister(1)).rejects.toThrow(ValidationError);
    });
  });

  describe('permanentlyDeleteCashRegister', () => {
    test('elimina definitivamente una caja en la papelera', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: new Date(),
      } as any);
      mockedCashRegisterRepository.hardDelete.mockResolvedValue({
        deleted: true,
      } as any);

      const result = await permanentlyDeleteCashRegister(1);

      expect(result).toEqual({ deleted: true });
      expect(mockedCashRegisterRepository.hardDelete).toHaveBeenCalledWith(1);
    });

    test('rechaza eliminar definitivamente una caja no eliminada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
        deletedAt: null,
      } as any);

      await expect(permanentlyDeleteCashRegister(1)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
