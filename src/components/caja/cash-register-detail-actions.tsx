'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CAJA_API } from '@/config/api';
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

  if (!isAdmin) {
    return null;
  }

  async function handleDelete() {
    if (
      !confirm(
        `¿Eliminar la caja #${cashRegister.id}? Se moverá a la papelera.`
      )
    )
      return;

    try {
      const response = await authenticatedFetch(`${CAJA_API}/${cashRegister.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al eliminar la caja');
      }

      router.push('/ventas/historial');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handleRestore() {
    if (!confirm(`¿Restaurar la caja #${cashRegister.id}?`)) return;

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

      router.push('/ventas/historial');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  async function handlePermanentDelete() {
    if (
      !confirm(
        `¿Eliminar definitivamente la caja #${cashRegister.id}? Esta acción no se puede deshacer.`
      )
    )
      return;

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

      router.push('/ventas/historial/eliminadas');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  if (cashRegister.deletedAt) {
    return (
      <div className="flex flex-wrap items-center gap-2">
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
          onClick={() =>
            router.push(
              fromTrash ? '/ventas/historial/eliminadas' : '/ventas/historial'
            )
          }
        >
          {fromTrash ? 'Volver a cajas eliminadas' : 'Volver al historial'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
        onClick={() =>
          router.push(
            fromTrash ? '/ventas/historial/eliminadas' : '/ventas/historial'
          )
        }
      >
        {fromTrash ? 'Volver a cajas eliminadas' : 'Volver al historial'}
      </Button>
    </div>
  );
}
