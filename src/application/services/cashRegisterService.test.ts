import {
  getOpenCashRegister,
  openCashRegister,
  closeCashRegister,
  deleteCashRegister,
  restoreCashRegister,
  permanentlyDeleteCashRegister,
  getCashRegisterById,
  getOpenCashRegisterSummary,
  autoCloseIfNeeded,
  listCashRegisterHistory,
  listDeletedCashRegisterHistory,
  emptyTrash,
  calculateCashRegisterSummary,
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
let mockSelectResult: unknown[];
let mockInsertResult: unknown[];

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
    mockSelectResult = [];
    mockInsertResult = [];
    mockedExecuteInTransaction.mockImplementation(async (fn) =>
      fn({
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              for: jest.fn().mockResolvedValue(mockSelectResult),
            })),
          })),
        })),
        insert: jest.fn(() => ({
          values: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue(mockInsertResult),
          })),
        })),
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

      mockSelectResult = [
        {
          id: 1,
          openedAt,
          openedBy: 'admin',
          status: 'open',
          autoClosed: false,
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getOpenCashRegister();

      expect(result).toBeNull();
      expect(mockedExecuteInTransaction).toHaveBeenCalled();
    });
  });

  describe('getOpenCashRegisterSummary', () => {
    test('devuelve totales y resumen parseado de la caja abierta', async () => {
      const openedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
        total: 2000,
        cashTotal: 2000,
        transferTotal: 0,
        totalSales: 1,
        productsSummary: '{"Gaseosa":2}',
        criticalSuppliesSummary: '{"Gaseosa":2}',
      } as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, name: 'Gaseosa', type: 'critical_supply', isActive: true },
        { id: 3, name: 'Pan', type: 'critical_supply', isActive: true },
      ] as any);

      const result = (await getOpenCashRegisterSummary()) as any;

      expect(result).not.toBeNull();
      expect(result.id).toBe(1);
      expect(result.status).toBe('open');
      expect(result.total).toBe(2000);
      expect(result.cashTotal).toBe(2000);
      expect(result.transferTotal).toBe(0);
      expect(result.totalSales).toBe(1);
      expect(result.productsSummary).toEqual({ Gaseosa: 2 });
      expect(result.criticalSuppliesSummary).toEqual({
        Gaseosa: 2,
        Pan: 0,
      });
    });

    test('devuelve null si no hay caja abierta', async () => {
      mockedCashRegisterRepository.findOpen.mockResolvedValue(undefined);

      const result = await getOpenCashRegisterSummary();

      expect(result).toBeNull();
    });
  });

  describe('openCashRegister', () => {
    test('crea una caja nueva si no hay abierta', async () => {
      mockSelectResult = [];
      mockInsertResult = [
        {
          id: 1,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
        },
      ];

      const result = await openCashRegister('admin');

      expect(result?.openedBy).toBe('admin');
      expect(result?.status).toBe('open');
    });

    test('rechaza apertura si ya existe una caja abierta', async () => {
      mockSelectResult = [
        {
          id: 1,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
        },
      ];

      await expect(openCashRegister('admin')).rejects.toThrow(ValidationError);
    });

    test('rechaza apertura si el índice único detecta una caja concurrente', async () => {
      mockedExecuteInTransaction.mockRejectedValueOnce({ code: '23505' });

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

    test('rechaza cerrar una caja ya cerrada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        status: 'closed',
      } as any);

      await expect(closeCashRegister(1, 'admin')).rejects.toThrow(
        'La caja ya está cerrada.'
      );
      await expect(closeCashRegister(1, 'admin')).rejects.toThrow(ValidationError);
      expect(mockedDb.query.sales.findMany).not.toHaveBeenCalled();
    });

    test('lanza NotFoundError si la caja no existe', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue(undefined);

      await expect(closeCashRegister(999, 'admin')).rejects.toThrow(
        NotFoundError
      );
      await expect(closeCashRegister(999, 'admin')).rejects.toThrow(
        'Caja con ID 999 no encontrado.'
      );
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

  describe('listCashRegisterHistory', () => {
    test('lista el historial de cajas en un rango', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [
        { id: 1, status: 'closed' },
        { id: 2, status: 'open' },
      ];

      mockedCashRegisterRepository.findInRange.mockResolvedValue(history as any);

      const result = await listCashRegisterHistory(start, end);

      expect(result).toEqual(history);
      expect(mockedCashRegisterRepository.findInRange).toHaveBeenCalledWith(
        start,
        end,
        undefined
      );
    });

    test('puede filtrar historial por estado', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [{ id: 1, status: 'closed' }];

      mockedCashRegisterRepository.findInRange.mockResolvedValue(history as any);

      const result = await listCashRegisterHistory(start, end, 'closed');

      expect(result).toEqual(history);
      expect(mockedCashRegisterRepository.findInRange).toHaveBeenCalledWith(
        start,
        end,
        'closed'
      );
    });
  });

  describe('listDeletedCashRegisterHistory', () => {
    test('lista cajas eliminadas en un rango', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [{ id: 1, deletedAt: new Date() }];

      mockedCashRegisterRepository.findDeletedInRange.mockResolvedValue(
        history as any
      );

      const result = await listDeletedCashRegisterHistory(start, end);

      expect(result).toEqual(history);
      expect(mockedCashRegisterRepository.findDeletedInRange).toHaveBeenCalledWith(
        start,
        end
      );
    });
  });

  describe('emptyTrash', () => {
    test('elimina permanentemente las cajas en papelera del rango', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');

      mockedCashRegisterRepository.hardDeleteAllDeletedInRange.mockResolvedValue({
        deleted: 2,
      } as any);

      const result = await emptyTrash(start, end);

      expect(result).toEqual({ deleted: 2 });
      expect(
        mockedCashRegisterRepository.hardDeleteAllDeletedInRange
      ).toHaveBeenCalledWith(start, end);
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

  describe('autoCloseIfNeeded', () => {
    test('devuelve la caja si no superó las 12 horas', async () => {
      const openedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
      } as any);

      const result = await autoCloseIfNeeded();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    test('cierra automáticamente una caja vencida', async () => {
      const openedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        openedAt,
        openedBy: 'admin',
        status: 'open',
      } as any);

      mockSelectResult = [
        {
          id: 1,
          openedAt,
          openedBy: 'admin',
          status: 'open',
          autoClosed: false,
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([]);

      const result = await autoCloseIfNeeded();

      expect(result).toBeNull();
      expect(mockedExecuteInTransaction).toHaveBeenCalled();
    });
  });

  describe('calculateCashRegisterSummary', () => {
    test('calcula totales con múltiples ventas, transferencias y bebidas', async () => {
      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          total: 1500,
          paymentMethod: 'cash',
          status: 'active',
          items: [
            {
              quantity: 1,
              product: { id: 1, name: 'Panchuque', type: 'compound' },
            },
          ],
        },
        {
          id: 2,
          total: 800,
          paymentMethod: 'transfer',
          status: 'active',
          items: [
            {
              quantity: 2,
              product: {
                id: 2,
                name: 'Gaseosa',
                type: 'critical_supply',
                criticalSupplyType: 'beverage',
              },
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
        { id: 3, name: 'Gaseosa', type: 'critical_supply', isActive: true },
        { id: 4, name: 'Salchicha', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await calculateCashRegisterSummary(1);

      expect(result.total).toBe(2300);
      expect(result.cashTotal).toBe(1500);
      expect(result.transferTotal).toBe(800);
      expect(result.totalSales).toBe(2);
      expect(JSON.parse(result.productsSummary)).toEqual({
        Panchuque: 1,
        Gaseosa: 2,
      });
      expect(JSON.parse(result.criticalSuppliesSummary)).toEqual({
        Pan: 1,
        Gaseosa: 2,
        Salchicha: 0,
      });
    });
  });
});
