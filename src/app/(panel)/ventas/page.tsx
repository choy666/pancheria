import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { SalesTerminal } from '@/components/ventas/sales-terminal';

export default async function SalesPage() {
  const session = await auth();
  // El rol puede quedar viejo en el JWT: se revalida contra la base.
  const isAdmin =
    !!session?.user &&
    (await revalidateSessionUser(session)) &&
    session.user.role === 'admin';
  const role = isAdmin ? 'admin' : 'operator';
  const userName = session?.user?.name;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
      <SalesTerminal role={role} userName={userName} />
    </div>
  );
}
