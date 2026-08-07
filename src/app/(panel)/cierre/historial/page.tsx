import { Suspense } from 'react';
import { ClosureHistory } from '@/components/cierre/closure-history';

export default function ClosureHistoryPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Historial de cierres</h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
        <ClosureHistory />
      </Suspense>
    </div>
  );
}
