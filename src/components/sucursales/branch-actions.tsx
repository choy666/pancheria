'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  deleteBranchAction,
  getBranchDeletionSummaryAction,
  type BranchState,
} from '@/app/(panel)/sucursales/actions';

const initialState: BranchState = null;

interface BranchActionsProps {
  branchId: number;
  branchName: string;
  onEdit: () => void;
}

interface DeletionSummary {
  branch: { id: number; name: string };
  counts: {
    products: number;
    sales: number;
    cashRegisters: number;
    dailyClosures: number;
    stockMovements: number;
    users: number;
    recipes: number;
    total: number;
  };
}

export function BranchActions({
  branchId,
  branchName,
  onEdit,
}: BranchActionsProps) {
  const [state, formAction, isPending] = useActionState(
    deleteBranchAction,
    initialState
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [summary, setSummary] = useState<DeletionSummary | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [isLoadingSummary, startLoadingSummary] = useTransition();
  const hasSubmittedRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const [dismissed, setDismissed] = useState<BranchState>(null);
  const isErrorDialogOpen = !!state?.error && state !== dismissed;

  useEffect(() => {
    if (hasSubmittedRef.current && !isPending && state === null) {
      hasSubmittedRef.current = false;
      setIsDialogOpen(false);
      setSummary(null);
      setConfirmName('');
    }
  }, [isPending, state]);

  function handleOpenDelete() {
    startLoadingSummary(async () => {
      try {
        const result = await getBranchDeletionSummaryAction(branchId);
        setSummary(result);
        setIsDialogOpen(true);
      } catch {
        setSummary({
          branch: { id: branchId, name: branchName },
          counts: {
            products: 0,
            sales: 0,
            cashRegisters: 0,
            dailyClosures: 0,
            stockMovements: 0,
            users: 0,
            recipes: 0,
            total: 0,
          },
        });
        setIsDialogOpen(true);
      }
    });
  }

  const canConfirm = confirmName.trim() === branchName;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>

      <Button
        ref={deleteButtonRef}
        type="button"
        variant="ghost"
        size="sm"
        disabled={isLoadingSummary}
        className="text-destructive hover:text-destructive"
        onClick={handleOpenDelete}
      >
        {isLoadingSummary ? 'Cargando...' : 'Eliminar'}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
              <p>
                Vas a eliminar la sucursal <strong>{branchName}</strong>. Esta
                acción borrará permanentemente los siguientes datos:
              </p>

              {summary ? (
                <ul className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                  <li>
                    <strong>Total de registros afectados:</strong>{' '}
                    {summary.counts.total}
                  </li>
                  {summary.counts.products > 0 && (
                    <li>Productos: {summary.counts.products}</li>
                  )}
                  {summary.counts.recipes > 0 && (
                    <li>Recetas: {summary.counts.recipes}</li>
                  )}
                  {summary.counts.sales > 0 && (
                    <li>Ventas: {summary.counts.sales}</li>
                  )}
                  {summary.counts.cashRegisters > 0 && (
                    <li>Cajas: {summary.counts.cashRegisters}</li>
                  )}
                  {summary.counts.dailyClosures > 0 && (
                    <li>Cierres diarios: {summary.counts.dailyClosures}</li>
                  )}
                  {summary.counts.stockMovements > 0 && (
                    <li>Movimientos de stock: {summary.counts.stockMovements}</li>
                  )}
                  {summary.counts.users > 0 && (
                    <li>Usuarios: {summary.counts.users}</li>
                  )}
                  {summary.counts.total === 0 && (
                    <li>No hay registros asociados.</li>
                  )}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  No se pudo cargar el resumen.
                </p>
              )}

              <p className="text-destructive">
                Esta acción no se puede deshacer. Para confirmar, escribí el
                nombre exacto de la sucursal.
              </p>

              <form
                action={formAction}
                onSubmit={() => {
                  hasSubmittedRef.current = true;
                }}
                className="space-y-4"
              >
                <input type="hidden" name="id" value={branchId} />
                <input
                  type="hidden"
                  name="confirmBranchName"
                  value={confirmName.trim()}
                />
                <Input
                  name="confirmName"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Escribí "${branchName}" para confirmar`}
                  autoComplete="off"
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={!canConfirm || isPending}
                  >
                    {isPending ? 'Eliminando...' : 'Eliminar definitivamente'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
      </Dialog>

      <Dialog
        open={isErrorDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDismissed(state);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No se pudo eliminar</DialogTitle>
          </DialogHeader>
          <DialogDescription
            role="alert"
            aria-live="polite"
            className="pt-4 text-base text-destructive"
          >
            {state?.error}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
