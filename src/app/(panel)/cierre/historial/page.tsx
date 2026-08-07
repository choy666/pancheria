import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ClosureHistory } from '@/components/cierre/closure-history';

export default function ClosureHistoryPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Historial de cierres</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ClosureHistory />
      </Suspense>
    </div>
  );
}
