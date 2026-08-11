import { listStockAlerts, adjustStock, getStockHistory } from './stockService';
import * as productRepository from '@/repositories/productRepository';
import * as stockMovementRepository from '@/repositories/stockMovementRepository';
import { db } from '@/db';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { ProductRow, StockMovement, StockMovementType } from '@/domain/types';

type DbTransaction = (callback: (tx: typeof db) => Promise<unknown>) => Promise<unknown>;

interface MockTx {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  insert: jest.Mock;
  values: jest.Mock;
}

jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/stockMovementRepository');
jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn(async (callback: (tx: typeof db) => Promise<unknown>) => {
      const tx: MockTx = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockResolvedValue(undefined),
      };
      return await callback(tx as unknown as typeof db);
    }),
  },
}));

const mockedProductRepository = productRepository as jest.Mocked<typeof productRepository>;
const mockedStockMovementRepository = stockMovementRepository as jest.Mocked<
  typeof stockMovementRepository
>;

const mockedDb = db as unknown as { transaction: jest.MockedFunction<DbTransaction> };

function createProductRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 1,
    name: 'Producto',
    description: null,
    type: 'critical_supply',
    criticalSupplyType: null,
    price: 0,
    unit: 'unidad',
    stock: 0,
    minStock: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createStockMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 1,
    productId: 1,
    type: 'manual_adjustment',
    quantity: 0,
    reason: null,
    saleId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('stockService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('listStockAlerts marca stock bajo solo cuando hay un mínimo configurado', async () => {
    mockedProductRepository.findActive.mockResolvedValue([
      createProductRow({ id: 1, name: 'Pan', stock: 2, minStock: 5 }),
      createProductRow({ id: 2, name: 'Salchicha', stock: 10, minStock: 5 }),
      createProductRow({ id: 3, name: 'Mayonesa', stock: 0, minStock: 0 }),
    ]);

    const result = await listStockAlerts();
    expect(result[0].isLow).toBe(true);
    expect(result[1].isLow).toBe(false);
    expect(result[2].isLow).toBe(false);
  });

  test('adjustStock rechaza stock negativo', async () => {
    mockedProductRepository.findById.mockResolvedValue(
      createProductRow({ id: 1, name: 'Pan', stock: 5 })
    );

    await expect(adjustStock(1, -10, 'Ajuste')).rejects.toThrow(ValidationError);
  });

  test('adjustStock rechaza motivo corto', async () => {
    mockedProductRepository.findById.mockResolvedValue(
      createProductRow({ id: 1, name: 'Pan', stock: 5 })
    );

    await expect(adjustStock(1, 5, 'ok')).rejects.toThrow(ValidationError);
  });

  test('adjustStock ajusta correctamente', async () => {
    mockedProductRepository.findById.mockResolvedValue(
      createProductRow({ id: 1, name: 'Pan', stock: 5 })
    );

    const result = await adjustStock(1, 5, 'Ajuste de prueba');
    expect(result.newStock).toBe(10);
  });

  test('adjustStock con type restock usa el tipo recibido', async () => {
    mockedProductRepository.findById.mockResolvedValue(
      createProductRow({ id: 1, name: 'Pan', stock: 0 })
    );

    const tx: MockTx = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue(undefined),
    };

    mockedDb.transaction.mockImplementationOnce(async (callback) =>
      callback(tx as unknown as typeof db)
    );

    const result = await adjustStock(1, 10, 'Stock inicial', 'restock');
    expect(result.newStock).toBe(10);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'restock' })
    );
  });

  test('adjustStock rechaza un tipo inválido', async () => {
    mockedProductRepository.findById.mockResolvedValue(
      createProductRow({ id: 1, name: 'Pan', stock: 5 })
    );

    // Forzamos un valor inválido para probar la validación del tipo de movimiento.
    const invalidType = 'invalid' as unknown as StockMovementType;

    await expect(
      adjustStock(1, 5, 'Ajuste de prueba', invalidType)
    ).rejects.toThrow(ValidationError);
  });

  test('getStockHistory devuelve movimientos', async () => {
    mockedProductRepository.findById.mockResolvedValue(
      createProductRow({ id: 1, name: 'Pan' })
    );

    mockedStockMovementRepository.findByProductId.mockResolvedValue([
      createStockMovement({ id: 1, quantity: 5, type: 'manual_adjustment' }),
    ]);

    const result = await getStockHistory(1);
    expect(result.length).toBe(1);
    expect(result[0].quantity).toBe(5);
  });

  test('listStockAlerts incluye solo insumos críticos y manuales', async () => {
    mockedProductRepository.findActive.mockResolvedValue([
      createProductRow({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        stock: 2,
        minStock: 5,
      }),
      createProductRow({
        id: 2,
        name: 'Mayonesa',
        type: 'manual_supply',
        stock: 10,
        minStock: 5,
      }),
      createProductRow({
        id: 3,
        name: 'Promo doble',
        type: 'compound',
        stock: 0,
        minStock: 0,
      }),
      createProductRow({
        id: 4,
        name: 'Vaso de gaseosa',
        type: 'service',
        stock: 0,
        minStock: 0,
      }),
    ]);

    const result = await listStockAlerts();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Pan');
    expect(result[1].name).toBe('Mayonesa');
  });

  test('adjustStock lanza NotFoundError cuando el producto no existe', async () => {
    mockedProductRepository.findById.mockResolvedValue(null);

    await expect(adjustStock(999, 5, 'Ajuste de prueba')).rejects.toThrow(NotFoundError);
  });

  test('getStockHistory lanza NotFoundError cuando el producto no existe', async () => {
    mockedProductRepository.findById.mockResolvedValue(null);

    await expect(getStockHistory(999)).rejects.toThrow(NotFoundError);
  });
});
