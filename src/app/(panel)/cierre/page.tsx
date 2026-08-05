import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CajaPanel } from '@/components/caja/caja-panel';

export default function ClosurePage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cierre de caja</h1>
        <Link href="/cierre/historial" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            Historial de cierres
          </Button>
        </Link>
      </div>
      <CajaPanel />
    </div>
  );
}
