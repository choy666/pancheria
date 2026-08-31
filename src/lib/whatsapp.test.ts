import {
  buildWhatsAppMessage,
  buildChatPublicUrl,
  encodeWhatsAppUrl,
  type PublicOrder,
} from '@/lib/whatsapp';

describe('buildWhatsAppMessage', () => {
  test('genera el mensaje con líneas, total, cliente, teléfono, entrega y notas', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 2 },
        { productId: 2, name: 'Gaseosa', price: 500, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Juan Pérez',
      customerPhone: ' 341 555 5555 ',
      deliveryType: 'delivery',
      address: 'Av. Siempre Viva 742',
      notes: 'Sin mostaza',
      total: 2900,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Teléfono: 3415555555');

    expect(message).toContain('Panchuque');
    expect(message).toContain('Gaseosa');
    expect(message).toContain('Total: $ 2.900');
    expect(message).toContain('Cliente: Juan Pérez');
    expect(message).toContain('Entrega: Envío a domicilio');
    expect(message).toContain('Dirección: Av. Siempre Viva 742');
    expect(message).toContain('Notas: Sin mostaza');
    expect(message).toContain('$ 2.400');
    expect(message).toContain('$ 500');
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

  test('formatea precios sin centavos', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200.5, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200.5,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Total: $ 1.201');
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

  test('incluye enlace al chat cuando tiene id y token', () => {
    const order: PublicOrder = {
      id: 123,
      cancellationToken: 'abc123',
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).toContain('Seguí tu pedido y chateá con la sucursal:');
    expect(message).toContain('/pedido/123/chat?token=abc123');
  });

  test('omite la línea de teléfono cuando no está definido', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).not.toContain('Teléfono:');
    expect(message).toContain('Entrega: Retiro en sucursal');
  });

  test('omite el enlace al chat cuando no tiene id o token', () => {
    const order: PublicOrder = {
      items: [
        { productId: 1, name: 'Panchuque', price: 1200, unit: 'unidad', quantity: 1 },
      ],
      customerName: 'Carlos',
      deliveryType: 'pickup',
      total: 1200,
    };

    const message = buildWhatsAppMessage(order);

    expect(message).not.toContain('Seguí tu pedido y chateá con la sucursal:');
  });
});

describe('buildChatPublicUrl', () => {
  test('construye la URL pública del chat', () => {
    const url = buildChatPublicUrl(123, 'abc123');

    expect(url).toBe('http://localhost:3000/pedido/123/chat?token=abc123');
  });

  test('usa NEXT_PUBLIC_APP_URL cuando está definida', () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://pancheria.example.com';

    const url = buildChatPublicUrl(123, 'abc123');

    expect(url).toBe('https://pancheria.example.com/pedido/123/chat?token=abc123');

    process.env.NEXT_PUBLIC_APP_URL = original;
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
