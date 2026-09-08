import type { ProductType } from '@/domain/types';

interface ProductCardAvailabilityProps {
  type: ProductType;
  availability: number;
  unit?: string;
  testId?: string;
  /**
   * Modo público (`/pedido`): muestra estados cualitativos sin exponer
   * cantidades de stock al cliente.
   */
  qualitative?: boolean;
}

export function ProductCardAvailability({
  type,
  availability,
  unit,
  testId = 'product-availability',
  qualitative = false,
}: ProductCardAvailabilityProps) {
  const label = qualitative
    ? type === 'service'
      ? 'Disponible'
      : availability <= 0
        ? 'Agotado'
        : availability <= 3
          ? 'Últimas unidades'
          : 'Disponible'
    : type === 'service'
      ? 'Disponible: sin límite'
      : `Disponible: ${availability} ${unit ?? 'unidades'}`;

  return (
    <p data-testid={testId} className="text-sm text-muted-foreground">
      {label}
    </p>
  );
}
