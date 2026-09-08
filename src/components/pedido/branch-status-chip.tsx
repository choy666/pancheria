'use client';

import type { Branch } from '@/domain/types';
import type { BranchStatus } from './usePedidoClient';

interface BranchStatusChipProps {
  branchStatus: BranchStatus | null;
  activeBranch: Branch;
  /** `true` cuando ya se consultó el estado al menos una vez. */
  checked: boolean;
}

/**
 * Versión compacta del estado de la sucursal para el encabezado del catálogo
 * público: avisa si el local está abierto antes de que el cliente arme todo
 * el pedido. El detalle completo se sigue mostrando con `BranchInfoCard`
 * dentro del modal de checkout.
 */
export function BranchStatusChip({
  branchStatus,
  activeBranch,
  checked,
}: BranchStatusChipProps) {
  if (!checked) {
    return (
      <p
        data-testid="branch-status-chip"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
        Consultando horario...
      </p>
    );
  }

  // Si no se pudo consultar, no se muestra el estado para no dar información
  // engañosa; la validación real ocurre al enviar el pedido.
  if (!branchStatus) return null;

  const isOpen = branchStatus.isOpen;
  const nextOpening = branchStatus.nextOpening;

  return (
    <p
      data-testid="branch-status-chip"
      className={`flex items-center gap-2 text-sm ${
        isOpen ? 'text-green-400' : 'text-amber-400'
      }`}
    >
      <span
        className={`inline-block size-2 rounded-full ${
          isOpen ? 'bg-green-400' : 'bg-amber-400'
        }`}
      />
      {isOpen
        ? 'Abierto ahora'
        : `Cerrado ahora${nextOpening ? ` · Abre ${nextOpening}` : ''}`}
      <span className="sr-only">en {activeBranch.name}</span>
    </p>
  );
}
