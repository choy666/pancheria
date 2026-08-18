import { PedidosList } from '@/components/pedidos/pedidos-list';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';

export default async function PedidosPage() {
  const branchId = await getCurrentBranchIdOrRedirect();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-base text-muted-foreground">
          Gestión de pedidos pendientes del catálogo público.
        </p>
      </div>

      <PedidosList status="pending" branchId={branchId} />
    </div>
  );
}
