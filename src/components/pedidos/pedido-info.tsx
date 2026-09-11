import { MapPin } from 'lucide-react';
import { formatDateTime } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { buildMapSearchUrl } from '@/lib/maps';
import type { DeliveryType } from '@/domain/types';

interface OrderInfo {
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  address: string | null;
  notes: string | null;
  total: number;
  createdAt: string;
  convertedSaleId: number | null;
  branch: { name: string; location?: string | null } | null;
}

const deliveryLabels: Record<DeliveryType, string> = {
  delivery: 'Envío a domicilio',
  pickup: 'Retiro en sucursal',
};

interface PedidoInfoProps {
  order: OrderInfo;
}

export function PedidoInfo({ order }: PedidoInfoProps) {
  const addressMapUrl =
    order.deliveryType === 'delivery' && order.address
      ? buildMapSearchUrl(order.address)
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-sm text-muted-foreground">Cliente</p>
        <p className="text-base font-medium">{order.customerName}</p>
        {order.customerPhone && (
          <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
        )}
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
          {addressMapUrl && (
            <a
              href={addressMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              data-testid="order-address-map-link"
            >
              <MapPin className="size-3" aria-hidden="true" />
              Ver en mapa
            </a>
          )}
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
          {formatMoney(order.total)}
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
