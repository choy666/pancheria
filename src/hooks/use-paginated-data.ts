'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/config/pagination';
import type { PaginatedResult } from '@/domain/types';

export interface UsePaginatedDataResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refresh: () => void;
}

export interface UsePaginatedDataOptions {
  initialPage?: number;
  initialLimit?: number;
  refreshIntervalMs?: number;
}

export function usePaginatedData<T>(
  load: (page: number, limit: number, signal: AbortSignal) => Promise<PaginatedResult<T>>,
  options: UsePaginatedDataOptions = {}
): UsePaginatedDataResult<T> {
  const isMountedRef = useRef(true);
  const [page, setPage] = useState(options.initialPage ?? DEFAULT_PAGE);
  const [limit, setLimitState] = useState(options.initialLimit ?? DEFAULT_LIMIT);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<PaginatedResult<T>>({
    items: [],
    total: 0,
    page: 1,
    limit: DEFAULT_LIMIT,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setPageSafe = useCallback((nextPage: number) => {
    setIsLoading(true);
    setError(null);
    setPage(nextPage);
  }, []);

  const setLimit = useCallback((nextLimit: number) => {
    setIsLoading(true);
    setError(null);
    setLimitState(nextLimit);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const abortController = new AbortController();

    load(page, limit, abortController.signal)
      .then((data) => {
        if (abortController.signal.aborted) return;
        if (!isMountedRef.current) return;

        const safeLimit = data.limit > 0 ? data.limit : 1;
        const totalPages = Math.max(1, Math.ceil(data.total / safeLimit));

        if (data.total > 0 && data.items.length === 0 && data.page > totalPages) {
          setPage(totalPages);
          return;
        }

        setResult(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (abortController.signal.aborted) return;
        if (!isMountedRef.current) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setIsLoading(false);
      });

    let interval: ReturnType<typeof setInterval> | undefined;

    if (options.refreshIntervalMs && options.refreshIntervalMs > 0) {
      interval = setInterval(() => {
        if (
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden'
        ) {
          return;
        }
        refresh();
      }, options.refreshIntervalMs);
    }

    return () => {
      if (interval) clearInterval(interval);
      abortController.abort();
      isMountedRef.current = false;
    };
  }, [load, page, limit, refreshKey, options.refreshIntervalMs, refresh]);

  return {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    isLoading,
    error,
    setPage: setPageSafe,
    setLimit,
    refresh,
  };
}
