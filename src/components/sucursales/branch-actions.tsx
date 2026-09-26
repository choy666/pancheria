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

// El tipo se infiere de la action para que el contrato con el servidor no
// se duplique ni quede desactualizado.
type DeletionSummary = Awaited<
  ReturnType<typeof getBranchDeletionSummaryAction>
>;

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
      // en la próxima apertura del diálogo, y resetea la confirmación:
      // reabrir no debe dejar "Eliminar definitivamente" ya habilitado.
      setDismissed(state);
      setConfirmName('');
    }
  }

  const canConfirm = !!summary && confirmName.trim() === branchName;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Editar
      </Button>

      <Button
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

              {summary &&
                (summary.flags.isDefaultBranch ||
                  summary.flags.isSelfBranch ||
                  summary.flags.isLastBranch ||
                  summary.flags.hasOpenCashRegister ||
                  summary.flags.activeOrders > 0) && (
                <ul
                  className="space-y-2"
                  data-testid="branch-delete-warnings"
                >
                  {summary.flags.isLastBranch && (
                    <li
                      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
                      data-testid="branch-delete-warning-last"
                    >
                      Es la última sucursal registrada: al eliminarla el
                      sistema queda sin ninguna sucursal.
                    </li>
                  )}
                  {summary.flags.isSelfBranch && (
                    <li
                      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
                      data-testid="branch-delete-warning-self"
                    >
                      Tu cuenta pertenece a esta sucursal: eliminarla borra tu
                      usuario y perdés acceso al panel.
                    </li>
                  )}
                  {summary.flags.isDefaultBranch && (
                    <li
                      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
                      data-testid="branch-delete-warning-default"
                    >
                      Es la sucursal por defecto del catálogo público:{' '}
                      <code>/pedido</code> deja de resolver su URL canónica
                      hasta configurar <code>DEFAULT_BRANCH_NAME</code> con
                      otro nombre.
                    </li>
                  )}
                  {summary.flags.hasOpenCashRegister && (
                    <li
                      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
                      data-testid="branch-delete-warning-open-register"
                    >
                      Tiene una caja abierta: se eliminan las ventas y el
                      arqueo en curso.
                    </li>
                  )}
                  {summary.flags.activeOrders > 0 && (
                    <li
                      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive"
                      data-testid="branch-delete-warning-active-orders"
                    >
                      Tiene {summary.flags.activeOrders}{' '}
                      {summary.flags.activeOrders === 1
                        ? 'pedido en curso'
                        : 'pedidos en curso'}{' '}
                      (pendiente{summary.flags.activeOrders === 1 ? '' : 's'} o
                      en preparación) que{' '}
                      {summary.flags.activeOrders === 1
                        ? 'se elimina'
                        : 'se eliminan'}{' '}
                      con la sucursal.
                    </li>
                  )}
                </ul>
              )}

              {summary ? (
                <ul className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                  <li>
                    <strong>Total de registros afectados:</strong>{' '}
                    {summary.counts.total}
                  </li>
                  {summary.counts.cascaded > 0 && (
                    <li className="text-xs">
                      Incluye {summary.counts.cascaded} registros asociados
                      en cascada (ítems y pagos de ventas; ítems, recetas,
                      mensajes y reservas de pedidos).
                    </li>
                  )}
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
