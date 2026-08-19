import {
  buildWhatsAppMessage,
  encodeWhatsAppUrl,
  type PublicOrder,
} from '@/lib/whatsapp';

describe('buildWhatsAppMessage', () => {
  test('genera el mensaje con líneas, total, cliente, entrega y notas', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 2 },
        { productId: 2, name: 'Gaseosa', price: 500, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Juan Pérez',
      deliveryType: 'delivery',
      address: 'Av. Siempre Viva 742',
      notes: 'Sin mostaza',
      total: 2900,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Panchuque');
    expect(message).toContain('Gaseosa');
    expect(message).toContain('Total: $2900.00');
    expect(message).toContain('Cliente: Juan Pérez');
    expect(message).toContain('Entrega: Envío a domicilio');
    expect(message).toContain('Dirección: Av. Siempre Viva 742');
    expect(message).toContain('Notas: Sin mostaza');
    expect(message).toContain('$2400.00');
    expect(message).toContain('$500.00');
  });

  test('omite dirección cuando el retiro es en sucursal', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Ana',
      deliveryType: 'pickup',
      total: 1200,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Entrega: Retiro en sucursal');
    expect(message).not.toContain('Dirección');
    expect(message).not.toContain('Notas');
  });

  test('formatea precios con dos decimales', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200.5, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200.5,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Total: $1200.50');
  });

  test('incluye el nombre de la sucursal cuando está definido', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200,
      branchName: 'Sucursal Centro',
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Sucursal: Sucursal Centro');
  });

  test('omite la línea de sucursal cuando no está definida', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).not.toContain('Sucursal:');
  });
});

describe('encodeWhatsAppUrl', () => {
  test('genera la URL wa.me con el mensaje codificado', () => {
    const url = encodeWhatsAppUrl('5493415555555', 'Hola, quiero pedir');

    expect(url).toBe(
      'https://wa.me/5493415555555?text=Hola%2C%20quiero%20pedir'
    );
  });

  test('limpia espacios, signo + y guiones del teléfono', () => {
    const url = encodeWhatsAppUrl('+54 9 341 555-5555', 'Pedido');

    expect(url).toBe('https://wa.me/5493415555555?text=Pedido');
  });

  test('codifica correctamente caracteres especiales', () => {
    const url = encodeWhatsAppUrl('5493415555555', 'Hola! ¿Cómo estás?');

    expect(url).toContain(
      'Hola!%20%C2%BFC%C3%B3mo%20est%C3%A1s%3F'
    );
  });
});
