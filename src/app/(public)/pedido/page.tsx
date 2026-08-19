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
import { PedidoError } from '@/components/pedido/pedido-error';
import { logError } from '@/lib/logger';
import type { Branch } from '@/domain/types';

interface PedidoPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

type CatalogResult = Awaited<
  ReturnType<typeof catalogService.listPublicCatalogWithAvailability>
>;

export default async function PedidoPage({ searchParams }: PedidoPageProps) {
  const params = await searchParams;
  let branchId: number | null = null;
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

  if (branchId === null) {
    return <PedidoError />;
  }

  if (resolvedFromDefault) {
    redirect(`/pedido?branchId=${branchId}`);
  }

  let catalog: CatalogResult | null = null;
  let branches: Branch[] = [];
  let hasError = false;

  try {
    [catalog, branches] = await Promise.all([
      catalogService.listPublicCatalogWithAvailability(branchId),
      listPublicBranches(),
    ]);

    if (!catalog || !branches.some((b) => b.id === branchId)) {
      hasError = true;
    }
  } catch (error) {
    logError('Error al cargar el catálogo público', error);
    hasError = true;
  }

  if (hasError || !catalog) {
    return <PedidoError />;
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
