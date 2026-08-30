import { auth } from '@/auth';
import { getCurrentBranchIdOrRedirect } from '@/lib/auth';
import * as branchService from '@/application/services/branchService';
import { DashboardClient } from '@/components/panel/dashboard-client';

export default async function DashboardPage() {
  const session = await auth();
  const branchId = await getCurrentBranchIdOrRedirect(session);
  const activeBranch = await branchService.getBranchById(branchId);

  const role = session?.user?.role === 'admin' ? 'admin' : 'operator';

  return (
    <DashboardClient
      branchName={activeBranch?.name ?? session?.user?.branchName}
      role={role}
      userName={session?.user?.name}
    />
  );
}
