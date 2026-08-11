import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MIN_LIMIT,
} from '@/config/pagination';
import type { PaginationParams } from '@/domain/types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parsePage(value: string | null | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return DEFAULT_PAGE;
  }
  return parsed;
}

export function parseLimit(value: string | null | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < MIN_LIMIT || !Number.isInteger(parsed)) {
    return DEFAULT_LIMIT;
  }
  return clamp(parsed, MIN_LIMIT, MAX_LIMIT);
}

export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  return {
    page: parsePage(searchParams.get('page')),
    limit: parseLimit(searchParams.get('limit')),
  };
}

export function calculateOffset(pagination: PaginationParams): number {
  return (pagination.page - 1) * pagination.limit;
}
