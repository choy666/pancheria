import { ApiError } from '@/lib/fetch';
import {
  publicShortageMessage,
  toPublicErrorMessage,
} from '@/lib/public-errors';

describe('publicShortageMessage', () => {
  test('incluye el nombre del producto cuando está disponible', () => {
    expect(publicShortageMessage('Panchuque')).toBe(
      'No hay suficiente Panchuque por el momento. Probá bajar la cantidad o elegí otra opción.'
    );
  });

  test('usa un fallback genérico sin nombre de producto', () => {
    expect(publicShortageMessage(null)).toContain('ese producto');
    expect(publicShortageMessage(undefined)).toContain('ese producto');
    expect(publicShortageMessage('  ')).toContain('ese producto');
  });
});

describe('toPublicErrorMessage', () => {
  test('mapea por código estructurado INSUFFICIENT_STOCK con el productName', () => {
    const error = new ApiError(
      'mensaje interno',
      409,
      'INSUFFICIENT_STOCK',
      'Gaseosa'
    );

    expect(toPublicErrorMessage(error)).toBe(
      'No hay suficiente Gaseosa por el momento. Probá bajar la cantidad o elegí otra opción.'
    );
  });

  test('reescribe el mensaje técnico de stock aunque no haya código', () => {
    const message =
      'Stock insuficiente para Panchuque (insumo: Salchicha). Disponible: 5, solicitado: 6.';

    const result = toPublicErrorMessage(message);

    expect(result).toContain('No hay suficiente Panchuque');
    expect(result).not.toContain('Salchicha');
    expect(result).not.toContain('insumo');
    expect(result).not.toContain('Disponible:');
    expect(result).not.toContain('solicitado');
  });

  test('mapea mensajes con jerga interna a un texto genérico', () => {
    const result = toPublicErrorMessage('Error al procesar receta del producto.');

    expect(result).toBe(
      'No pudimos procesar tu pedido. Revisá los productos y probá de nuevo.'
    );
  });

  test('deja pasar mensajes que ya son aptos para el cliente', () => {
    const friendly = 'En este momento no podemos recibir pedidos. Horario de atención: Hoy de 08:00 a 18:00.';

    expect(toPublicErrorMessage(friendly)).toBe(friendly);
    expect(
      toPublicErrorMessage('Demasiados pedidos. Intentalo más tarde.')
    ).toBe('Demasiados pedidos. Intentalo más tarde.');
  });
});
