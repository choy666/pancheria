import { buildSaleItemValues } from './sale-helpers';
import type { ProductRow } from '@/domain/types';

const productById = new Map<number, ProductRow>([
  [
    1,
    {
      id: 1,
      branchId: 1,
      name: 'Pancho',
      type: 'critical_supply',
      criticalSupplyType: 'sausage',
      price: 1000,
      stock: 10,
      minStock: 1,
      isActive: true,
      unit: 'unidad',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as ProductRow,
  ],
  [
    2,
    {
      id: 2,
      branchId: 1,
      name: 'Coca',
      type: 'critical_supply',
      criticalSupplyType: 'beverage',
      price: 1500,
      stock: 5,
      minStock: 1,
      isActive: true,
      unit: 'unidad',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as ProductRow,
  ],
]);

describe('sale-helpers', () => {
  describe('buildSaleItemValues', () => {
    it('calcula unitPrice y subtotal a partir del producto', () => {
      const { saleItemValues, total } = buildSaleItemValues(productById, [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ]);

      expect(saleItemValues).toEqual([
        { productId: 1, quantity: 2, unitPrice: 1000, subtotal: 2000 },
        { productId: 2, quantity: 1, unitPrice: 1500, subtotal: 1500 },
      ]);
      expect(total).toBe(3500);
    });

    it('respeta unitPrice y subtotal explícitos', () => {
      const { saleItemValues, total } = buildSaleItemValues(productById, [
        { productId: 1, quantity: 2, unitPrice: 1200, subtotal: 2400 },
      ]);

      expect(saleItemValues).toEqual([
        { productId: 1, quantity: 2, unitPrice: 1200, subtotal: 2400 },
      ]);
      expect(total).toBe(2400);
    });

    it('suma items con decimales correctamente', () => {
      const product = productById.get(1)!;
      product.price = 1000.5;

      const { saleItemValues, total } = buildSaleItemValues(productById, [
        { productId: 1, quantity: 2 },
      ]);

      expect(total).toBe(2001);
      expect(saleItemValues[0].subtotal).toBe(2001);
    });
  });
});
