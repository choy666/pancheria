'use client';

import {
  getTodayOpening,
  getNextOpening,
  formatOpeningHours,
} from '@/lib/branch-helpers';
import { BranchMap } from './branch-map';
import { BranchPhones, BranchSocialLinks } from './branch-contact';
import type { Branch } from '@/domain/types';
import type { BranchStatus } from './usePedidoClient';

interface BranchInfoCardProps {
  branchStatus: BranchStatus | null;
  activeBranch: Branch;
  /**
   * `header`: versión compacta para el encabezado del catálogo. El estado
   * abierto/cerrado ya lo muestra `BranchStatusChip`, así que se omiten el
   * indicador y los banners, y se prioriza el microcopy que invita a pedir
   * por la plataforma.
   * `checkout`: versión completa para el diálogo de confirmación del pedido,
   * con indicador de estado y banners de aviso (por defecto).
   */
  variant?: 'header' | 'checkout';
}

/**
 * Tarjeta de datos de la sucursal. Consume `activeBranch` (SSR) y
 * `branchStatus.branch` (API pública) como única fuente de verdad; el
 * polling existente mantiene el estado al día sin fetchs adicionales.
 */
export function BranchInfoCard({
  branchStatus,
  activeBranch,
  variant = 'checkout',
}: BranchInfoCardProps) {
  const isStatusKnown = branchStatus !== null;
  const currentOpening =
    branchStatus?.currentOpening ?? getTodayOpening(activeBranch);
  const nextOpening =
    branchStatus?.nextOpening ?? getNextOpening(activeBranch);
  const isOpen = branchStatus?.isOpen ?? false;
  const branch = branchStatus?.branch ?? activeBranch;
  const isHeader = variant === 'header';

  return (
    <div className="space-y-3" data-testid="branch-info-card">
      <div className="rounded-lg border border-border p-3 text-sm">
        {isHeader ? (
          <p className="text-muted-foreground">
            Pedí por acá: el local confirma tu pedido y coordinás todo por el
            chat, sin salir de la página.
          </p>
        ) : (
          <p className="font-medium text-foreground">{branch.name}</p>
        )}
        {!isHeader &&
          (isStatusKnown ? (
            <p
              className={`mt-1 flex items-center gap-1 ${
                isOpen ? 'text-green-400' : 'text-amber-400'
              }`}
            >
              <span
                className={`inline-block size-2 rounded-full ${
                  isOpen ? 'bg-green-400' : 'bg-amber-400'
                }`}
              />
              {isOpen ? 'Abierto ahora' : 'Cerrado'}
              {!isOpen && nextOpening && ` · Próxima apertura: ${nextOpening}`}
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
              Consultando disponibilidad...
            </p>
          ))}
        <p className="mt-1 text-muted-foreground">
          Horario de hoy: {currentOpening}
        </p>
        {branch.openingHours && branch.openingHours.length > 0 && (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Ver todos los horarios</summary>
            <p className="pt-1">
              {formatOpeningHours(branch.openingHours)}
            </p>
          </details>
        )}
        {branch.address && (
          <p className="mt-1 text-muted-foreground">
            Dirección: {branch.address}
          </p>
        )}
        <BranchPhones
          phones={branch.phones ?? []}
          className="mt-1 text-muted-foreground"
        />
        {branch.location && (
          <BranchMap location={branch.location} branchName={branch.name} />
        )}
        <BranchSocialLinks
          links={branch.socialLinks ?? []}
          whatsappAsText={isHeader}
          className={`mt-1 text-muted-foreground ${isHeader ? 'text-xs' : ''}`}
        />
      </div>

      {!isHeader && isStatusKnown && !isOpen && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          role="alert"
        >
          La sucursal está cerrada. Tu pedido se preparará cuando abra:{' '}
          {nextOpening}.
        </div>
      )}

      {!isHeader && isStatusKnown && isOpen && (
        <div
          className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200"
          role="status"
        >
          Sucursal abierta: {currentOpening}.
        </div>
      )}
    </div>
  );
}
