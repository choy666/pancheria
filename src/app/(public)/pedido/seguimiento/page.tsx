import type { Metadata } from 'next';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import { OrderTracker } from '@/components/pedido/order-tracker';
import { PublicFooter } from '@/components/publico/public-footer';
import { PublicHeader } from '@/components/publico/public-header';
import { getDefaultBranchId, parseBranchId } from '@/lib/branch-resolver';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// El bootstrap de Next inyecta inline scripts que solo llevan nonce cuando la
// página se renderiza por request. Prerenderizarla en build los dejaría sin
// nonce y la CSP de producción los bloquearía: la página no hidrataría.
export const dynamic = 'force-dynamic';

interface PedidoSeguimientoPageProps {
  searchParams: Promise<{ branchId?: string }>;
}

export default async function PedidoSeguimientoPage({
  searchParams,
}: PedidoSeguimientoPageProps) {
  const params = await searchParams;
  const branchId =
    parseBranchId(params.branchId) ?? (await getDefaultBranchId());
  const [brand, found] = await Promise.all([
    brandService.getBrand(),
    branchId ? branchService.getBranchById(branchId) : undefined,
  ]);
  const branch = found?.isActive ? found : undefined;

  return (
    <>
      <PublicHeader brand={brand} branchId={branchId} branchName={branch?.name} />
      <main className="flex-1 py-8">
        <OrderTracker />
      </main>
      <PublicFooter brand={brand} branch={branch} />
    </>
  );
}
