import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CajaPanel } from '@/components/caja/caja-panel';

export default function ClosurePage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cierre de caja</h1>
        <Link href="/ventas/historial" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            Historial de cajas
          </Button>
        </Link>
      </div>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">Caja actual</h2>
        <CajaPanel />
      </section>
    </div>
  );
}
