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
    stockMovements: number;
    users: number;
    recipes: number;
    orders: number;
    videos: number;
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
  const submitError =
    state?.error && state !== dismissed ? state.error : null;

  useEffect(() => {
    if (hasSubmittedRef.current && !isPending && state === null) {
      hasSubmittedRef.current = false;
      setIsDialogOpen(false);
      setSummary(null);
      setConfirmName('');
    }
  }, [isPending, state]);

  // El diálogo solo se abre una vez resuelta o fallida la consulta: un
  // `summary` nulo dentro del diálogo significa que falló la consulta, en
  // cuyo caso se muestra el error con opción de reintento. No se fabrica un
  // resumen en cero porque informaría falsamente que no hay datos asociados.
  function loadSummary() {
    startLoadingSummary(async () => {
      try {
        const result = await getBranchDeletionSummaryAction(branchId);
        setSummary(result);
      } catch {
        setSummary(null);
      }
      setIsDialogOpen(true);
    });
  }

  function handleDialogOpenChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      // Descarta un error de submit anterior para que no reaparezca
      // en la próxima apertura del diálogo.
      setDismissed(state);
    }
  }

  const canConfirm = !!summary && confirmName.trim() === branchName;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>

      <Button
        ref={deleteButtonRef}
        type="button"
        data-testid={`delete-branch-${branchId}`}
        variant="ghost"
        size="sm"
        disabled={isLoadingSummary}
        className="text-destructive hover:text-destructive"
        onClick={loadSummary}
      >
        {isLoadingSummary ? 'Cargando...' : 'Eliminar'}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
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
                  {summary.counts.stockMovements > 0 && (
                    <li>Movimientos de stock: {summary.counts.stockMovements}</li>
                  )}
                  {summary.counts.orders > 0 && (
                    <li>Pedidos: {summary.counts.orders}</li>
                  )}
                  {summary.counts.users > 0 && (
                    <li>Usuarios: {summary.counts.users}</li>
                  )}
                  {summary.counts.videos > 0 && (
                    <li>Videos: {summary.counts.videos}</li>
                  )}
                  {summary.counts.total === 0 && (
                    <li>No hay registros asociados.</li>
                  )}
                </ul>
              ) : (
                <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive" role="alert">
                    No se pudo cargar el resumen de registros asociados. Sin
                    el resumen no se puede confirmar la eliminación.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadSummary}
                      disabled={isLoadingSummary}
                    >
                      {isLoadingSummary ? 'Cargando...' : 'Reintentar'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDialogOpenChange(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {summary && (
                <>
                  <p className="text-destructive">
                    Esta acción no se puede deshacer. Para confirmar, escribí
                    el nombre exacto de la sucursal.
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
                    {submitError && (
                      <p
                        role="alert"
                        className="text-sm text-destructive"
                        data-testid="branch-delete-error"
                      >
                        {submitError}
                      </p>
                    )}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDialogOpenChange(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={!canConfirm || isPending}
                      >
                        {isPending
                          ? 'Eliminando...'
                          : 'Eliminar definitivamente'}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
