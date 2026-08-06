'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CAJA_API } from '@/config/api';

interface CashRegister {
  id: number;
  status: 'open' | 'closed';
  deletedAt: string | null;
}

interface CashRegisterDetailActionsProps {
  cashRegister: CashRegister;
  fromTrash?: boolean;
}

export function CashRegisterDetailActions({
  cashRegister,
  fromTrash = false,
}: CashRegisterDetailActionsProps) {
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `¿Eliminar la caja #${cashRegister.id}? Se moverá a la papelera.`
      )
    )
      return;

    try {
      const response = await fetch(`${CAJA_API}/${cashRegister.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al eliminar la caja');
      }

      router.push('/ventas/historial');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  async function handleRestore() {
    if (!confirm(`¿Restaurar la caja #${cashRegister.id}?`)) return;

    try {
      const response = await fetch(
        `${CAJA_API}/${cashRegister.id}/restaurar`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al restaurar la caja');
      }

      router.push('/ventas/historial');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
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
      const response = await fetch(
        `${CAJA_API}/${cashRegister.id}/permanente`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al eliminar la caja permanentemente');
      }

      router.push('/ventas/historial/eliminadas');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  if (cashRegister.deletedAt) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          data-testid={`restore-cash-register-${cashRegister.id}`}
          onClick={handleRestore}
        >
          Restaurar
        </Button>
        <Button
          variant="destructive"
          data-testid={`permanent-delete-cash-register-${cashRegister.id}`}
          onClick={handlePermanentDelete}
        >
          Eliminar definitivamente
        </Button>
        <Button
          variant="outline"
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
    <div className="flex items-center gap-2">
      <Button
        variant="destructive"
        data-testid={`delete-cash-register-${cashRegister.id}`}
        onClick={handleDelete}
      >
        Eliminar
      </Button>
      <Button
        variant="outline"
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
