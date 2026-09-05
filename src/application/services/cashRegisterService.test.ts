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

const BRANCH_ID = 1;

function createMockCashRegister() {
  return {
    id: 1,
    branchId: BRANCH_ID,
    status: 'closed',
    total: 1000,
    cashTotal: 1000,
    transferTotal: 0,
    totalSales: 1,
    productsSummary: { Panchuque: 1 },
    criticalSuppliesSummary: { Pan: 1 },
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
              orderBy: jest.fn(() => ({
                for: jest.fn().mockImplementation(() =>
                  Promise.resolve(mockSelectResult)
                ),
              })),
              for: jest.fn().mockImplementation(() =>
                Promise.resolve(mockSelectResult)
              ),
            })),
          })),
        })),
        query: mockedDb.query,
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
        branchId: BRANCH_ID,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
      } as any);

      const result = await getOpenCashRegister(BRANCH_ID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    test('cierra automáticamente la caja si superó las 12 horas', async () => {
      const openedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
      } as any);

      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt,
          openedBy: 'admin',
          status: 'open',
          autoClosed: false,
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getOpenCashRegister(BRANCH_ID);

      expect(result).toBeNull();
      expect(mockedExecuteInTransaction).toHaveBeenCalled();
    });

    test('no devuelve una caja de otra sucursal', async () => {
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        branchId: 999,
        openedAt: new Date(),
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
      } as any);

      const result = await getOpenCashRegister(BRANCH_ID);

      expect(result).toBeNull();
    });
  });

  describe('getOpenCashRegisterSummary', () => {
    test('devuelve totales y resumen parseado de la caja abierta', async () => {
      const openedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
        total: 2000,
        cashTotal: 2000,
        transferTotal: 0,
        totalSales: 1,
        productsSummary: { Gaseosa: 2 },
        criticalSuppliesSummary: { Gaseosa: 2 },
      } as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Gaseosa', type: 'critical_supply', isActive: true },
        { id: 3, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
      ] as any);

      const result = (await getOpenCashRegisterSummary(BRANCH_ID)) as any;

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

    test('completa los insumos críticos activos faltantes en una caja sin ventas', async () => {
      const openedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        openedAt,
        openedBy: 'admin',
        status: 'open',
        autoClosed: false,
        total: 0,
        cashTotal: 0,
        transferTotal: 0,
        totalSales: 0,
        productsSummary: {},
        criticalSuppliesSummary: {},
        recipeSuppliesSummary: {},
      } as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Gaseosa', type: 'critical_supply', isActive: true },
        { id: 3, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
        { id: 4, branchId: BRANCH_ID, name: 'Salchicha', type: 'critical_supply', isActive: true },
      ] as any);

      const result = (await getOpenCashRegisterSummary(BRANCH_ID)) as any;

      expect(result).not.toBeNull();
      expect(result.criticalSuppliesSummary).toEqual({
        Gaseosa: 0,
        Pan: 0,
        Salchicha: 0,
      });
    });

    test('devuelve null si no hay caja abierta', async () => {
      mockedCashRegisterRepository.findOpen.mockResolvedValue(undefined);

      const result = await getOpenCashRegisterSummary(BRANCH_ID);

      expect(result).toBeNull();
    });
  });

  describe('openCashRegister', () => {
    test('crea una caja nueva si no hay abierta', async () => {
      mockSelectResult = [];
      mockInsertResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
        },
      ];

      const result = await openCashRegister({ branchId: BRANCH_ID, openedBy: 'admin' });

      expect(result?.openedBy).toBe('admin');
      expect(result?.status).toBe('open');
    });

    test('rechaza apertura si ya existe una caja abierta', async () => {
      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
        },
      ];

      await expect(openCashRegister({ branchId: BRANCH_ID, openedBy: 'admin' })).rejects.toThrow(ValidationError);
    });

    test('rechaza apertura si el índice único detecta una caja concurrente', async () => {
      mockedExecuteInTransaction.mockRejectedValueOnce({ code: '23505' });

      await expect(openCashRegister({ branchId: BRANCH_ID, openedBy: 'admin' })).rejects.toThrow(ValidationError);
    });

    test('rechaza apertura sin sucursal o usuario válido', async () => {
      await expect(openCashRegister({ branchId: 0, openedBy: 'admin' })).rejects.toThrow(ValidationError);
      await expect(openCashRegister({ branchId: BRANCH_ID, openedBy: '' })).rejects.toThrow(ValidationError);
    });

    test('asigna branchId y openedBy al abrir caja', async () => {
      mockSelectResult = [];
      mockInsertResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'operador',
          status: 'open',
          initialAmount: 0,
        },
      ];

      const result = await openCashRegister({ branchId: BRANCH_ID, openedBy: 'operador' });

      expect(result?.branchId).toBe(BRANCH_ID);
      expect(result?.openedBy).toBe('operador');
    });

    test('guarda el monto inicial al abrir caja', async () => {
      mockSelectResult = [];
      mockInsertResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'operador',
          status: 'open',
          initialAmount: 500,
        },
      ];

      const result = await openCashRegister({ branchId: BRANCH_ID, openedBy: 'operador', initialAmount: 500 });

      expect(result?.initialAmount).toBe(500);
    });

    test('rechaza un monto inicial negativo', async () => {
      mockSelectResult = [];

      await expect(openCashRegister({ branchId: BRANCH_ID, openedBy: 'operador', initialAmount: -100 })).rejects.toThrow(ValidationError);
    });
  });

  describe('closeCashRegister', () => {
    test('calcula totales y resumen al cerrar caja', async () => {
      mockUpdate.mockResolvedValue([createMockCashRegister()]);

      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          total: 1000,
          paymentMethod: 'cash',
          payments: [{ method: 'cash', amount: 1000 }],
          status: 'active',
          items: [
            {
              quantity: 1,
              product: { id: 1, branchId: BRANCH_ID, name: 'Panchuque', type: 'compound' },
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
          supply: { id: 2, branchId: BRANCH_ID, name: 'Pan' },
        },
      ] as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await closeCashRegister(BRANCH_ID, 1, 'admin');

      expect(result?.status).toBe('closed');
      expect(result?.totalSales).toBe(1);
    });

    test('rechaza cerrar una caja ya cerrada', async () => {
      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          status: 'closed',
          deletedAt: null,
        },
      ];

      await expect(closeCashRegister(BRANCH_ID, 1, 'admin')).rejects.toThrow(
        'La caja ya está cerrada.'
      );
      await expect(closeCashRegister(BRANCH_ID, 1, 'admin')).rejects.toThrow(ValidationError);
      expect(mockedDb.query.sales.findMany).not.toHaveBeenCalled();
    });

    test('lanza NotFoundError si la caja no existe', async () => {
      mockSelectResult = [];

      await expect(closeCashRegister(BRANCH_ID, 999, 'admin')).rejects.toThrow(
        NotFoundError
      );
      await expect(closeCashRegister(BRANCH_ID, 999, 'admin')).rejects.toThrow(
        'Caja con ID 999 no encontrado.'
      );
    });

    test('rechaza cierre con sucursal o usuario inválido', async () => {
      await expect(closeCashRegister(0, 1, 'admin')).rejects.toThrow(ValidationError);
      await expect(closeCashRegister(BRANCH_ID, 1, '')).rejects.toThrow(ValidationError);
    });

    test('asigna branchId y closedBy al cerrar caja', async () => {
      mockUpdate.mockResolvedValue([
        { ...createMockCashRegister(), closedBy: 'operador' },
      ]);

      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([]);

      const result = await closeCashRegister(BRANCH_ID, 1, 'operador');

      expect(result?.branchId).toBe(BRANCH_ID);
      expect(result?.closedBy).toBe('operador');
    });

    test('registra el conteo de cierre y la diferencia con el efectivo esperado', async () => {
      mockUpdate.mockResolvedValue([
        {
          ...createMockCashRegister(),
          initialAmount: 200,
          cashTotal: 800,
          closingCashCount: 1050,
          closingDifference: 50,
          closingNotes: 'sobrante de vuelto',
          closedBy: 'operador',
        },
      ]);

      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt: new Date(),
          openedBy: 'admin',
          status: 'open',
          initialAmount: 200,
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          total: 800,
          paymentMethod: 'cash',
          payments: [{ method: 'cash', amount: 800 }],
          status: 'active',
          items: [
            {
              quantity: 1,
              product: { id: 1, branchId: BRANCH_ID, name: 'Panchuque', type: 'compound' },
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
          supply: { id: 2, branchId: BRANCH_ID, name: 'Pan' },
        },
      ] as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await closeCashRegister(BRANCH_ID, 1, 'operador', 1050, 'sobrante de vuelto');

      expect(result?.closingCashCount).toBe(1050);
      expect(result?.closingDifference).toBe(50);
      expect(result?.closingNotes).toBe('sobrante de vuelto');
    });

    test('rechaza un monto contado negativo al cerrar', async () => {
      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          status: 'open',
          deletedAt: null,
        },
      ];

      await expect(closeCashRegister(BRANCH_ID, 1, 'operador', -100)).rejects.toThrow(ValidationError);
    });
  });

  describe('getCashRegisterById', () => {
    test('obtiene una caja por su ID', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: null,
      } as any);

      const result = await getCashRegisterById(BRANCH_ID, 1);

      expect(result?.id).toBe(1);
      expect(mockedCashRegisterRepository.findById).toHaveBeenCalledWith(BRANCH_ID, 1, false);
    });
  });

  describe('listCashRegisterHistory', () => {
    test('lista el historial de cajas en un rango', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [
        { id: 1, branchId: BRANCH_ID, status: 'closed' },
        { id: 2, branchId: BRANCH_ID, status: 'open' },
      ];

      mockedCashRegisterRepository.findInRange.mockResolvedValue({
        items: history,
        total: 2,
        page: 1,
        limit: 10,
      } as any);

      const result = await listCashRegisterHistory(BRANCH_ID, start, end);

      expect(result.items).toEqual(history);
      expect(result.total).toBe(2);
      expect(mockedCashRegisterRepository.findInRange).toHaveBeenCalledWith(
        BRANCH_ID,
        start,
        end,
        undefined,
        undefined
      );
    });

    test('puede filtrar historial por estado', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [{ id: 1, branchId: BRANCH_ID, status: 'closed' }];

      mockedCashRegisterRepository.findInRange.mockResolvedValue({
        items: history,
        total: 1,
        page: 1,
        limit: 10,
      } as any);

      const result = await listCashRegisterHistory(BRANCH_ID, start, end, 'closed');

      expect(result.items).toEqual(history);
      expect(result.total).toBe(1);
      expect(mockedCashRegisterRepository.findInRange).toHaveBeenCalledWith(
        BRANCH_ID,
        start,
        end,
        'closed',
        undefined
      );
    });

    test('puede paginar el historial', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [{ id: 1, branchId: BRANCH_ID, status: 'closed' }];
      const pagination = { page: 2, limit: 5 };

      mockedCashRegisterRepository.findInRange.mockResolvedValue({
        items: history,
        total: 10,
        page: 2,
        limit: 5,
      } as any);

      const result = await listCashRegisterHistory(
        BRANCH_ID,
        start,
        end,
        'closed',
        pagination
      );

      expect(result.items).toEqual(history);
      expect(result.total).toBe(10);
      expect(mockedCashRegisterRepository.findInRange).toHaveBeenCalledWith(
        BRANCH_ID,
        start,
        end,
        'closed',
        pagination
      );
    });

    test('propaga errores del repositorio (por ejemplo, fallo de conexión)', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const dbError = Object.assign(new Error('Failed query'), {
        code: 'ECONNREFUSED',
      });

      mockedCashRegisterRepository.findInRange.mockRejectedValue(dbError);

      await expect(listCashRegisterHistory(BRANCH_ID, start, end)).rejects.toThrow(dbError);
    });
  });

  describe('listDeletedCashRegisterHistory', () => {
    test('lista cajas eliminadas en un rango', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [{ id: 1, branchId: BRANCH_ID, deletedAt: new Date() }];

      mockedCashRegisterRepository.findDeletedInRange.mockResolvedValue({
        items: history,
        total: 1,
        page: 1,
        limit: 10,
      } as any);

      const result = await listDeletedCashRegisterHistory(BRANCH_ID, start, end);

      expect(result.items).toEqual(history);
      expect(mockedCashRegisterRepository.findDeletedInRange).toHaveBeenCalledWith(
        BRANCH_ID,
        start,
        end,
        undefined
      );
    });

    test('puede paginar las cajas eliminadas', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const history = [{ id: 1, branchId: BRANCH_ID, deletedAt: new Date() }];
      const pagination = { page: 1, limit: 5 };

      mockedCashRegisterRepository.findDeletedInRange.mockResolvedValue({
        items: history,
        total: 5,
        page: 1,
        limit: 5,
      } as any);

      const result = await listDeletedCashRegisterHistory(BRANCH_ID, start, end, pagination);

      expect(result.items).toEqual(history);
      expect(result.total).toBe(5);
      expect(mockedCashRegisterRepository.findDeletedInRange).toHaveBeenCalledWith(
        BRANCH_ID,
        start,
        end,
        pagination
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

      const result = await emptyTrash(BRANCH_ID, start, end);

      expect(result).toEqual({ deleted: 2 });
      expect(
        mockedCashRegisterRepository.hardDeleteAllDeletedInRange
      ).toHaveBeenCalledWith(BRANCH_ID, start, end);
    });
  });

  describe('deleteCashRegister', () => {
    test('realiza soft delete de una caja cerrada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: null,
      } as any);
      mockedCashRegisterRepository.softDelete.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: new Date(),
      } as any);

      const result = await deleteCashRegister(BRANCH_ID, 1);

      expect(result?.id).toBe(1);
      expect(mockedCashRegisterRepository.softDelete).toHaveBeenCalledWith(BRANCH_ID, 1);
    });

    test('rechaza eliminar una caja abierta', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'open',
        deletedAt: null,
      } as any);

      await expect(deleteCashRegister(BRANCH_ID, 1)).rejects.toThrow(ValidationError);
      expect(mockedCashRegisterRepository.softDelete).not.toHaveBeenCalled();
    });

    test('lanza NotFoundError si la caja no existe', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue(null);

      await expect(deleteCashRegister(BRANCH_ID, 1)).rejects.toThrow(NotFoundError);
    });
  });

  describe('restoreCashRegister', () => {
    test('restaura una caja eliminada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: new Date(),
      } as any);
      mockedCashRegisterRepository.restore.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: null,
      } as any);

      const result = await restoreCashRegister(BRANCH_ID, 1);

      expect(result?.deletedAt).toBeNull();
      expect(mockedCashRegisterRepository.restore).toHaveBeenCalledWith(BRANCH_ID, 1);
    });

    test('rechaza restaurar una caja no eliminada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: null,
      } as any);

      await expect(restoreCashRegister(BRANCH_ID, 1)).rejects.toThrow(ValidationError);
    });
  });

  describe('permanentlyDeleteCashRegister', () => {
    test('elimina definitivamente una caja en la papelera', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: new Date(),
      } as any);
      mockedCashRegisterRepository.hardDelete.mockResolvedValue({
        deleted: true,
      } as any);

      const result = await permanentlyDeleteCashRegister(BRANCH_ID, 1);

      expect(result).toEqual({ deleted: true });
      expect(mockedCashRegisterRepository.hardDelete).toHaveBeenCalledWith(BRANCH_ID, 1);
    });

    test('rechaza eliminar definitivamente una caja no eliminada', async () => {
      mockedCashRegisterRepository.findById.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        status: 'closed',
        deletedAt: null,
      } as any);

      await expect(permanentlyDeleteCashRegister(BRANCH_ID, 1)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('autoCloseIfNeeded', () => {
    test('devuelve la caja si no superó las 12 horas', async () => {
      const openedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        openedAt,
        openedBy: 'admin',
        status: 'open',
      } as any);

      const result = await autoCloseIfNeeded(BRANCH_ID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    test('cierra automáticamente una caja vencida', async () => {
      const openedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
      mockedCashRegisterRepository.findOpen.mockResolvedValue({
        id: 1,
        branchId: BRANCH_ID,
        openedAt,
        openedBy: 'admin',
        status: 'open',
      } as any);

      mockSelectResult = [
        {
          id: 1,
          branchId: BRANCH_ID,
          openedAt,
          openedBy: 'admin',
          status: 'open',
          autoClosed: false,
          deletedAt: null,
        },
      ];

      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([]);

      const result = await autoCloseIfNeeded(BRANCH_ID);

      expect(result).toBeNull();
      expect(mockedExecuteInTransaction).toHaveBeenCalled();
    });
  });

  describe('calculateCashRegisterSummary', () => {
    test('calcula totales con múltiples ventas, transferencias y bebidas', async () => {
      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          total: 1500,
          paymentMethod: 'cash',
          payments: [{ method: 'cash', amount: 1500 }],
          status: 'active',
          items: [
            {
              quantity: 1,
              product: { id: 1, branchId: BRANCH_ID, name: 'Panchuque', type: 'compound' },
            },
          ],
        },
        {
          id: 2,
          branchId: BRANCH_ID,
          total: 800,
          paymentMethod: 'transfer',
          payments: [{ method: 'transfer', amount: 800 }],
          status: 'active',
          items: [
            {
              quantity: 2,
              product: {
                id: 2,
                branchId: BRANCH_ID,
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
          supply: { id: 2, branchId: BRANCH_ID, name: 'Pan' },
        },
      ] as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
        { id: 3, branchId: BRANCH_ID, name: 'Gaseosa', type: 'critical_supply', isActive: true },
        { id: 4, branchId: BRANCH_ID, name: 'Salchicha', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await calculateCashRegisterSummary(BRANCH_ID, 1);

      expect(result.total).toBe(2300);
      expect(result.cashTotal).toBe(1500);
      expect(result.transferTotal).toBe(800);
      expect(result.totalSales).toBe(2);
      expect(result.productsSummary).toEqual({
        Panchuque: 1,
        Gaseosa: 2,
      });
      expect(result.criticalSuppliesSummary).toEqual({
        Pan: 1,
        Gaseosa: 2,
        Salchicha: 0,
      });
    });

    test('separa efectivo y transferencia cuando una venta tiene pago mixto', async () => {
      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          branchId: BRANCH_ID,
          total: 2000,
          paymentMethod: 'cash',
          payments: [
            { method: 'cash', amount: 500 },
            { method: 'transfer', amount: 1500 },
          ],
          status: 'active',
          items: [
            {
              quantity: 1,
              product: { id: 1, branchId: BRANCH_ID, name: 'Panchuque', type: 'compound' },
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
          supply: { id: 2, branchId: BRANCH_ID, name: 'Pan' },
        },
      ] as any);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await calculateCashRegisterSummary(BRANCH_ID, 1);

      expect(result.total).toBe(2000);
      expect(result.cashTotal).toBe(500);
      expect(result.transferTotal).toBe(1500);
      expect(result.totalSales).toBe(1);
    });

    test('incluye todos los insumos críticos activos con cantidad cero cuando no hay ventas', async () => {
      (mockedDb.query.sales.findMany as jest.Mock).mockResolvedValue([]);
      (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([]);

      (mockedDb.query.products.findMany as jest.Mock).mockResolvedValue([
        { id: 2, branchId: BRANCH_ID, name: 'Pan', type: 'critical_supply', isActive: true },
        { id: 3, branchId: BRANCH_ID, name: 'Gaseosa', type: 'critical_supply', isActive: true },
        { id: 4, branchId: BRANCH_ID, name: 'Salchicha', type: 'critical_supply', isActive: true },
      ] as any);

      const result = await calculateCashRegisterSummary(BRANCH_ID, 1);

      expect(result.total).toBe(0);
      expect(result.cashTotal).toBe(0);
      expect(result.transferTotal).toBe(0);
      expect(result.totalSales).toBe(0);
      expect(result.productsSummary).toEqual({});
      expect(result.criticalSuppliesSummary).toEqual({
        Pan: 0,
        Gaseosa: 0,
        Salchicha: 0,
      });
    });
  });
});
