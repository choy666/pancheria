import {
  productSchema,
  recipeSchema,
  saleSchema,
  stockAdjustmentSchema,
  cancellationSchema,
} from './zod-schemas';

describe('productSchema', () => {
  test('acepta un producto manual válido', () => {
    const data = {
      name: 'Ketchup',
      description: 'Ketchup de prueba',
      type: 'manual_supply',
      criticalSupplyType: null,
      price: '150',
      unit: 'unidad',
      stock: '10',
      minStock: '2',
      isActive: 'true',
    };

    const result = productSchema.parse(data);
    expect(result.name).toBe('Ketchup');
    expect(result.price).toBe(150);
    expect(result.stock).toBe(10);
    expect(result.minStock).toBe(2);
    expect(result.isActive).toBe(true);
  });

  test('rechaza un producto sin nombre', () => {
    const data = {
      name: '',
      type: 'manual_supply',
      price: 100,
      unit: 'unidad',
    };

    expect(() => productSchema.parse(data)).toThrow();
  });

  test('rechaza un precio negativo', () => {
    const data = {
      name: 'Producto',
      type: 'manual_supply',
      price: -10,
      unit: 'unidad',
    };

    expect(() => productSchema.parse(data)).toThrow();
  });
});

describe('recipeSchema', () => {
  test('acepta una receta con al menos un insumo', () => {
    const data = {
      compoundProductId: 1,
      items: [{ supplyId: 2, quantity: 1, autoDiscount: true }],
    };

    const result = recipeSchema.parse(data);
    expect(result.items.length).toBe(1);
    expect(result.items[0].autoDiscount).toBe(true);
  });

  test('rechaza una receta sin items', () => {
    const data = {
      compoundProductId: 1,
      items: [],
    };

    expect(() => recipeSchema.parse(data)).toThrow();
  });
});

describe('saleSchema', () => {
  test('acepta una venta válida en efectivo', () => {
    const data = {
      items: [{ productId: 1, quantity: 2 }],
      paymentMethod: 'cash',
      idempotencyKey: 'abc123',
    };

    const result = saleSchema.parse(data);
    expect(result.paymentMethod).toBe('cash');
    expect(result.items[0].quantity).toBe(2);
  });

  test('rechaza un medio de pago inválido', () => {
    const data = {
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'tarjeta',
      idempotencyKey: 'abc123',
    };

    expect(() => saleSchema.parse(data)).toThrow();
  });
});

describe('stockAdjustmentSchema', () => {
  test('acepta un ajuste con motivo', () => {
    const data = {
      productId: 1,
      quantity: -5,
      reason: 'Ajuste de prueba',
    };

    const result = stockAdjustmentSchema.parse(data);
    expect(result.quantity).toBe(-5);
  });

  test('rechaza un motivo corto', () => {
    const data = {
      productId: 1,
      quantity: 5,
      reason: 'ok',
    };

    expect(() => stockAdjustmentSchema.parse(data)).toThrow();
  });
});

describe('cancellationSchema', () => {
  test('acepta un motivo de anulación', () => {
    const data = { reason: 'Error de carga' };
    const result = cancellationSchema.parse(data);
    expect(result.reason).toBe('Error de carga');
  });

  test('rechaza un motivo vacío', () => {
    expect(() => cancellationSchema.parse({ reason: '' })).toThrow();
  });
});
