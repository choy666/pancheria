'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '@/config/pagination';

interface ServerPaginationProps {
  page: number;
  limit: number;
  total: number;
  pageSizeOptions?: number[];
}

/**
 * Paginador para listados renderizados en el servidor: navega actualizando
 * los parámetros `page`/`limit` de la URL conservando el resto de la query.
 */
export function ServerPagination({
  page,
  limit,
  total,
  pageSizeOptions,
}: ServerPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextPage: number, nextLimit: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > DEFAULT_PAGE) {
      params.set('page', String(nextPage));
    } else {
      params.delete('page');
    }
    if (nextLimit !== DEFAULT_LIMIT) {
      params.set('limit', String(nextLimit));
    } else {
      params.delete('limit');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Pagination
      page={page}
      limit={limit}
      total={total}
      onPageChange={(nextPage) => navigate(nextPage, limit)}
      onLimitChange={(nextLimit) => navigate(DEFAULT_PAGE, nextLimit)}
      pageSizeOptions={pageSizeOptions}
    />
  );
}
