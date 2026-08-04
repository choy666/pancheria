import { SalesTerminal } from '@/components/ventas/sales-terminal';

export default function SalesPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
      <SalesTerminal />
    </div>
  );
}
