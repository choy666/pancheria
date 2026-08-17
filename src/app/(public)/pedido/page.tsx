import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import * as catalogService from '@/application/services/catalogService';
import {
  listPublicBranches,
  getDefaultBranchId,
  parseBranchId,
} from '@/lib/branch-resolver';
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
    const parsed = parseBranchId(params.branchId);
    if (parsed === null) {
      redirect('/pedido');
    }
    branchId = parsed;
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

  if (!branches.some((b) => b.id === branchId)) {
    redirect('/pedido');
  }

  return (
    <Suspense fallback={<PedidoSkeleton />}>
      <PedidoClient
        key={branchId}
        branches={branches}
        activeBranch={catalog.branch}
        initialProducts={catalog.products}
      />
    </Suspense>
  );
}
