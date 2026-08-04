import { listStockAlerts, adjustStock, getStockHistory } from './stockService';
import * as productRepository from '@/repositories/productRepository';
import * as stockMovementRepository from '@/repositories/stockMovementRepository';
import { db } from '@/db';
import { ValidationError } from '@/domain/errors';

jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/stockMovementRepository');
jest.mock('@/db', () => ({
  db: {
    transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockResolvedValue(undefined),
      };
      return await callback(tx);
    }),
  },
}));

const mockedProductRepository = productRepository as jest.Mocked<typeof productRepository>;
const mockedStockMovementRepository = stockMovementRepository as jest.Mocked<typeof stockMovementRepository>;

describe('stockService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('listStockAlerts marca stock bajo', async () => {
    mockedProductRepository.findActive.mockResolvedValue([
      { id: 1, name: 'Pan', stock: 2, minStock: 5 } as any,
      { id: 2, name: 'Salchicha', stock: 10, minStock: 5 } as any,
    ]);

    const result = await listStockAlerts();
    expect(result[0].isLow).toBe(true);
    expect(result[1].isLow).toBe(false);
  });

  test('adjustStock rechaza stock negativo', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Pan',
      stock: 5,
    } as any);

    await expect(adjustStock(1, -10, 'Ajuste')).rejects.toThrow(ValidationError);
  });

  test('adjustStock rechaza motivo corto', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Pan',
      stock: 5,
    } as any);

    await expect(adjustStock(1, 5, 'ok')).rejects.toThrow(ValidationError);
  });

  test('adjustStock ajusta correctamente', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Pan',
      stock: 5,
    } as any);

    const result = await adjustStock(1, 5, 'Ajuste de prueba');
    expect(result.newStock).toBe(10);
  });

  test('getStockHistory devuelve movimientos', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Pan',
    } as any);

    mockedStockMovementRepository.findByProductId.mockResolvedValue([
      { id: 1, quantity: 5, type: 'manual_adjustment' } as any,
    ]);

    const result = await getStockHistory(1);
    expect(result.length).toBe(1);
    expect(result[0].quantity).toBe(5);
  });
});
