import {
  buildProductContext,
  validateProductsForOperation,
} from './product-helpers';
import type { ProductRow } from '@/domain/types';

var mockFindByIds: jest.Mock;

jest.mock('@/repositories/productRepository', () => {
  mockFindByIds = jest.fn();
  return { findByIds: mockFindByIds };
});

const BRANCH_ID = 1;

describe('product-helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildProductContext', () => {
    it('devuelve productos, mapa y recetas vacias si no hay compuestos', async () => {
      const products: ProductRow[] = [
        {
          id: 1,
          branchId: BRANCH_ID,
          name: 'Coca',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          price: 1000,
          stock: 10,
          minStock: 1,
          isActive: true,
          unit: 'unidad',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ] as ProductRow[];

      mockFindByIds.mockResolvedValue(products);

      const result = await buildProductContext(BRANCH_ID, [1]);

      expect(result.productsList).toEqual(products);
      expect(result.productById.get(1)).toEqual(products[0]);
      expect(result.recipesByProduct.size).toBe(0);
    });

    it('lanza NotFoundError si falta algun producto', async () => {
      mockFindByIds.mockResolvedValue([]);

      await expect(buildProductContext(BRANCH_ID, [1])).rejects.toThrow('Producto');
    });
  });

  describe('validateProductsForOperation', () => {
    it('no lanza error si los productos son validos', () => {
      const product = {
        id: 1,
        branchId: BRANCH_ID,
        name: 'Coca',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 1000,
        stock: 10,
        minStock: 1,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      const productById = new Map([[1, product]]);

      expect(() =>
        validateProductsForOperation(
          [{ productId: 1 }],
          productById,
          BRANCH_ID,
          'venta'
        )
      ).not.toThrow();
    });

    it('lanza error si el producto no existe', () => {
      expect(() =>
        validateProductsForOperation([{ productId: 99 }], new Map(), BRANCH_ID, 'venta')
      ).toThrow('Producto');
    });

    it('lanza error si el producto no esta activo', () => {
      const product = {
        id: 1,
        branchId: BRANCH_ID,
        name: 'Coca',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 1000,
        stock: 10,
        minStock: 1,
        isActive: false,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as ProductRow;

      const productById = new Map([[1, product]]);

      expect(() =>
        validateProductsForOperation([{ productId: 1 }], productById, BRANCH_ID, 'venta')
      ).toThrow('no está activo');
    });
  });
});
