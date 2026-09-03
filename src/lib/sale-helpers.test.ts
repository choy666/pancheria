import { buildSaleItemValues } from './sale-helpers';
import type { ProductRow } from '@/domain/types';
import type { RecipeWithSupply } from '@/application/services/summaryService';

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
        { productId: 1, productName: 'Pancho', quantity: 2, unitPrice: 1000, subtotal: 2000 },
        { productId: 2, productName: 'Coca', quantity: 1, unitPrice: 1500, subtotal: 1500 },
      ]);
      expect(total).toBe(3500);
    });

    it('respeta unitPrice y subtotal explícitos', () => {
      const { saleItemValues, total } = buildSaleItemValues(productById, [
        { productId: 1, quantity: 2, unitPrice: 1200, subtotal: 2400 },
      ]);

      expect(saleItemValues).toEqual([
        { productId: 1, productName: 'Pancho', quantity: 2, unitPrice: 1200, subtotal: 2400 },
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

    it('genera dos SaleItemValue con snapshots distintos para el mismo producto con selecciones diferentes', () => {
      const compoundProduct: ProductRow = {
        id: 3,
        branchId: 1,
        name: 'Promo',
        type: 'compound',
        criticalSupplyType: null,
        price: 2000,
        stock: 0,
        minStock: 0,
        isActive: true,
        unit: 'unidad',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const productByIdWithCompound = new Map(productById);
      productByIdWithCompound.set(3, compoundProduct);

      const recipesByProduct = new Map<number, RecipeWithSupply[]>([
        [
          3,
          [
            {
              id: 1,
              compoundProductId: 3,
              supplyId: 2,
              quantity: 1,
              autoDiscount: false,
              isOptional: true,
              selectedByDefault: false,
              createdAt: new Date(),
              supply: productByIdWithCompound.get(2) ?? null,
            },
          ],
        ],
      ]);

      const { saleItemValues } = buildSaleItemValues(
        productByIdWithCompound,
        [
          { productId: 3, quantity: 1, selectedRecipeItemIds: [2] },
          { productId: 3, quantity: 1, selectedRecipeItemIds: [] },
        ],
        recipesByProduct
      );

      expect(saleItemValues).toHaveLength(2);
      expect(saleItemValues[0].recipeSnapshot).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ supplyId: 2, selected: true }),
        ])
      );
      expect(saleItemValues[1].recipeSnapshot).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ supplyId: 2, selected: false }),
        ])
      );
    });
  });
});
