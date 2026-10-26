import { formatMoney } from '@/lib/money';

interface ProductCardPriceProps {
  price: number;
}

export function ProductCardPrice({ price }: ProductCardPriceProps) {
  return (
    <p className="font-heading text-2xl text-brand-red">
      {formatMoney(price)}
    </p>
  );
}
