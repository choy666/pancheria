import {
  generateOrderNumber,
  generateCancellationToken,
  buildOrderValues,
  buildOrderItemValues,
  buildOrderWelcomeMessageContent,
  buildRecipeSnapshotMessageContent,
  toPublicCancelledOrder,
} from './order-helpers';
import { tryBuildLocationUrl } from './maps';

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

    it('normaliza coordenadas del pin de entrega a una URL canónica', () => {
      const result = buildOrderValues({
        branchId: 1,
        orderNumber: 'PED-1-123-abc',
        total: 5000,
        customerName: 'Juan',
        customerPhone: '3415555555',
        deliveryType: 'delivery',
        address: 'Calle 1',
        deliveryLocation: '-34.6037,-58.3816',
        cancellationToken: 'token',
        idempotencyKey: 'key',
      });

      // El valor persistido es la URL canónica de `tryBuildLocationUrl`,
      // nunca el input crudo del cliente.
      expect(result.deliveryLocation).toBe(
        tryBuildLocationUrl('-34.6037,-58.3816')
      );
      expect(result.deliveryLocation).toMatch(/^https?:\/\//);
    });

    it('devuelve null si el pin de entrega no normaliza (el refine lo rechaza antes)', () => {
      const result = buildOrderValues({
        branchId: 1,
        orderNumber: 'PED-1-123-abc',
        total: 5000,
        customerName: 'Juan',
        customerPhone: '3415555555',
        deliveryType: 'delivery',
        address: 'Calle 1',
        deliveryLocation: 'no es un enlace ni coordenadas',
        cancellationToken: 'token',
        idempotencyKey: 'key',
      });

      expect(result.deliveryLocation).toBeNull();
    });

    it('no persiste la ubicación en pedidos pickup aunque el cliente la envíe', () => {
      const result = buildOrderValues({
        branchId: 1,
        orderNumber: 'PED-1-123-abc',
        total: 5000,
        customerName: 'Juan',
        customerPhone: '3415555555',
        deliveryType: 'pickup',
        deliveryLocation: '-34.6037,-58.3816',
        cancellationToken: 'token',
        idempotencyKey: 'key',
      });

      expect(result.deliveryLocation).toBeNull();
    });
  });

  describe('buildOrderItemValues', () => {
    it('agrega orderId a cada item', () => {
      const result = buildOrderItemValues(
        [
          { productId: 1, productName: 'Pan', productType: 'critical_supply', criticalSupplyType: 'bread', quantity: 2, unitPrice: 1000, subtotal: 2000 },
          { productId: 2, productName: 'Panchuque', productType: 'compound', criticalSupplyType: null, quantity: 1, unitPrice: 1500, subtotal: 1500 },
        ],
        10
      );

      expect(result).toEqual([
        { orderId: 10, productId: 1, productName: 'Pan', productType: 'critical_supply', criticalSupplyType: 'bread', quantity: 2, unitPrice: 1000, subtotal: 2000, notes: null },
        { orderId: 10, productId: 2, productName: 'Panchuque', productType: 'compound', criticalSupplyType: null, quantity: 1, unitPrice: 1500, subtotal: 1500, notes: null },
      ]);
    });

    it('propaga la aclaración del ítem', () => {
      const result = buildOrderItemValues(
        [
          {
            productId: 1,
            productName: 'Pan',
            productType: 'critical_supply',
            criticalSupplyType: 'bread',
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

  describe('buildOrderWelcomeMessageContent', () => {
    const baseItems = [
      { productName: 'Panchuque', quantity: 2 },
      { productName: 'Gaseosa', quantity: 1 },
    ];

    it('saluda por nombre, lista los ítems, el total y la forma de entrega', () => {
      const result = buildOrderWelcomeMessageContent({
        customerName: 'Juan',
        branchName: 'Sucursal Centro',
        total: 4500,
        deliveryType: 'pickup',
        items: baseItems,
      });

      expect(result).toContain('¡Hola, Juan!');
      expect(result).toContain('Recibimos tu pedido en Sucursal Centro');
      expect(result).toContain('- Panchuque x2');
      expect(result).toContain('- Gaseosa x1');
      expect(result).toContain('Total: $ 4.500');
      expect(result).toContain('Entrega: retiro en Sucursal Centro');
    });

    it('incluye la dirección cuando la entrega es a domicilio', () => {
      const result = buildOrderWelcomeMessageContent({
        customerName: 'María',
        branchName: 'Sucursal Centro',
        total: 1000,
        deliveryType: 'delivery',
        address: '  Calle Falsa 123  ',
        items: baseItems,
      });

      expect(result).toContain('Entrega: envío a domicilio (Calle Falsa 123)');
    });

    it('saluda sin nombre cuando el cliente no cargó uno', () => {
      const result = buildOrderWelcomeMessageContent({
        customerName: '   ',
        branchName: 'Sucursal Centro',
        total: 1000,
        deliveryType: 'delivery',
        address: null,
        items: baseItems,
      });

      expect(result).toContain('¡Hola!');
      expect(result).not.toContain('¡Hola,');
      expect(result).toContain('Entrega: envío a domicilio');
    });

    it('respeta la longitud máxima de un mensaje de chat', () => {
      const result = buildOrderWelcomeMessageContent({
        customerName: 'Juan',
        branchName: 'Sucursal Centro',
        total: 1000,
        deliveryType: 'pickup',
        items: Array.from({ length: 80 }, (_, index) => ({
          productName: `Producto ${index}`,
          quantity: 1,
        })),
      });

      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('buildRecipeSnapshotMessageContent', () => {
    it('devuelve null cuando no hay snapshot ni aclaraciones', () => {
      const result = buildRecipeSnapshotMessageContent([
        { productId: 1, productName: 'Gaseosa', productType: 'critical_supply', criticalSupplyType: 'beverage', quantity: 1, unitPrice: 500, subtotal: 500 },
      ]);

      expect(result).toBeNull();
    });

    it('incluye la aclaración en una línea sin snapshot de receta', () => {
      const result = buildRecipeSnapshotMessageContent([
        {
          productId: 1,
          productName: 'Gaseosa',
          productType: 'critical_supply',
          criticalSupplyType: 'beverage',
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
          productType: 'compound',
          criticalSupplyType: null,
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

  describe('toPublicCancelledOrder', () => {
    it('expone solo los datos públicos del pedido', () => {
      const order = {
        id: 7,
        orderNumber: 'PED-1-123-abc',
        status: 'cancelled' as const,
        cancelledAt: new Date('2026-10-19T10:00:00.000Z'),
        cancellationToken: 'secreto',
        idempotencyKey: '1:clave',
        customerPhone: '3415555555',
        items: [{ productName: 'Gaseosa', product: { stock: 4 } }],
      };

      const result = toPublicCancelledOrder(order);

      expect(result).toEqual({
        id: 7,
        orderNumber: 'PED-1-123-abc',
        status: 'cancelled',
        cancelledAt: new Date('2026-10-19T10:00:00.000Z'),
      });
      expect(result).not.toHaveProperty('cancellationToken');
    });
  });
});
