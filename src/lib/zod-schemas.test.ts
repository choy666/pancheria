import {
  productSchema,
  recipeSchema,
  saleSchema,
  orderSchema,
  cartAvailabilitySchema,
  orderTrackingSchema,
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

  test('acepta un tope de opcionales en un producto compuesto', () => {
    const data = {
      name: 'Pancho común',
      type: 'compound',
      price: 1000,
      unit: 'unidad',
      maxOptionalSelections: 4,
    };

    const result = productSchema.parse(data);
    expect(result.maxOptionalSelections).toBe(4);
  });

  test('rechaza un tope de opcionales en un producto no compuesto', () => {
    const data = {
      name: 'Ketchup',
      type: 'manual_supply',
      price: 0,
      unit: 'unidad',
      maxOptionalSelections: 4,
    };

    expect(() => productSchema.parse(data)).toThrow(
      'Solo los productos compuestos pueden tener un tope de opcionales.'
    );
  });

  test('rechaza un tope de opcionales que no sea entero positivo', () => {
    for (const maxOptionalSelections of [0, -1, 1.5]) {
      expect(() =>
        productSchema.parse({
          name: 'Pancho común',
          type: 'compound',
          price: 1000,
          unit: 'unidad',
          maxOptionalSelections,
        })
      ).toThrow();
    }
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
      payments: [{ method: 'cash', amount: 100 }],
      idempotencyKey: 'abc123',
    };

    const result = saleSchema.parse(data);
    expect(result.payments[0].method).toBe('cash');
    expect(result.items[0].quantity).toBe(2);
  });

  test('rechaza un medio de pago inválido', () => {
    const data = {
      items: [{ productId: 1, quantity: 1 }],
      payments: [{ method: 'tarjeta', amount: 100 }],
      idempotencyKey: 'abc123',
    };

    expect(() => saleSchema.parse(data)).toThrow();
  });

  test('rechaza pagos duplicados del mismo medio', () => {
    const data = {
      items: [{ productId: 1, quantity: 1 }],
      payments: [
        { method: 'cash', amount: 50 },
        { method: 'cash', amount: 50 },
      ],
      idempotencyKey: 'abc123',
    };

    expect(() => saleSchema.parse(data)).toThrow(
      'No puede haber más de una parte por medio de pago.'
    );
  });

  test('acepta una aclaración por ítem', () => {
    const data = {
      items: [{ productId: 1, quantity: 2, notes: 'bien tostado' }],
      payments: [{ method: 'cash', amount: 100 }],
      idempotencyKey: 'abc123',
    };

    const result = saleSchema.parse(data);
    expect(result.items[0].notes).toBe('bien tostado');
  });

  test('rechaza una aclaración de ítem mayor a 200 caracteres', () => {
    const data = {
      items: [{ productId: 1, quantity: 1, notes: 'a'.repeat(201) }],
      payments: [{ method: 'cash', amount: 100 }],
      idempotencyKey: 'abc123',
    };

    expect(() => saleSchema.parse(data)).toThrow();
  });
});

describe('orderSchema', () => {
  const orderData = {
    deliveryType: 'pickup',
    customerName: 'Ana',
    customerPhone: '3415551234',
    items: [{ productId: 1, quantity: 1 }],
    idempotencyKey: 'abc123',
  };

  test('acepta una aclaración por ítem en el pedido', () => {
    const result = orderSchema.parse({
      ...orderData,
      items: [{ productId: 1, quantity: 1, notes: 'sin sal' }],
    });

    expect(result.items[0].notes).toBe('sin sal');
  });

  test('rechaza una aclaración de ítem mayor a 200 caracteres', () => {
    expect(() =>
      orderSchema.parse({
        ...orderData,
        items: [{ productId: 1, quantity: 1, notes: 'a'.repeat(201) }],
      })
    ).toThrow();
  });

  test('mantiene la nota general del pedido separada y con su propio límite', () => {
    const result = orderSchema.parse({
      ...orderData,
      notes: 'Tocar el timbre dos veces',
    });

    expect(result.notes).toBe('Tocar el timbre dos veces');
    expect(() =>
      orderSchema.parse({ ...orderData, notes: 'a'.repeat(1001) })
    ).toThrow();
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

describe('límites de listas y cantidades', () => {
  const saleWith = (items: unknown[]) => ({
    items,
    payments: [{ method: 'cash', amount: 100 }],
    idempotencyKey: 'abc123',
  });

  const orderWith = (items: unknown[]) => ({
    deliveryType: 'pickup',
    customerName: 'Ana',
    customerPhone: '3415551234',
    items,
    idempotencyKey: 'abc123',
  });

  const repeatItem = (count: number, item: object) =>
    Array.from({ length: count }, () => ({ ...item }));

  test('saleSchema acepta hasta 100 ítems y rechaza el siguiente', () => {
    const atLimit = repeatItem(100, { productId: 1, quantity: 1 });

    expect(saleSchema.parse(saleWith(atLimit)).items).toHaveLength(100);
    expect(() =>
      saleSchema.parse(saleWith([...atLimit, { productId: 1, quantity: 1 }]))
    ).toThrow();
  });

  test('saleSchema y orderSchema rechazan más de 100 ítems', () => {
    const overLimit = repeatItem(101, { productId: 1, quantity: 1 });

    expect(() => saleSchema.parse(saleWith(overLimit))).toThrow();
    expect(() => orderSchema.parse(orderWith(overLimit))).toThrow();
  });

  test('cartAvailabilitySchema rechaza más de 100 ítems', () => {
    expect(() =>
      cartAvailabilitySchema.parse({
        items: repeatItem(101, { productId: 1, quantity: 1 }),
      })
    ).toThrow();
  });

  test('rechaza una cantidad por ítem mayor a 999', () => {
    expect(() =>
      saleSchema.parse(saleWith([{ productId: 1, quantity: 1000 }]))
    ).toThrow();
    expect(
      saleSchema.parse(saleWith([{ productId: 1, quantity: 999 }])).items[0]
        .quantity
    ).toBe(999);
  });

  test('rechaza más de 100 opciones seleccionadas en un ítem', () => {
    const selectedRecipeItemIds = Array.from({ length: 101 }, (_, index) => index + 1);

    expect(() =>
      saleSchema.parse(
        saleWith([{ productId: 1, quantity: 1, selectedRecipeItemIds }])
      )
    ).toThrow();
  });

  test('recipeSchema rechaza más de 100 insumos', () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      supplyId: index + 2,
      quantity: 1,
      autoDiscount: false,
    }));

    expect(() => recipeSchema.parse({ compoundProductId: 1, items })).toThrow();
  });

  test('orderTrackingSchema exige nombre y teléfono y acota su longitud', () => {
    const complete = {
      orderNumber: 'PED-1',
      customerName: 'Ana',
      customerPhone: '3415551234',
    };

    expect(orderTrackingSchema.parse(complete).customerName).toBe('Ana');
    expect(() =>
      orderTrackingSchema.parse({ ...complete, customerName: '   ' })
    ).toThrow('Ingresá tu nombre.');
    expect(() =>
      orderTrackingSchema.parse({ ...complete, customerPhone: '   ' })
    ).toThrow('Ingresá tu teléfono.');
    expect(() =>
      orderTrackingSchema.parse({ ...complete, customerPhone: '123' })
    ).toThrow();
    expect(() =>
      orderTrackingSchema.parse({ ...complete, orderNumber: 'x'.repeat(101) })
    ).toThrow();
    expect(() =>
      orderTrackingSchema.parse({ ...complete, customerName: 'x'.repeat(256) })
    ).toThrow();
  });
});
