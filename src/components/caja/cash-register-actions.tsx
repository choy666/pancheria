'use client';

import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { CashRegister } from '@/config/caja';

type CashRegisterActionsProps = {
  cashRegister: Pick<CashRegister, 'id' | 'deletedAt'>;
  mode: 'history' | 'trash';
  isAdmin?: boolean;
  onDelete?: (id: number) => Promise<void>;
  onRestore?: (id: number) => Promise<void>;
  onPermanentDelete?: (id: number) => Promise<void>;
};

export function CashRegisterActions({
  cashRegister,
  mode,
  isAdmin = false,
  onDelete,
  onRestore,
  onPermanentDelete,
}: CashRegisterActionsProps) {
  const { dialog, confirm } = useConfirmDialog();

  if (!isAdmin) {
    return null;
  }

  async function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onDelete) return;
    const shouldDelete = await confirm({
      title: 'Eliminar caja',
      description: `¿Eliminar la caja #${cashRegister.id}? Se moverá a la papelera.`,
      confirmLabel: 'Eliminar',
    });
    if (!shouldDelete) return;
    await onDelete(cashRegister.id);
  }

  async function handleRestore(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onRestore) return;
    const shouldRestore = await confirm({
      title: 'Restaurar caja',
      description: `¿Restaurar la caja #${cashRegister.id}?`,
      confirmLabel: 'Restaurar',
    });
    if (!shouldRestore) return;
    await onRestore(cashRegister.id);
  }

  async function handlePermanentDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!onPermanentDelete) return;
    const shouldDelete = await confirm({
      title: 'Eliminar definitivamente',
      description: `¿Eliminar definitivamente la caja #${cashRegister.id}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar definitivamente',
    });
    if (!shouldDelete) return;
    await onPermanentDelete(cashRegister.id);
  }

  if (mode === 'trash') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dialog}
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          data-testid={`restore-cash-register-${cashRegister.id}`}
          onClick={handleRestore}
        >
          Restaurar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full sm:w-auto"
          data-testid={`permanent-delete-cash-register-${cashRegister.id}`}
          onClick={handlePermanentDelete}
        >
          Eliminar definitivamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {dialog}
      <Button
        variant="destructive"
        size="sm"
        className="w-full sm:w-auto"
        data-testid={`delete-cash-register-${cashRegister.id}`}
        onClick={handleDelete}
      >
        Eliminar
      </Button>
    </div>
  );
}
