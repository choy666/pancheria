import { Suspense } from 'react';
import * as catalogService from '@/application/services/catalogService';
import { getDefaultBranchId } from '@/lib/branch-resolver';
import { PedidoClient } from '@/components/pedido/pedido-client';
import { PedidoSkeleton } from '@/components/pedido/pedido-skeleton';

interface PedidoPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function PedidoPage({ searchParams }: PedidoPageProps) {
  const params = await searchParams;
  const branchId = params.branchId
    ? Number(params.branchId)
    : await getDefaultBranchId();

  const products =
    await catalogService.listPublicCatalogWithAvailability(branchId);

  return (
    <Suspense fallback={<PedidoSkeleton />}>
      <PedidoClient initialProducts={products} branchId={branchId} />
    </Suspense>
  );
}
