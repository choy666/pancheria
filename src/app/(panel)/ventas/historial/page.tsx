import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CajaHistory } from '@/components/caja/caja-history';

export default function VentasHistorialPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Historial de cajas
        </h1>
        <Link href="/ventas/historial/eliminadas" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">Cajas eliminadas</Button>
        </Link>
      </div>
      <CajaHistory
        detailRoute="/ventas/historial"
        statusFilter="all"
        showAutoColumn={false}
      />
    </div>
  );
}
