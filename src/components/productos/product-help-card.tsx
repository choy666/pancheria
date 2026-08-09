import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ProductHelpCardProps {
  variant: 'product' | 'promo';
}

export function ProductHelpCard({ variant }: ProductHelpCardProps) {
  if (variant === 'promo') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo armar una promo</CardTitle>
          <CardDescription>
            Las promos son productos con precio fijo que descontarán stock de los
            insumos que incluyas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-base text-muted-foreground">
          <p>
            Agregá los insumos críticos (Pan, Salchicha o Bebida) y la cantidad
            que consume cada unidad de la promo.
          </p>
          <p>
            Solo se permiten insumos críticos en la receta. El sistema calcula
            cuántas unidades de la promo podés vender según el insumo con menor
            disponibilidad.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tipos de producto</CardTitle>
        <CardDescription>
          Elegí el tipo según si se vende y si debe descontar stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-base text-muted-foreground">
        <p>
          <strong className="text-foreground">Insumo crítico:</strong> se
          vende solo en promos o como bebida individual, y desconta stock
          automáticamente. Indica si es Pan, Salchicha o Bebida.
        </p>
        <p>
          <strong className="text-foreground">Insumo manual:</strong> no se
          vende en la terminal y no desconta stock por ventas. Sirve para
          aderezos, empaques y otros insumos de control interno.
        </p>
        <p>
          <strong className="text-foreground">Servicio / extra:</strong> se
          vende en la terminal pero no desconta stock. Ideal para agregados de
          toppings o vaso de gaseosa.
        </p>
        <p>
          El stock se carga al inicio y se ajusta desde la página Stock. La
          unidad se asigna automáticamente (botella para bebidas, unidad para el
          resto).
        </p>
      </CardContent>
    </Card>
  );
}
