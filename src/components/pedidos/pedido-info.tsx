import { formatDateTime } from '@/lib/date';
import type { DeliveryType } from '@/domain/types';

interface OrderInfo {
  customerName: string;
  deliveryType: DeliveryType;
  address: string | null;
  notes: string | null;
  total: number;
  createdAt: string;
  convertedSaleId: number | null;
  branch: { name: string } | null;
}

const deliveryLabels: Record<DeliveryType, string> = {
  delivery: 'Envío a domicilio',
  pickup: 'Retiro en sucursal',
};

interface PedidoInfoProps {
  order: OrderInfo;
}

export function PedidoInfo({ order }: PedidoInfoProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-sm text-muted-foreground">Cliente</p>
        <p className="text-base font-medium">{order.customerName}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Sucursal</p>
        <p className="text-base font-medium">
          {order.branch?.name ?? '—'}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Entrega</p>
        <p className="text-base font-medium">
          {deliveryLabels[order.deliveryType]}
          {order.deliveryType === 'pickup' && order.branch
            ? ` (${order.branch.name})`
            : ''}
        </p>
      </div>
      {order.address && (
        <div className="sm:col-span-2">
          <p className="text-sm text-muted-foreground">Dirección</p>
          <p className="text-base">{order.address}</p>
        </div>
      )}
      {order.notes && (
        <div className="sm:col-span-2">
          <p className="text-sm text-muted-foreground">Notas</p>
          <p className="text-base">{order.notes}</p>
        </div>
      )}
      <div>
        <p className="text-sm text-muted-foreground">Creado</p>
        <p className="text-base">{formatDateTime(order.createdAt)}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="font-mono text-lg font-bold">
          ${order.total.toFixed(2)}
        </p>
      </div>
      {order.convertedSaleId && (
        <div className="sm:col-span-2">
          <p className="text-sm text-muted-foreground">Venta asociada</p>
          <p className="text-base">#{order.convertedSaleId}</p>
        </div>
      )}
    </div>
  );
}
