import {
  generateOrderNumber,
  generateCancellationToken,
  buildOrderValues,
  buildOrderItemValues,
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
          { productId: 1, quantity: 2, unitPrice: 1000, subtotal: 2000 },
          { productId: 2, quantity: 1, unitPrice: 1500, subtotal: 1500 },
        ],
        10
      );

      expect(result).toEqual([
        { orderId: 10, productId: 1, quantity: 2, unitPrice: 1000, subtotal: 2000 },
        { orderId: 10, productId: 2, quantity: 1, unitPrice: 1500, subtotal: 1500 },
      ]);
    });

    it('devuelve array vacio si no hay items', () => {
      const result = buildOrderItemValues([], 1);
      expect(result).toEqual([]);
    });
  });
});
