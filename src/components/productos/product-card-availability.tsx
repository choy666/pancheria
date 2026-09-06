import type { ProductType } from '@/domain/types';

interface ProductCardAvailabilityProps {
  type: ProductType;
  availability: number;
  unit?: string;
  testId?: string;
}

export function ProductCardAvailability({
  type,
  availability,
  unit,
  testId = 'product-availability',
}: ProductCardAvailabilityProps) {
  const label =
    type === 'service'
      ? 'Disponible: sin límite'
      : `Disponible: ${availability} ${unit ?? 'unidades'}`;

  return (
    <p data-testid={testId} className="text-sm text-muted-foreground">
      {label}
    </p>
  );
}
