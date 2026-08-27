import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/domain/types';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_process: 'En proceso',
  paid: 'Pagado',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const statusVariants: Record<
  OrderStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  pending: 'default',
  in_process: 'secondary',
  paid: 'secondary',
  finished: 'outline',
  cancelled: 'destructive',
};

interface PedidoHeaderProps {
  orderNumber: string;
  status: OrderStatus;
}

export function PedidoHeader({ orderNumber, status }: PedidoHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        Pedido #{orderNumber}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariants[status]}>
          {statusLabels[status]}
        </Badge>
      </div>
    </div>
  );
}
