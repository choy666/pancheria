'use client';

import { Button } from '@/components/ui/button';
import { CartSummary } from './cart-summary';

const USER_FACING_MESSAGE =
  'No pudimos cargar la sucursal activa. Estamos trabajando para solucionarlo. Volvé a intentar más tarde.';

/**
 * Estado de error del flujo público de pedidos. Mantiene el layout general
 * (título del catálogo, espacio para productos y carrito deshabilitado) y
 * ofrece un botón para recargar la página.
 */
export function PedidoError() {
  function handleReload() {
    window.location.reload();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-2xl border border-white/8 p-4">
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-base text-muted-foreground">
          Elegí los productos y armá tu pedido.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
            {USER_FACING_MESSAGE}
          </div>

          <Button type="button" onClick={handleReload}>
            Volver a intentar
          </Button>
        </div>

        <div className="space-y-4">
          <CartSummary
            items={[]}
            total={0}
            onUpdateQuantity={() => {}}
            onRemove={() => {}}
            onCheckout={() => {}}
            disabled
          />
        </div>
      </div>
    </div>
  );
}
