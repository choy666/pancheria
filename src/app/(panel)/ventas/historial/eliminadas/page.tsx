import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CajaHistory } from '@/components/caja/caja-history';

export default function CajasEliminadasPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cajas eliminadas</h1>
        <Link href="/ventas/historial">
          <Button variant="outline">Volver al historial</Button>
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
        <CajaHistory
          detailRoute="/ventas/historial"
          deletedOnly
          showAutoColumn={false}
        />
      </Suspense>
    </div>
  );
}
