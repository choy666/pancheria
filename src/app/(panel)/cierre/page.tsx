import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CajaPanel } from '@/components/caja/caja-panel';
import { ClosurePanel } from '@/components/cierre/closure-panel';

export default function ClosurePage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cierre</h1>
        <Link href="/cierre/historial" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            Historial de cierres
          </Button>
        </Link>
      </div>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Caja actual</h2>
        <CajaPanel />
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Cierre diario</h2>
        <p className="text-sm text-muted-foreground">
          El cierre diario agrupa las ventas reales de una fecha determinada.
          No confundir con la caja actual que se encuentra abierta.
        </p>
        <ClosurePanel />
      </section>
    </div>
  );
}
