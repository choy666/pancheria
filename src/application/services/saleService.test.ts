import { calculateAvailability } from './saleService';
import * as productRepository from '@/repositories/productRepository';
import { db } from '@/db';

jest.mock('@/repositories/productRepository');
jest.mock('@/db', () => ({
  db: {
    query: {
      recipes: {
        findMany: jest.fn(),
      },
    },
  },
}));

const mockedProductRepository = productRepository as jest.Mocked<typeof productRepository>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('calculateAvailability', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 0 si el producto no existe', async () => {
    mockedProductRepository.findById.mockResolvedValue(null);
    const result = await calculateAvailability(999);
    expect(result).toBe(0);
  });

  test('devuelve stock para bebida crítica', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Gaseosa',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      stock: 50,
    } as any);

    const result = await calculateAvailability(1);
    expect(result).toBe(50);
  });

  test('calcula disponibilidad de producto compuesto', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Panchuque',
      type: 'compound',
    } as any);

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: true,
        supply: { stock: 10 } as any,
      },
      {
        id: 2,
        compoundProductId: 1,
        supplyId: 3,
        quantity: 2,
        autoDiscount: true,
        supply: { stock: 9 } as any,
      },
    ] as any);

    const result = await calculateAvailability(1);
    // Pan: 10/1 = 10; Salchicha: 9/2 = 4. Mínimo = 4.
    expect(result).toBe(4);
  });

  test('devuelve 0 si la receta no tiene items con auto descuento', async () => {
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Panchuque',
      type: 'compound',
    } as any);

    (mockedDb.query.recipes.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        compoundProductId: 1,
        supplyId: 2,
        quantity: 1,
        autoDiscount: false,
        supply: { stock: 10 } as any,
      },
    ] as any);

    const result = await calculateAvailability(1);
    expect(result).toBe(0);
  });
});
