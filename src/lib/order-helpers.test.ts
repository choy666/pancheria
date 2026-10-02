import {
  generateOrderNumber,
  generateCancellationToken,
  buildOrderValues,
  buildOrderItemValues,
  buildRecipeSnapshotMessageContent,
} from './order-helpers';

describe('order-helpers', () => {
  describe('generateOrderNumber', () => {
    it('incluye branchId, timestamp y sufijo aleatorio', () => {
      const result = generateOrderNumber(1);
      const parts = result.split('-');

      expect(parts[0]).toBe('PED');
      expect(parts[1]).toBe('1');
      expect(parts[2]).toMatch(/^\d+$/);
      expect(parts[3]).toHaveLength(8);
    });
  });

  describe('generateCancellationToken', () => {
    it('genera un token hexadecimal de 64 caracteres', () => {
      const token = generateCancellationToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('buildOrderValues', () => {
    it('construye los valores del pedido normalizando espacios', () => {
      const result = buildOrderValues({
        branchId: 1,
        orderNumber: 'PED-1-123-abc',
        total: 5000,
        customerName: '  Juan  ',
        customerPhone: '  341 555 5555  ',
        deliveryType: 'pickup',
        address: '  Calle 1  ',
        notes: '  Sin sal  ',
        cancellationToken: 'token',
        idempotencyKey: 'key',
      });

      expect(result).toMatchObject({
        branchId: 1,
        orderNumber: 'PED-1-123-abc',
        total: 5000,
        status: 'pending',
        customerName: 'Juan',
        customerPhone: '3415555555',
        deliveryType: 'pickup',
        address: 'Calle 1',
        notes: 'Sin sal',
        cancellationToken: 'token',
        idempotencyKey: 'key',
      });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('deja address y notes como null si son vacios', () => {
      const result = buildOrderValues({
        branchId: 1,
        orderNumber: 'PED-1-123-abc',
        total: 5000,
        customerName: 'Juan',
        customerPhone: '3415555555',
        deliveryType: 'delivery',
        address: null,
        notes: undefined,
        cancellationToken: 'token',
        idempotencyKey: 'key',
      });

      expect(result.address).toBeNull();
      expect(result.notes).toBeNull();
    });
  });

  describe('buildOrderItemValues', () => {
    it('agrega orderId a cada item', () => {
      const result = buildOrderItemValues(
        [
          { productId: 1, productName: 'Pan', quantity: 2, unitPrice: 1000, subtotal: 2000 },
          { productId: 2, productName: 'Panchuque', quantity: 1, unitPrice: 1500, subtotal: 1500 },
        ],
        10
      );

      expect(result).toEqual([
        { orderId: 10, productId: 1, quantity: 2, unitPrice: 1000, subtotal: 2000, notes: null },
        { orderId: 10, productId: 2, quantity: 1, unitPrice: 1500, subtotal: 1500, notes: null },
      ]);
    });

    it('propaga la aclaración del ítem', () => {
      const result = buildOrderItemValues(
        [
          {
            productId: 1,
            productName: 'Pan',
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
            notes: 'bien tostado',
          },
        ],
        10
      );

      expect(result[0].notes).toBe('bien tostado');
    });

    it('devuelve array vacio si no hay items', () => {
      const result = buildOrderItemValues([], 1);
      expect(result).toEqual([]);
    });
  });

  describe('buildRecipeSnapshotMessageContent', () => {
    it('devuelve null cuando no hay snapshot ni aclaraciones', () => {
      const result = buildRecipeSnapshotMessageContent([
        { productId: 1, productName: 'Gaseosa', quantity: 1, unitPrice: 500, subtotal: 500 },
      ]);

      expect(result).toBeNull();
    });

    it('incluye la aclaración en una línea sin snapshot de receta', () => {
      const result = buildRecipeSnapshotMessageContent([
        {
          productId: 1,
          productName: 'Gaseosa',
          quantity: 2,
          unitPrice: 500,
          subtotal: 1000,
          notes: 'bien fría',
        },
      ]);

      expect(result).toBe(
        'Detalle de preparación:\nGaseosa x2 — Aclaración: bien fría'
      );
    });

    it('combina receta y aclaración en la misma línea', () => {
      const result = buildRecipeSnapshotMessageContent([
        {
          productId: 1,
          productName: 'Panchuque',
          quantity: 1,
          unitPrice: 1500,
          subtotal: 1500,
          notes: 'bien tostado',
          recipeSnapshot: [
            {
              supplyId: 10,
              supplyName: 'Cebolla',
              supplyType: 'manual_supply',
              quantity: 1,
              autoDiscount: false,
              isOptional: true,
              selected: false,
              selectedByDefault: false,
            },
          ],
        },
      ]);

      expect(result).toContain('Panchuque x1:');
      expect(result).toContain('Aclaración: bien tostado');
      expect(result).toContain('Sin: Cebolla');
    });
  });
});
