import { Skeleton } from '@/components/ui/skeleton';

export function PedidoSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
