import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div data-tour="dashboard-header">
        <h1 className="text-2xl font-semibold tracking-tight">Panel de control</h1>
        <p className="text-base text-muted-foreground">
          Accesos directos a las secciones principales.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-tour="dashboard-ventas" className="hover:border-primary/30 transition-colors">
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

        {isAdmin && (
          <Card data-tour="dashboard-productos" className="hover:border-primary/30 transition-colors">
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
        )}

        <Card data-tour="dashboard-stock" className="hover:border-primary/30 transition-colors">
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

        <Card data-tour="dashboard-caja" className="hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-lg">Caja</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-muted-foreground">
              Abrir, cerrar y controlar la caja.
            </p>
            <Link href="/cierre" className="mt-5 inline-block">
              <Button variant="outline" className="w-full sm:w-auto">
                Ir a caja
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
