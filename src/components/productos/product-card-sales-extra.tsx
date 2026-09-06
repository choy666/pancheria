interface ProductCardSalesExtraProps {
  isOutOfStock: boolean;
  maxAdditional: number;
}

export function ProductCardSalesExtra({
  isOutOfStock,
  maxAdditional,
}: ProductCardSalesExtraProps) {
  return (
    <p
      className={`text-sm ${
        isOutOfStock
          ? 'font-medium text-destructive'
          : 'text-muted-foreground'
      }`}
    >
      {isOutOfStock ? 'Sin stock' : `Podés sumar: ${maxAdditional} más`}
    </p>
  );
}
