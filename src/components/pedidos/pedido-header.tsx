import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/domain/types';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  converted: 'Confirmado',
  cancelled: 'Cancelado',
};

const statusVariants: Record<OrderStatus, 'default' | 'secondary' | 'destructive'> = {
  pending: 'default',
  converted: 'secondary',
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
