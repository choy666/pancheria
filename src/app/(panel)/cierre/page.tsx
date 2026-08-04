import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ClosurePanel } from '@/components/cierre/closure-panel';

export default function ClosurePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cierre de caja</h1>
        <Link href="/cierre/historial">
          <Button variant="outline">Historial de cierres</Button>
        </Link>
      </div>
      <ClosurePanel />
    </div>
  );
}
