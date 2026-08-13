import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import * as branchService from '@/application/services/branchService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BranchForm } from '@/components/sucursales/branch-form';

export default async function SucursalesPage() {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const branches = await branchService.listBranches();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Sucursales</h1>

      <BranchForm />

      <div className="rounded-2xl border border-white/8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>{branch.name}</TableCell>
                <TableCell className="text-right font-mono">
                  {branch.id}
                </TableCell>
              </TableRow>
            ))}
            {branches.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={2}
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
