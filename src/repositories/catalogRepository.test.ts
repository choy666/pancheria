import { findPublicProducts } from './catalogRepository';
import { products } from '@/db/schema';

const mockFindMany = jest.fn();

jest.mock('@/db', () => ({
  db: {
    query: {
      products: { findMany: jest.fn((...args) => mockFindMany(...args)) },
    },
  },
}));

const BRANCH_ID = 1;

describe('catalogRepository', () => {
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
  });
});
