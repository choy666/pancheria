import { redirect } from 'next/navigation';
import { getDefaultBranchId, parseBranchId } from '@/lib/branch-resolver';

/**
 * Resolución de sucursal para las páginas kiosk (`/pantalla`, `/menu`):
 * - `branchId` explícito inválido → redirect a la ruta pelada, que a su vez
 *   resuelve la sucursal por defecto.
 * - sin `branchId` → redirect a la URL canónica `?branchId=N` de la sucursal
 *   por defecto: la TV queda fijada a una sucursal concreta y el QR apunta
 *   siempre bien.
 * Devuelve `null` cuando la por defecto no resuelve (el llamador renderiza
 * el estado de error). Los `redirect` de Next lanzan, así que la función
 * solo retorna un `branchId` explícito válido o `null`.
 */
export async function resolveKioskBranchId(
  params: { branchId?: string },
  selfRoute: string
): Promise<number | null> {
  if (params.branchId) {
    const parsed = parseBranchId(params.branchId);
    if (parsed === null) {
      redirect(selfRoute);
    }
    return parsed;
  }

  const branchId = await getDefaultBranchId();
  if (branchId === null) {
    return null;
  }

  redirect(`${selfRoute}?branchId=${branchId}`);
}
