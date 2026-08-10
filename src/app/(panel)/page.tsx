import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de control</h1>
        <p className="text-base text-muted-foreground">
          Accesos directos a las secciones principales.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-lg">Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground">
              Pantalla táctil para registrar ventas rápidas.
            </p>
            <Link href="/ventas" className="mt-5 inline-block">
              <Button className="w-full sm:w-auto">Ir a ventas</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-lg">Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground">
              Administrar productos y promos.
            </p>
            <Link href="/productos" className="mt-5 inline-block">
              <Button variant="outline" className="w-full sm:w-auto">
                Ir a productos
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-lg">Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground">
              Ver alertas y ajustar stock manualmente.
            </p>
            <Link href="/stock" className="mt-5 inline-block">
              <Button variant="outline" className="w-full sm:w-auto">
                Ir a stock
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-lg">Cierre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground">
              Generar el cierre diario de caja.
            </p>
            <Link href="/cierre" className="mt-5 inline-block">
              <Button variant="outline" className="w-full sm:w-auto">
                Ir a cierre
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
