import { Suspense } from 'react';
import { ClosureHistory } from '@/components/cierre/closure-history';

export default function ClosureHistoryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Historial de cierres</h1>
      <Suspense fallback={<p>Cargando...</p>}>
        <ClosureHistory />
      </Suspense>
    </div>
  );
}
