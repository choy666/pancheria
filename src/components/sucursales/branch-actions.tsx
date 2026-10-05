'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
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
  getBranchDeactivationSummaryAction,
  getBranchDeletionSummaryAction,
  setBranchActiveAction,
  type BranchState,
} from '@/app/(panel)/sucursales/actions';
import { routes } from '@/config/routes';

const initialState: BranchState = null;

interface BranchActionsProps {
  branchId: number;
  branchName: string;
  branchIsActive: boolean;
}

// El tipo se infiere de la action para que el contrato con el servidor no
// se duplique ni quede desactualizado.
type DeletionSummary = Awaited<
  ReturnType<typeof getBranchDeletionSummaryAction>
>;
type DeactivationSummary = Awaited<
  ReturnType<typeof getBranchDeactivationSummaryAction>
>;

export function BranchActions({
  branchId,
  branchName,
  branchIsActive,
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

  const [toggleState, toggleFormAction, isTogglePending] = useActionState(
    setBranchActiveAction,
    initialState
  );
  const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);
  const [deactivationSummary, setDeactivationSummary] =
    useState<DeactivationSummary | null>(null);
  const [isLoadingDeactivation, startLoadingDeactivation] = useTransition();
  const toggleSubmittedRef = useRef(false);

  useEffect(() => {
    if (hasSubmittedRef.current && !isPending && state === null) {
      hasSubmittedRef.current = false;
      setIsDialogOpen(false);
      setSummary(null);
      setConfirmName('');
    }
  }, [isPending, state]);

  // El toggle no es destructivo: al terminar se cierra el diálogo y la
  // página se revalida sola (la action hace revalidatePath).
  useEffect(() => {
    if (toggleSubmittedRef.current && !isTogglePending && toggleState === null) {
      toggleSubmittedRef.current = false;
      setIsToggleDialogOpen(false);
      setDeactivationSummary(null);
    }
  }, [isTogglePending, toggleState]);

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

  function loadDeactivationSummary() {
    startLoadingDeactivation(async () => {
      // Activar es trivial (vuelve al canal público); solo al desactivar se
      // precargan los warnings. Si falla la consulta se muestra el diálogo
      // con error y opción de reintento, sin resumen fabricado.
      const result = branchIsActive
        ? await getBranchDeactivationSummaryAction(branchId).catch(() => null)
        : null;
      setDeactivationSummary(result);
      setIsToggleDialogOpen(true);
    });
  }

  function handleToggleDialogOpenChange(open: boolean) {
    setIsToggleDialogOpen(open);
    if (!open) {
      setDeactivationSummary(null);
    }
  }

  const canConfirm = !!summary && confirmName.trim() === branchName;
  // Desactivar exige el resumen cargado: desactivar a ciegas podría apagar
  // una sucursal con pedidos en curso sin que el admin lo sepa.
  const canConfirmToggle =
    !branchIsActive || deactivationSummary !== null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {/* La edición vive en ruta dedicada: Link>Button conserva el role
          "button" para los specs y el patrón de /productos. */}
      <Link href={routes.sucursalesEditar(branchId)}>
        <Button variant="ghost" size="sm">
          Editar
        </Button>
      </Link>

      <Button
        type="button"
        data-testid={`toggle-branch-${branchId}`}
        variant="ghost"
        size="sm"
        disabled={isLoadingDeactivation}
        onClick={loadDeactivationSummary}
      >
        {isLoadingDeactivation
          ? 'Cargando...'
          : branchIsActive
            ? 'Desactivar'
            : 'Activar'}
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

      <Dialog open={isToggleDialogOpen} onOpenChange={handleToggleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {branchIsActive ? 'Desactivar sucursal' : 'Activar sucursal'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            {branchIsActive ? (
              <>
                <p>
                  Vas a desactivar <strong>{branchName}</strong>. Deja de
                  aparecer en el canal público (<code>/pedido</code>) y no
                  recibe pedidos nuevos. <strong>Nada se borra</strong>: el
                  historial, la caja y el panel siguen disponibles, y podés
                  reactivarla cuando quieras.
                </p>
                {deactivationSummary === null ? (
                  <div className="space-y-3 rounded-lg border p-3">
                    <p role="alert" className="text-destructive">
                      No se pudo cargar el resumen de efectos. Sin el resumen
                      no se puede confirmar la desactivación.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={loadDeactivationSummary}
                        disabled={isLoadingDeactivation}
                      >
                        {isLoadingDeactivation ? 'Cargando...' : 'Reintentar'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleDialogOpenChange(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  (deactivationSummary.openCashRegisters > 0 ||
                    deactivationSummary.activeOrders > 0 ||
                    deactivationSummary.flags.isDefaultBranch ||
                    deactivationSummary.flags.isLastActiveBranch ||
                    deactivationSummary.flags.isSelfBranch) && (
                    <ul
                      className="space-y-2"
                      data-testid="branch-toggle-warnings"
                    >
                      {deactivationSummary.flags.isLastActiveBranch && (
                        <li
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400"
                          data-testid="branch-toggle-warning-last-active"
                        >
                          Es la última sucursal activa: al desactivarla el
                          canal público queda sin sucursal y{' '}
                          <code>/pedido</code> deja de funcionar hasta que
                          reactives una.
                        </li>
                      )}
                      {deactivationSummary.flags.isDefaultBranch && (
                        <li
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400"
                          data-testid="branch-toggle-warning-default"
                        >
                          Es la sucursal por defecto del catálogo público:{' '}
                          <code>/pedido</code> deja de resolver su URL
                          canónica hasta configurar{' '}
                          <code>DEFAULT_BRANCH_NAME</code> con otra sucursal
                          activa.
                        </li>
                      )}
                      {deactivationSummary.openCashRegisters > 0 && (
                        <li
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400"
                          data-testid="branch-toggle-warning-open-register"
                        >
                          Tiene una caja abierta: podés cerrarla después desde
                          el panel (la desactivación no la cierra).
                        </li>
                      )}
                      {deactivationSummary.activeOrders > 0 && (
                        <li
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400"
                          data-testid="branch-toggle-warning-active-orders"
                        >
                          Tiene {deactivationSummary.activeOrders}{' '}
                          {deactivationSummary.activeOrders === 1
                            ? 'pedido en curso'
                            : 'pedidos en curso'}{' '}
                          (pendiente
                          {deactivationSummary.activeOrders === 1 ? '' : 's'} o
                          en preparación): siguen gestionándose desde el panel
                          y el cliente conserva seguimiento, cancelación y
                          chat.
                        </li>
                      )}
                    </ul>
                  )
                )}
              </>
            ) : (
              <p>
                Vas a activar <strong>{branchName}</strong>: vuelve a aparecer
                en el selector público de <code>/pedido</code> y puede recibir
                pedidos nuevos (según sus horarios y caja).
              </p>
            )}

            {deactivationSummary !== null || !branchIsActive ? (
              <form
                action={toggleFormAction}
                onSubmit={() => {
                  toggleSubmittedRef.current = true;
                }}
              >
                <input type="hidden" name="id" value={branchId} />
                <input
                  type="hidden"
                  name="isActive"
                  value={String(!branchIsActive)}
                />
                {toggleState?.error && (
                  <p
                    role="alert"
                    className="mb-3 text-sm text-destructive"
                    data-testid="branch-toggle-error"
                  >
                    {toggleState.error}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleToggleDialogOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant={branchIsActive ? 'destructive' : 'default'}
                    disabled={!canConfirmToggle || isTogglePending}
                  >
                    {isTogglePending
                      ? 'Aplicando...'
                      : branchIsActive
                        ? 'Desactivar'
                        : 'Activar'}
                  </Button>
                </DialogFooter>
              </form>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
