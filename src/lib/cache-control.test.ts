/**
 * @jest-environment node
 */
import { buildCdnCacheControlHeaders } from './cache-control';

describe('buildCdnCacheControlHeaders', () => {
  test('devuelve undefined cuando la caché está deshabilitada (sMaxage <= 0)', () => {
    expect(buildCdnCacheControlHeaders(0, 30)).toBeUndefined();
    expect(buildCdnCacheControlHeaders(-5, 30)).toBeUndefined();
  });

  test('construye el header con s-maxage y stale-while-revalidate', () => {
    expect(buildCdnCacheControlHeaders(10, 30)).toEqual({
      'Cache-Control':
        'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
    });
  });

  test('propaga un swr distinto', () => {
    expect(buildCdnCacheControlHeaders(60, 120)).toEqual({
      'Cache-Control':
        'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
    });
  });
});
