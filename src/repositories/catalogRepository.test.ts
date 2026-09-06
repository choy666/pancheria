import { findPublicProducts, countPublicProducts } from './catalogRepository';
import { products } from '@/db/schema';

const mockFindMany = jest.fn();
const mockWhere = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();

jest.mock('@/db', () => ({
  db: {
    query: {
      products: { findMany: jest.fn((...args) => mockFindMany(...args)) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

const BRANCH_ID = 1;

describe('catalogRepository', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findPublicProducts', () => {
    test('devuelve solo productos públicos activos de la sucursal', async () => {
      mockFindMany.mockResolvedValue([
        { id: 1, name: 'Panchuque', type: 'compound', isActive: true, deletedAt: null, branchId: BRANCH_ID },
        { id: 2, name: 'Gaseosa', type: 'critical_supply', criticalSupplyType: 'beverage', isActive: true, deletedAt: null, branchId: BRANCH_ID },
        { id: 3, name: 'Topping', type: 'service', isActive: true, deletedAt: null, branchId: BRANCH_ID },
      ]);

      const result = await findPublicProducts(BRANCH_ID);

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.id)).toEqual([1, 2, 3]);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve un array vacío cuando no hay productos', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await findPublicProducts(BRANCH_ID);

      expect(result).toEqual([]);
    });

    test('pasa limit y offset a la consulta', async () => {
      mockFindMany.mockResolvedValue([]);

      await findPublicProducts(BRANCH_ID, { limit: 10, offset: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
    });
  });

  describe('countPublicProducts', () => {
    test('devuelve el total de productos públicos', async () => {
      mockWhere.mockResolvedValue([{ total: 42 }]);

      const result = await countPublicProducts(BRANCH_ID);

      expect(result).toBe(42);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(products);
      expect(mockWhere).toHaveBeenCalled();
    });

    test('devuelve 0 cuando la consulta no devuelve filas', async () => {
      mockWhere.mockResolvedValue([]);

      const result = await countPublicProducts(BRANCH_ID);

      expect(result).toBe(0);
    });
  });
});
