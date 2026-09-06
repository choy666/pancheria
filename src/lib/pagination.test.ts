import { parsePaginationParams } from './pagination';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MIN_LIMIT,
  PAGE_SIZE_OPTIONS,
} from '@/config/pagination';

function conParams(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

describe('constantes de paginación', () => {
  test('expone los valores por defecto y límites esperados', () => {
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_LIMIT).toBe(10);
    expect(MIN_LIMIT).toBe(1);
    expect(MAX_LIMIT).toBe(100);
  });

  test('las opciones de tamaño de página respetan los límites configurados', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
    expect(PAGE_SIZE_OPTIONS).toContain(DEFAULT_LIMIT);
    for (const opcion of PAGE_SIZE_OPTIONS) {
      expect(opcion).toBeGreaterThanOrEqual(MIN_LIMIT);
      expect(opcion).toBeLessThanOrEqual(MAX_LIMIT);
    }
  });
});

describe('parsePaginationParams', () => {
  describe('valores por defecto', () => {
    test('devuelve los defaults cuando no hay parámetros', () => {
      expect(parsePaginationParams(new URLSearchParams())).toEqual({
        page: DEFAULT_PAGE,
        limit: DEFAULT_LIMIT,
      });
    });

    test('usa el default de page cuando solo se envía limit', () => {
      expect(parsePaginationParams(conParams({ limit: '25' }))).toEqual({
        page: DEFAULT_PAGE,
        limit: 25,
      });
    });

    test('usa el default de limit cuando solo se envía page', () => {
      expect(parsePaginationParams(conParams({ page: '3' }))).toEqual({
        page: 3,
        limit: DEFAULT_LIMIT,
      });
    });
  });

  describe('parámetro page', () => {
    test('acepta un número entero positivo', () => {
      expect(parsePaginationParams(conParams({ page: '5' })).page).toBe(5);
    });

    test('rechaza cero y vuelve al default', () => {
      expect(parsePaginationParams(conParams({ page: '0' })).page).toBe(
        DEFAULT_PAGE
      );
    });

    test('rechaza números negativos', () => {
      expect(parsePaginationParams(conParams({ page: '-3' })).page).toBe(
        DEFAULT_PAGE
      );
    });

    test('rechaza decimales', () => {
      expect(parsePaginationParams(conParams({ page: '2.5' })).page).toBe(
        DEFAULT_PAGE
      );
    });

    test('rechaza valores no numéricos', () => {
      expect(parsePaginationParams(conParams({ page: 'abc' })).page).toBe(
        DEFAULT_PAGE
      );
    });

    test('rechaza strings vacíos', () => {
      expect(parsePaginationParams(conParams({ page: '' })).page).toBe(
        DEFAULT_PAGE
      );
    });
  });

  describe('parámetro limit', () => {
    test('acepta un entero dentro del rango permitido', () => {
      expect(parsePaginationParams(conParams({ limit: '50' })).limit).toBe(50);
    });

    test('acepta los extremos del rango (MIN_LIMIT y MAX_LIMIT)', () => {
      expect(
        parsePaginationParams(conParams({ limit: String(MIN_LIMIT) })).limit
      ).toBe(MIN_LIMIT);
      expect(
        parsePaginationParams(conParams({ limit: String(MAX_LIMIT) })).limit
      ).toBe(MAX_LIMIT);
    });

    test('usa el default cuando está por debajo del mínimo', () => {
      expect(parsePaginationParams(conParams({ limit: '0' })).limit).toBe(
        DEFAULT_LIMIT
      );
      expect(parsePaginationParams(conParams({ limit: '-10' })).limit).toBe(
        DEFAULT_LIMIT
      );
    });

    test('recorta al máximo cuando supera MAX_LIMIT', () => {
      expect(parsePaginationParams(conParams({ limit: '500' })).limit).toBe(
        MAX_LIMIT
      );
      expect(
        parsePaginationParams(conParams({ limit: String(MAX_LIMIT + 1) }))
          .limit
      ).toBe(MAX_LIMIT);
    });

    test('rechaza decimales y vuelve al default', () => {
      expect(parsePaginationParams(conParams({ limit: '10.5' })).limit).toBe(
        DEFAULT_LIMIT
      );
    });

    test('rechaza valores no numéricos', () => {
      expect(parsePaginationParams(conParams({ limit: 'mucho' })).limit).toBe(
        DEFAULT_LIMIT
      );
    });
  });
});
