import { MAX_LIMIT } from '@/config/pagination';
import type { PaginatedResult } from '@/domain/types';

/**
 * Consume un endpoint paginado (`{ items, total, page, limit }`) hasta
 * reunir todos los ítems. Pensado para consumidores que necesitan el set
 * completo (p. ej. el terminal de ventas precalcula disponibilidad de todo
 * el catálogo) sin exponer un contrato sin paginar.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResult<T>>,
  limit: number = MAX_LIMIT
): Promise<T[]> {
  const items: T[] = [];

  for (let page = 1; ; page += 1) {
    const result = await fetchPage(page, limit);
    items.push(...result.items);

    if (items.length >= result.total || result.items.length < limit) {
      break;
    }
  }

  return items;
}
