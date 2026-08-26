import {
  getWhatsAppNumber,
  getWhatsAppMessageParts,
  getPedidoRefetchIntervalMs,
} from './catalog';

describe('catalog config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getWhatsAppNumber limpia espacios y signos', () => {
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '+54 9 11 1234 5678';
    expect(getWhatsAppNumber()).toBe('5491112345678');
  });

  test('getWhatsAppNumber lanza error si no está configurado', () => {
    delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    expect(() => getWhatsAppNumber()).toThrow(
      'NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado'
    );
  });

  test('getWhatsAppNumber lanza error si tiene caracteres no numéricos', () => {
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = 'abc';
    expect(() => getWhatsAppNumber()).toThrow('caracteres no numéricos');
  });

  test('getWhatsAppMessageParts devuelve las partes configuradas', () => {
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING = 'Hola';
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING = 'Gracias';
    expect(getWhatsAppMessageParts()).toEqual({
      greeting: 'Hola',
      closing: 'Gracias',
    });
  });

  test('getPedidoRefetchIntervalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS;
    expect(getPedidoRefetchIntervalMs()).toBe(30000);
  });

  test('getPedidoRefetchIntervalMs aplica un mínimo de 1000 ms', () => {
    process.env.NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS = '500';
    expect(getPedidoRefetchIntervalMs()).toBe(30000);
  });
});
