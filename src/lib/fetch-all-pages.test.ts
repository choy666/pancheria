/**
 * @jest-environment node
 */
import { fetchAllPages } from './fetch-all-pages';
import { MAX_LIMIT } from '@/config/pagination';
import type { PaginatedResult } from '@/domain/types';

function pageOf<T>(items: T[], total: number, page = 1): PaginatedResult<T> {
  return { items, total, page, limit: MAX_LIMIT } as PaginatedResult<T>;
}

describe('fetchAllPages', () => {
  test('acumula todas las páginas hasta cubrir el total', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(pageOf([1, 2], 5))
      .mockResolvedValueOnce(pageOf([3, 4], 5, 2))
      .mockResolvedValueOnce(pageOf([5], 5, 3));

    const result = await fetchAllPages(fetchPage, 2);

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 2);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3, 2);
  });

  test('se detiene cuando una página vuelve con menos ítems que el límite', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce(pageOf([1, 2], 99))
      .mockResolvedValueOnce(pageOf([3], 99, 2));

    const result = await fetchAllPages(fetchPage, 2);

    // items.length < total pero la página vino incompleta: no hay más datos.
    expect(result).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  test('devuelve un array vacío cuando la primera página no tiene ítems', async () => {
    const fetchPage = jest.fn().mockResolvedValue(pageOf([], 0));

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  test('usa MAX_LIMIT como tamaño de página por defecto', async () => {
    const fetchPage = jest.fn().mockResolvedValue(pageOf(['a'], 1));

    await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledWith(1, MAX_LIMIT);
  });
});
