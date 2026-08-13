'use client';

import { useState } from 'react';
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

interface Branch {
  id: number;
  name: string;
}

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

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">ID</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>{branch.name}</TableCell>
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
            ))}
            {branches.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
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
