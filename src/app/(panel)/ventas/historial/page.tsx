import { Suspense } from 'react';
import { CajaHistory } from '@/components/caja/caja-history';

export default function VentasHistorialPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Historial de cierres de caja
      </h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
        <CajaHistory detailRoute="/ventas/historial" statusFilter="all" />
      </Suspense>
    </div>
  );
}
