'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/routes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  deleteProduct,
  type DeleteProductState,
} from '@/app/(panel)/productos/actions';

const initialState: DeleteProductState = null;

interface ProductActionsProps {
  productId: number;
  productName: string;
}

export function ProductActions({ productId, productName }: ProductActionsProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    deleteProduct,
    initialState
  );
  const hasSubmittedRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const [dismissed, setDismissed] = useState<DeleteProductState>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const isDialogOpen = !!state?.error && state !== dismissed;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (hasSubmittedRef.current && !isPending && state === null) {
      hasSubmittedRef.current = false;
      router.refresh();
    }
  }, [isPending, state, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowConfirm(true);
  }

  function handleConfirmDelete() {
    setShowConfirm(false);
    const form = formRef.current;
    if (form) {
      startDeleteTransition(() => {
        hasSubmittedRef.current = true;
        formAction(new FormData(form));
      });
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={routes.productosEditar(productId)}>
        <Button variant="ghost" size="sm" className="w-full sm:w-auto">
          Editar
        </Button>
      </Link>
      <form ref={formRef} action={formAction} className="inline" onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={productId} />
        <Button
          ref={deleteButtonRef}
          type="submit"
          variant="ghost"
          size="sm"
          disabled={isPending || isDeletePending}
          className="w-full sm:w-auto text-destructive hover:text-destructive"
        >
          {isPending || isDeletePending ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </form>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDismissed(state);
          }
        }}
        onOpenChangeComplete={(open) => {
          if (!open) {
            deleteButtonRef.current?.focus();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No se puede eliminar</DialogTitle>
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

      <ConfirmDialog
        open={showConfirm}
        title="Eliminar producto"
        description={`¿Eliminar ${productName}?`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
