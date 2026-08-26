'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useErrorDialog } from '@/hooks/useErrorDialog';
import { CAJA_API } from '@/config/api';
import { routes } from '@/config/routes';
import type { CashRegister } from '@/config/caja';

type CashRegisterDetailActionsProps = {
  cashRegister: Pick<CashRegister, 'id' | 'status' | 'deletedAt'>;
  fromTrash?: boolean;
  isAdmin?: boolean;
};

export function CashRegisterDetailActions({
  cashRegister,
  fromTrash = false,
  isAdmin = false,
}: CashRegisterDetailActionsProps) {
  const router = useRouter();
  const { dialog: confirmDialog, confirm } = useConfirmDialog();
  const { dialog: errorDialog, showError } = useErrorDialog();

  if (!isAdmin) {
    return null;
  }

  const backRoute = fromTrash
    ? routes.ventasHistorialEliminadas
    : routes.ventasHistorial;

  async function handleDelete() {
    const shouldDelete = await confirm({
      title: 'Eliminar caja',
      description: `¿Eliminar la caja #${cashRegister.id}? Se moverá a la papelera.`,
      confirmLabel: 'Eliminar',
    });
    if (!shouldDelete) return;

    try {
      const response = await authenticatedFetch(`${CAJA_API}/${cashRegister.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al eliminar la caja');
      }

      router.push(routes.ventasHistorial);
      router.refresh();
    } catch (error) {
      showError(error);
    }
  }

  async function handleRestore() {
    const shouldRestore = await confirm({
      title: 'Restaurar caja',
      description: `¿Restaurar la caja #${cashRegister.id}?`,
      confirmLabel: 'Restaurar',
    });
    if (!shouldRestore) return;

    try {
      const response = await authenticatedFetch(
        `${CAJA_API}/${cashRegister.id}/restaurar`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al restaurar la caja');
      }

      router.push(routes.ventasHistorial);
      router.refresh();
    } catch (error) {
      showError(error);
    }
  }

  async function handlePermanentDelete() {
    const shouldDelete = await confirm({
      title: 'Eliminar definitivamente',
      description: `¿Eliminar definitivamente la caja #${cashRegister.id}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar definitivamente',
    });
    if (!shouldDelete) return;

    try {
      const response = await authenticatedFetch(
        `${CAJA_API}/${cashRegister.id}/permanente`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al eliminar la caja permanentemente');
      }

      router.push(routes.ventasHistorialEliminadas);
      router.refresh();
    } catch (error) {
      showError(error);
    }
  }

  if (cashRegister.deletedAt) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {confirmDialog}
        {errorDialog}
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          data-testid={`restore-cash-register-${cashRegister.id}`}
          onClick={handleRestore}
        >
          Restaurar
        </Button>
        <Button
          variant="destructive"
          className="w-full sm:w-auto"
          data-testid={`permanent-delete-cash-register-${cashRegister.id}`}
          onClick={handlePermanentDelete}
        >
          Eliminar definitivamente
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => router.push(backRoute)}
        >
          {fromTrash ? 'Volver a cajas eliminadas' : 'Volver al historial'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmDialog}
      {errorDialog}
      <Button
        variant="destructive"
        className="w-full sm:w-auto"
        data-testid={`delete-cash-register-${cashRegister.id}`}
        onClick={handleDelete}
      >
        Eliminar
      </Button>
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => router.push(backRoute)}
      >
        {fromTrash ? 'Volver a cajas eliminadas' : 'Volver al historial'}
      </Button>
    </div>
  );
}
