import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { revalidateSessionUser } from '@/lib/auth';
import { routes } from '@/config/routes';
import { getDefaultBranchName } from '@/config/branch';
import { listBranchesForRequest } from '@/lib/server-cache';
import { getBranchOperationalStatus } from '@/lib/branch-helpers';
import { Button } from '@/components/ui/button';
import { BranchList } from '@/components/sucursales/branch-list';
import type { BranchOperationalStatus } from '@/lib/branch-helpers';

// Las server actions del segmento (actions.ts) heredan este límite:
// `deleteBranchAction` recorre claves de storage y la cascada de borrado,
// trabajo pesado comparable al de las rutas con `maxDuration = 300`.
export const maxDuration = 300;

export default async function SucursalesPage() {
  const session = await auth();

  // El rol puede quedar viejo en el JWT: se revalida contra la base antes
  // de decidir el acceso (un admin degradado no debe ver esta página).
  if (
    !session?.user ||
    !(await revalidateSessionUser(session)) ||
    session.user.role !== 'admin'
  ) {
    redirect(routes.home);
  }

  const branches = await listBranchesForRequest();
  // Se pasa el nombre (no un flag por fila) para que la comparación quede
  // junto a la sucursal en edición, con el mismo match exacto que usa
  // `getDefaultBranchId` (`findByName`, case-sensitive).
  const defaultBranchName = getDefaultBranchName();

  // Estado operativo por horarios (helpers puros, sin queries extra). Se
  // calcula una vez en SSR: el badge queda congelado hasta recargar la
  // página — no hay polling como en /caja.
  const now = new Date();
  const statusById = Object.fromEntries(
    branches.map((branch) => [
      branch.id,
      getBranchOperationalStatus(branch, now),
    ])
  ) as Record<number, BranchOperationalStatus>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 data-tour="branches-header" className="text-2xl font-semibold tracking-tight">Sucursales</h1>
        {/* Ancla nativa al formulario: funciona aunque falle la hidratación. */}
        <a href="#nueva-sucursal" className="w-full sm:w-auto">
          <Button data-tour="branches-new" className="w-full sm:w-auto">
            Nueva sucursal
          </Button>
        </a>
      </div>

      <BranchList
        branches={branches}
        defaultBranchName={defaultBranchName}
        statusById={statusById}
      />
    </div>
  );
}
