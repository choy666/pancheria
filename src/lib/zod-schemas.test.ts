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
      price: '0',
      unit: 'unidad',
      stock: '10',
      minStock: '2',
      isActive: 'true',
    };

    const result = productSchema.parse(data);
    expect(result.name).toBe('Ketchup');
    expect(result.price).toBe(0);
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

  test('rechaza un insumo manual con precio', () => {
    const data = {
      name: 'Ketchup',
      type: 'manual_supply',
      price: 150,
      unit: 'unidad',
    };

    expect(() => productSchema.parse(data)).toThrow(
      'Los insumos manuales no pueden tener precio.'
    );
  });

  test('rechaza un producto crítico sin tipo de insumo crítico', () => {
    const data = {
      name: 'Pan',
      type: 'critical_supply',
      criticalSupplyType: null,
      price: 100,
      unit: 'unidad',
    };

    expect(() => productSchema.parse(data)).toThrow(
      'Los insumos críticos deben tener un tipo de insumo crítico.'
    );
  });

  test('rechaza un producto no crítico con tipo de insumo crítico', () => {
    const data = {
      name: 'Ketchup',
      type: 'manual_supply',
      criticalSupplyType: 'bread',
      price: 0,
      unit: 'unidad',
    };

    expect(() => productSchema.parse(data)).toThrow(
      'Solo los insumos críticos pueden tener un tipo de insumo crítico.'
    );
  });

  test('acepta un producto crítico con tipo válido', () => {
    const data = {
      name: 'Pan',
      type: 'critical_supply',
      criticalSupplyType: 'bread',
      price: 100,
      unit: 'unidad',
    };

    const result = productSchema.parse(data);
    expect(result.type).toBe('critical_supply');
    expect(result.criticalSupplyType).toBe('bread');
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

  test('rechaza insumos duplicados', () => {
    const data = {
      compoundProductId: 1,
      items: [
        { supplyId: 2, quantity: 1, autoDiscount: true },
        { supplyId: 2, quantity: 2, autoDiscount: false },
      ],
    };

    expect(() => recipeSchema.parse(data)).toThrow(
      'No puede haber insumos duplicados en la receta.'
    );
  });

  test('rechaza la autoreferencia del producto compuesto', () => {
    const data = {
      compoundProductId: 1,
      items: [{ supplyId: 1, quantity: 1, autoDiscount: true }],
    };

    expect(() => recipeSchema.parse(data)).toThrow(
      'Una receta no puede incluir al propio producto compuesto como insumo.'
    );
  });

  test('rechaza el descuento automático en un insumo no crítico', () => {
    const data = {
      compoundProductId: 1,
      items: [
        {
          supplyId: 2,
          quantity: 1,
          autoDiscount: true,
          supplyType: 'manual_supply',
        },
      ],
    };

    expect(() => recipeSchema.parse(data)).toThrow(
      'Solo los insumos críticos pueden tener descuento automático.'
    );
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
    expect(result.type).toBe('manual_adjustment');
  });

  test('acepta una cantidad negativa para decrementar stock', () => {
    const data = {
      productId: 1,
      quantity: -3,
      reason: 'Ajuste por rotura',
    };

    const result = stockAdjustmentSchema.parse(data);
    expect(result.quantity).toBe(-3);
    expect(result.reason).toBe('Ajuste por rotura');
  });

  test('rechaza un motivo corto', () => {
    const data = {
      productId: 1,
      quantity: 5,
      reason: 'ok',
    };

    expect(() => stockAdjustmentSchema.parse(data)).toThrow();
  });

  test('rechaza un motivo vacío', () => {
    const data = {
      productId: 1,
      quantity: 5,
      reason: '',
    };

    expect(() => stockAdjustmentSchema.parse(data)).toThrow();
  });

  test('acepta un type restock', () => {
    const data = {
      productId: 1,
      quantity: 10,
      reason: 'Stock inicial',
      type: 'restock',
    };

    const result = stockAdjustmentSchema.parse(data);
    expect(result.type).toBe('restock');
  });

  test('rechaza un type inválido', () => {
    const data = {
      productId: 1,
      quantity: 5,
      reason: 'Ajuste de prueba',
      type: 'invalid',
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

  test('rechaza un motivo muy corto', () => {
    expect(() => cancellationSchema.parse({ reason: 'x' })).toThrow();
  });
});
