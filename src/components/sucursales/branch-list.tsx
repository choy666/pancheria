'use client';

import { useState } from 'react';
import { MapPin, Phone, Share2 } from 'lucide-react';
import type { Branch } from '@/domain/types';
import type { BranchOperationalStatus } from '@/lib/branch-helpers';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BranchForm } from '@/components/sucursales/branch-form';
import { BranchActions } from '@/components/sucursales/branch-actions';
import {
  createBranch,
  updateBranchAction,
} from '@/app/(panel)/sucursales/actions';

interface BranchListProps {
  branches: Branch[];
  defaultBranchName?: string;
  /** Estado de horario calculado en SSR (queda congelado hasta recargar). */
  statusById: Record<number, BranchOperationalStatus>;
}

export function BranchList({
  branches,
  defaultBranchName,
  statusById,
}: BranchListProps) {
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>();

  // Igualdad exacta, igual que `getDefaultBranchId` (`findByName`,
  // case-sensitive): si el nombre coincide, renombrarla dejaría /pedido
  // sin sucursal canónica y el formulario lo advierte.
  const editingDefaultBranch =
    !!editingBranch &&
    !!defaultBranchName &&
    editingBranch.name === defaultBranchName;

  return (
    <div data-tour="branches-table" className="space-y-5">
      <div className="rounded-2xl border border-white/8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden sm:table-cell">Dirección</TableHead>
              <TableHead className="hidden md:table-cell">Teléfono</TableHead>
              <TableHead className="text-center">Horarios</TableHead>
              <TableHead className="hidden text-right lg:table-cell">
                ID
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => {
              const hasOpeningHours = branch.openingHours && branch.openingHours.length > 0;
              const openingHoursCount = branch.openingHours?.length ?? 0;
              // `openingHours` guarda franjas (puede haber varias por día);
              // los días únicos reflejan la cobertura semanal real.
              const uniqueDaysCount = new Set(
                branch.openingHours?.map((h) => h.dayOfWeek) ?? []
              ).size;
              const firstPhone = branch.phones?.[0];
              const phoneCount = branch.phones?.length ?? 0;
              const socialCount = branch.socialLinks?.length ?? 0;
              const address = branch.address ?? null;
              const status = statusById[branch.id];
              const phonesTitle = branch.phones
                ?.map((p) => `${p.label}: ${p.number}`)
                .join('\n');

              return (
                <TableRow
                  key={branch.id}
                  data-testid="branch-row"
                  data-branch-id={branch.id}
                  data-branch-name={branch.name}
                >
                  <TableCell data-testid="branch-name" className="font-medium">
                    {branch.name}
                    {/* Sub-resumen solo móvil: muestra lo que queda oculto al
                        ocultar las columnas Dirección/Teléfono (A5). */}
                    <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                      {address ?? 'Sin dirección'}
                      {firstPhone ? ` · ${firstPhone.number}` : ''}
                      {phoneCount > 1 ? ` (+${phoneCount - 1})` : ''}
                    </span>
                    {(branch.location || phoneCount > 0 || socialCount > 0) && (
                      <span className="mt-0.5 flex items-center gap-3 text-xs font-normal text-muted-foreground">
                        {branch.location && (
                          <span
                            className="inline-flex items-center gap-1"
                            title="Ubicación cargada para el mapa del catálogo"
                          >
                            <MapPin className="size-3" aria-hidden />
                            Mapa
                          </span>
                        )}
                        {phoneCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1"
                            title={phonesTitle}
                          >
                            <Phone className="size-3" aria-hidden />
                            {phoneCount} tel.
                          </span>
                        )}
                        {socialCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1"
                            title={branch.socialLinks
                              ?.map((s) => s.url)
                              .join('\n')}
                          >
                            <Share2 className="size-3" aria-hidden />
                            {socialCount}{' '}
                            {socialCount === 1 ? 'red' : 'redes'}
                          </span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    data-testid="branch-address"
                    className="hidden max-w-[200px] truncate sm:table-cell"
                    title={address ?? undefined}
                  >
                    {address || '-'}
                  </TableCell>
                  <TableCell
                    data-testid="branch-phone"
                    className="hidden max-w-[150px] truncate md:table-cell"
                    title={phonesTitle}
                  >
                    {firstPhone ? `${firstPhone.label}: ${firstPhone.number}` : '-'}
                  </TableCell>
                  <TableCell
                    data-testid="branch-opening-hours"
                    className="text-center"
                  >
                    {hasOpeningHours ? (
                      <div className="flex flex-col items-center gap-1">
                        {/* El badge refleja el horario vigente al cargar la
                            página, no el estado del canal público (que además
                            exige una caja abierta). */}
                        <Badge
                          variant="outline"
                          data-testid="branch-schedule-status"
                          title="Según los horarios cargados, al momento de abrir la página. El canal público además requiere una caja abierta."
                          className={
                            status?.state === 'in_hours'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'text-muted-foreground'
                          }
                        >
                          {status?.state === 'in_hours'
                            ? 'En horario'
                            : 'Cerrado'}
                        </Badge>
                        <span className="text-green-400">
                          {uniqueDaysCount} días
                          {openingHoursCount !== uniqueDaysCount &&
                            ` · ${openingHoursCount} franjas`}
                        </span>
                        {status && (
                          <span className="text-xs text-muted-foreground">
                            {status.detail}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-amber-400">Sin horarios</span>
                        <span
                          className="text-xs text-muted-foreground"
                          title="Sin horarios, el canal público considera la sucursal abierta siempre que haya una caja abierta"
                        >
                          Abierta al público si hay caja abierta
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono lg:table-cell">
                    {branch.id}
                  </TableCell>
                  <TableCell className="text-right">
                    <BranchActions
                      branchId={branch.id}
                      branchName={branch.name}
                      onEdit={() => setEditingBranch(branch)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {branches.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No hay sucursales registradas.{' '}
                  {/* Esta página también es el onboarding del admin sin
                      sucursal: el CTA de alta queda visible aunque la tabla
                      esté vacía. */}
                  <a
                    href="#nueva-sucursal"
                    className="text-primary underline underline-offset-4"
                  >
                    Crear la primera sucursal
                  </a>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div
        id="nueva-sucursal"
        data-tour="branch-form"
        className="scroll-mt-20"
      >
        <BranchForm
          key={editingBranch?.id ?? 'create'}
          branch={editingBranch}
          isDefaultBranch={editingDefaultBranch}
          onCancel={() => setEditingBranch(undefined)}
          createBranchAction={createBranch}
          updateBranchAction={updateBranchAction}
        />
      </div>
    </div>
  );
}
