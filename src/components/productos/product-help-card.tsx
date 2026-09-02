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
            Las promos tienen un precio fijo y descontarán stock automáticamente
            de los insumos críticos que incluyas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-base text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Insumos críticos:</strong>{' '}
              agregá al menos uno (Pan, Salchicha o Bebida). Sin esto el
              descuento de stock no es automático.
            </li>
            <li>
              <strong className="text-foreground">Insumos manuales y servicios:</strong>{' '}
              podés incluirlos como opcionales o preseleccionados.
            </li>
            <li>
              <strong className="text-foreground">Cantidades:</strong> indicá
              cuántas unidades de cada insumo consume cada promo.
            </li>
          </ol>
          <p className="text-sm">
            El sistema calculará cuántas unidades de la promo podés vender
            según el insumo crítico con menor disponibilidad.
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
          unidad se puede editar: por ejemplo, botella para bebidas, porción o
          envase para aderezos, litro para artículos de limpieza y unidad para
          servicios.
        </p>
      </CardContent>
    </Card>
  );
}
