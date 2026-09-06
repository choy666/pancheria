import { formatMoney } from '@/lib/money';

interface ProductCardPriceProps {
  price: number;
}

export function ProductCardPrice({ price }: ProductCardPriceProps) {
  return (
    <p className="font-mono text-2xl font-bold text-primary">
      {formatMoney(price)}
    </p>
  );
}
