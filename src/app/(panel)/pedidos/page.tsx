import { PedidosList } from '@/components/pedidos/pedidos-list';

export default function PedidosPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-base text-muted-foreground">
          Gestión de pedidos pendientes del catálogo público.
        </p>
      </div>

      <PedidosList status="pending" />
    </div>
  );
}
