import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pantalla táctil para registrar ventas rápidas.
          </p>
          <Link href="/ventas" className="mt-4 inline-block">
            <Button>Ir a ventas</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Administrar productos, insumos y recetas.
          </p>
          <Link href="/productos" className="mt-4 inline-block">
            <Button variant="outline">Ir a productos</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ver alertas y ajustar stock manualmente.
          </p>
          <Link href="/stock" className="mt-4 inline-block">
            <Button variant="outline">Ir a stock</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cierre</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Generar el cierre diario de caja.
          </p>
          <Link href="/cierre" className="mt-4 inline-block">
            <Button variant="outline">Ir a cierre</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
