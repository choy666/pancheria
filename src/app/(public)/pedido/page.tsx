import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import * as catalogService from '@/application/services/catalogService';
import { listPublicBranches, getDefaultBranchId } from '@/lib/branch-resolver';
import { PedidoClient } from '@/components/pedido/pedido-client';
import { PedidoSkeleton } from '@/components/pedido/pedido-skeleton';

interface PedidoPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function PedidoPage({ searchParams }: PedidoPageProps) {
  const params = await searchParams;
  let branchId: number;
  let resolvedFromDefault = false;

  if (params.branchId) {
    branchId = Number(params.branchId);
  } else {
    branchId = await getDefaultBranchId();
    resolvedFromDefault = true;
  }

  const [catalog, branches] = await Promise.all([
    catalogService.listPublicCatalogWithAvailability(branchId),
    listPublicBranches(),
  ]);

  if (resolvedFromDefault) {
    redirect(`/pedido?branchId=${branchId}`);
  }

  return (
    <Suspense fallback={<PedidoSkeleton />}>
      <PedidoClient
        branches={branches}
        activeBranch={catalog.branch}
        initialProducts={catalog.products}
      />
    </Suspense>
  );
}
