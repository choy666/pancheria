import { CartSummary } from './cart-summary';
import type { CartItem } from '@/hooks/useCart';

interface PedidoCartSectionProps {
  branchName: string;
  items: CartItem[];
  total: number;
  shortageByProduct?: Record<number, boolean>;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onEditLine?: (lineId: string) => void;
  onCheckout: () => void;
  disabled: boolean;
  isCheckingAvailability?: boolean;
}

export function PedidoCartSection({
  branchName,
  items,
  total,
  shortageByProduct,
  onUpdateQuantity,
  onRemove,
  onEditLine,
  onCheckout,
  disabled,
  isCheckingAvailability,
}: PedidoCartSectionProps) {
  return (
    <CartSummary
      branchName={branchName}
      items={items}
      total={total}
      shortageByProduct={shortageByProduct}
      onUpdateQuantity={onUpdateQuantity}
      onRemove={onRemove}
      onEditLine={onEditLine}
      onCheckout={onCheckout}
      disabled={disabled}
      isCheckingAvailability={isCheckingAvailability}
    />
  );
}
