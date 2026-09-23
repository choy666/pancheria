import { OrderTracker } from '@/components/pedido/order-tracker';

// El bootstrap de Next inyecta inline scripts que solo llevan nonce cuando la
// página se renderiza por request. Prerenderizarla en build los dejaría sin
// nonce y la CSP de producción los bloquearía: la página no hidrataría.
export const dynamic = 'force-dynamic';

export default function PedidoSeguimientoPage() {
  return (
    <main className="min-h-screen py-8">
      <OrderTracker />
    </main>
  );
}
