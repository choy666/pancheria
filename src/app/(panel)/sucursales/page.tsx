import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as branchService from '@/application/services/branchService';
import { BranchList } from '@/components/sucursales/branch-list';

export default async function SucursalesPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branches = await branchService.listBranches();

  return (
    <div className="space-y-5">
      <h1 data-tour="branches-header" className="text-2xl font-semibold tracking-tight">Sucursales</h1>

      <BranchList branches={branches} />
    </div>
  );
}
