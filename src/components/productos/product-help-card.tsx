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
          <CardTitle className="text-base">Como armar una promo</CardTitle>
          <CardDescription>
            Las promos son productos con precio fijo que descuentan stock de los
            insumos que incluyas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-base text-muted-foreground">
          <p>
            Cada Super Pancho equivale a 1 Pan y 2 Salchichas. Si pones 2 Super
            Panchos, se descontaran 2 Panes y 4 Salchichas.
          </p>
          <p>
            La bebida es opcional. Si la activas, se descontara del stock de la
            bebida seleccionada. Si no, solo se descuentan Pan y Salchichas.
          </p>
          <p>
            El sistema calcula cuantas unidades de la promo podes vender segun
            el insumo con menor disponibilidad.
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
          Elegi el tipo segun si se vende y si debe descontar stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-base text-muted-foreground">
        <p>
          <strong className="text-foreground">Insumo critico:</strong> se
          vende solo en promos o como bebida individual, y desconta stock
          automaticamente. Indica si es Pan, Salchicha o Bebida.
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
          El stock se carga al inicio y se ajusta desde la pagina Stock. La
          unidad se asigna automaticamente (botella para bebidas, unidad para el
          resto).
        </p>
      </CardContent>
    </Card>
  );
}
