import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { ReportesClient } from '@/components/reportes/reportes-client';

export default async function ReportesPage() {
  const session = await auth();

  // Solo admin: el reporte consolida totales de todas las cajas del rango.
  if (
    !session?.user ||
    !(await revalidateSessionUser(session)) ||
    session.user.role !== 'admin'
  ) {
    redirect(routes.home);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Reporte de ventas
      </h1>
      <ReportesClient />
    </div>
  );
}
