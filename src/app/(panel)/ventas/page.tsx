import { auth } from '@/auth';
import { SalesTerminal } from '@/components/ventas/sales-terminal';

export default async function SalesPage() {
  const session = await auth();
  const role = session?.user?.role === 'admin' ? 'admin' : 'operator';
  const userName = session?.user?.name;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
      <SalesTerminal role={role} userName={userName} />
    </div>
  );
}
