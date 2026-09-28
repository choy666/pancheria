'use client';

import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getNextOpening,
  getTodayOpening,
  isBranchOpen,
} from '@/lib/branch-helpers';
import { BranchInfoCard } from '@/components/pedido/branch-info-card';
import { BranchStatusChip } from '@/components/pedido/branch-status-chip';
import type { BranchStatus } from '@/components/pedido/usePedidoClient';
import type {
  Branch,
  BranchOpeningHours,
  BranchSocialNetwork,
} from '@/domain/types';

type PreviewView = 'catalog' | 'checkout';
type PreviewOpenMode = 'auto' | 'open' | 'closed';

interface BranchPublicPreviewProps {
  /** En edición aporta `id`/`createdAt` reales; en alta van valores de relleno. */
  branch?: Branch;
  name: string;
  address: string;
  phones: { label: string; number: string }[];
  socialLinks: { network: BranchSocialNetwork; url: string }[];
  location: string;
  openingHours: BranchOpeningHours[];
}

const VIEW_OPTIONS: { value: PreviewView; label: string }[] = [
  { value: 'catalog', label: 'En el catálogo' },
  { value: 'checkout', label: 'En el checkout' },
];

const MODE_OPTIONS: { value: PreviewOpenMode; label: string }[] = [
  { value: 'auto', label: 'Según horarios' },
  { value: 'open', label: 'Abierto' },
  { value: 'closed', label: 'Cerrado' },
];

/**
 * Arma un `Branch` a partir del estado local del formulario. Las filas de
 * teléfono totalmente vacías y las redes sin enlace se descartan porque no
 * sobrevivirían a la normalización al guardar; las filas a medio completar
 * se muestran tal cual (sus errores ya se señalan inline en el formulario).
 */
function buildPreviewBranch({
  branch,
  name,
  address,
  phones,
  socialLinks,
  location,
  openingHours,
}: BranchPublicPreviewProps): Branch {
  return {
    id: branch?.id ?? 0,
    name: name.trim() || 'Sucursal',
    openingHours: openingHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      open: h.open,
      close: h.close,
    })),
    address: address.trim() || null,
    phones: phones
      .map((p) => ({ label: p.label.trim(), number: p.number.trim() }))
      .filter((p) => p.label !== '' || p.number !== ''),
    socialLinks: socialLinks
      .map((s) => ({ network: s.network, url: s.url.trim() }))
      .filter((s) => s.url !== ''),
    location: location.trim() || null,
    createdAt: branch?.createdAt ?? new Date(),
  };
}

/**
 * Vista previa en vivo de cómo se verá la sucursal en `/pedido` mientras el
 * admin edita el formulario. Reutiliza `BranchInfoCard` y `BranchStatusChip`
 * — las mismas piezas que ve el cliente — alimentadas por un `Branch` y un
 * `BranchStatus` sintéticos.
 *
 * El estado abierto/cerrado real del catálogo es `cajaAbierta && enHorario`:
 * en edición no hay caja disponible, así que el modo "Según horarios"
 * estima solo la mitad de horarios con `isBranchOpen`. Los modos "Abierto" y
 * "Cerrado" fuerzan el estado para previsualizar ambos banners del checkout.
 */
export function BranchPublicPreview({
  branch,
  name,
  address,
  phones,
  socialLinks,
  location,
  openingHours,
}: BranchPublicPreviewProps) {
  const [view, setView] = useState<PreviewView>('catalog');
  const [openMode, setOpenMode] = useState<PreviewOpenMode>('auto');

  const previewBranch = useMemo(
    () =>
      buildPreviewBranch({
        branch,
        name,
        address,
        phones,
        socialLinks,
        location,
        openingHours,
      }),
    [branch, name, address, phones, socialLinks, location, openingHours]
  );

  const previewStatus = useMemo<BranchStatus>(() => {
    const isOpen =
      openMode === 'auto'
        ? isBranchOpen(previewBranch)
        : openMode === 'open';
    const currentOpening = getTodayOpening(previewBranch);
    const nextOpening = getNextOpening(previewBranch);
    // Mismo texto que arma `GET /api/public/sucursal/estado`.
    const message = isOpen
      ? `Sucursal abierta: ${currentOpening}.`
      : `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`;
    return {
      isOpen,
      currentOpening,
      nextOpening,
      message,
      branch: previewBranch,
    };
  }, [previewBranch, openMode]);

  return (
    <details
      data-testid="branch-public-preview"
      className="rounded-md border border-white/8 p-2"
    >
      <summary className="flex cursor-pointer items-center gap-1 text-sm text-primary">
        <Eye className="size-4" aria-hidden="true" />
        Vista previa en el catálogo público
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Vista:
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={view === option.value ? 'default' : 'outline'}
                onClick={() => setView(option.value)}
                className="h-7 px-2 text-xs"
                aria-pressed={view === option.value}
                data-testid={`branch-preview-view-${option.value}`}
              >
                {option.label}
              </Button>
            ))}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Estado:
            {MODE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={openMode === option.value ? 'default' : 'outline'}
                onClick={() => setOpenMode(option.value)}
                className="h-7 px-2 text-xs"
                aria-pressed={openMode === option.value}
                data-testid={`branch-preview-mode-${option.value}`}
              >
                {option.label}
              </Button>
            ))}
          </span>
        </div>

        {/* En el catálogo el estado vive en el chip junto al encabezado; la
            variante `header` de la tarjeta lo omite a propósito, así que el
            preview lo recompone igual que `PedidoCatalogSection`. */}
        {view === 'catalog' && (
          <BranchStatusChip
            branchStatus={previewStatus}
            activeBranch={previewBranch}
            checked
          />
        )}
        <BranchInfoCard
          variant={view === 'catalog' ? 'header' : 'checkout'}
          branchStatus={previewStatus}
          activeBranch={previewBranch}
        />

        <p className="text-xs text-muted-foreground">
          Con estado &quot;Según horarios&quot; el abierto/cerrado se estima
          por las franjas cargadas; en el catálogo real también depende de que
          haya una caja abierta.
        </p>
      </div>
    </details>
  );
}
