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
    // Híbrido de la auditoría: el chrome del panel (sidebar/header) sigue
    // oscuro y solo el contenido de `/ventas` monta el tema claro. El
    // scope `[data-theme='light']` hereda los tokens de marca de
    // `globals.css`; los portales (diálogos) llevan `dataTheme="light"`.
    <div
      data-theme="light"
      className="min-h-[calc(100dvh-9rem)] space-y-5 rounded-2xl bg-background p-4 text-foreground md:p-6"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
      <SalesTerminal role={role} userName={userName} />
    </div>
  );
}
