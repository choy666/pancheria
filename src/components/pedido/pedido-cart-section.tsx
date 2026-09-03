import { CartSummary } from './cart-summary';
import type { CartItem } from '@/hooks/useCart';

interface PedidoCartSectionProps {
  branchName: string;
  items: CartItem[];
  total: number;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onEditLine?: (lineId: string) => void;
  onCheckout: () => void;
  disabled: boolean;
}

export function PedidoCartSection({
  branchName,
  items,
  total,
  onUpdateQuantity,
  onRemove,
  onEditLine,
  onCheckout,
  disabled,
}: PedidoCartSectionProps) {
  return (
    <CartSummary
      branchName={branchName}
      items={items}
      total={total}
      onUpdateQuantity={onUpdateQuantity}
      onRemove={onRemove}
      onEditLine={onEditLine}
      onCheckout={onCheckout}
      disabled={disabled}
    />
  );
}
