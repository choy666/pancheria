'use client';

import { useState } from 'react';
import type { Branch } from '@/domain/types';
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
}

export function BranchList({ branches }: BranchListProps) {
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>();

  return (
    <div data-tour="branches-table" className="space-y-5">
      <div data-tour="branch-form">
        <BranchForm
          key={editingBranch?.id ?? 'create'}
          branch={editingBranch}
          onCancel={() => setEditingBranch(undefined)}
          createBranchAction={createBranch}
          updateBranchAction={updateBranchAction}
        />
      </div>

      <div className="rounded-2xl border border-white/8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Horarios</TableHead>
              <TableHead className="text-right">ID</TableHead>
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
              const address = branch.address ?? null;

              return (
                <TableRow
                  key={branch.id}
                  data-testid="branch-row"
                  data-branch-id={branch.id}
                  data-branch-name={branch.name}
                >
                  <TableCell data-testid="branch-name">{branch.name}</TableCell>
                  <TableCell data-testid="branch-address" className="max-w-[200px] truncate">
                    {address || '-'}
                  </TableCell>
                  <TableCell data-testid="branch-phone" className="max-w-[150px] truncate">
                    {firstPhone ? `${firstPhone.label}: ${firstPhone.number}` : '-'}
                  </TableCell>
                  <TableCell data-testid="branch-opening-hours" className="text-center">
                    {hasOpeningHours ? (
                      <span className="text-green-400">
                        {uniqueDaysCount} días
                        {openingHoursCount !== uniqueDaysCount &&
                          ` · ${openingHoursCount} franjas`}
                      </span>
                    ) : (
                      <span className="text-amber-400">Sin horarios</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
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
                  No hay sucursales registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
