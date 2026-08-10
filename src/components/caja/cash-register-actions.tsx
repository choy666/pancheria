'use client';

import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { CashRegister } from '@/config/caja';

type CashRegisterActionsProps = {
  cashRegister: Pick<CashRegister, 'id' | 'deletedAt'>;
  mode: 'history' | 'trash';
  onDelete?: (id: number) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onPermanentDelete?: (id: number) => Promise<void>;
};

export function CashRegisterActions({
  cashRegister,
  mode,
  onDelete,
  onRestore,
  onPermanentDelete,
}: CashRegisterActionsProps) {
  async function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onDelete) return;
    if (!confirm(`¿Eliminar la caja #${cashRegister.id}? Se moverá a la papelera.`)) return;
    await onDelete(cashRegister.id);
  }

  async function handleRestore(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onRestore) return;
    if (!confirm(`¿Restaurar la caja #${cashRegister.id}?`)) return;
    await onRestore(cashRegister.id);
  }

  async function handlePermanentDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onPermanentDelete) return;
    if (
      !confirm(
        `¿Eliminar definitivamente la caja #${cashRegister.id}? Esta acción no se puede deshacer.`
      )
    )
      return;
    await onPermanentDelete(cashRegister.id);
  }

  if (mode === 'trash') {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid={`restore-cash-register-${cashRegister.id}`}
          onClick={handleRestore}
        >
          Restaurar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          data-testid={`permanent-delete-cash-register-${cashRegister.id}`}
          onClick={handlePermanentDelete}
        >
          Eliminar definitivamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="destructive"
        size="sm"
        data-testid={`delete-cash-register-${cashRegister.id}`}
        onClick={handleDelete}
      >
        Eliminar
      </Button>
    </div>
  );
}
