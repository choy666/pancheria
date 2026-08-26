import { CartSummary } from './cart-summary';
import type { CartItem } from '@/hooks/useCart';

interface PedidoCartSectionProps {
  branchName: string;
  items: CartItem[];
  total: number;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  disabled: boolean;
}

export function PedidoCartSection({
  branchName,
  items,
  total,
  onUpdateQuantity,
  onRemove,
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
      onCheckout={onCheckout}
      disabled={disabled}
    />
  );
}
