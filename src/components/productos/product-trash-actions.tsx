'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DeleteProductState } from '@/app/(panel)/productos/actions';

interface ProductTrashActionsProps {
  productId: number;
  productName: string;
  restoreProductAction: (
    _prevState: DeleteProductState,
    formData: FormData
  ) => Promise<DeleteProductState>;
  permanentlyDeleteProductAction: (
    _prevState: DeleteProductState,
    formData: FormData
  ) => Promise<DeleteProductState>;
}

export function ProductTrashActions({
  productId,
  productName,
  restoreProductAction,
  permanentlyDeleteProductAction,
}: ProductTrashActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleAction(
    action: (
      _prevState: DeleteProductState,
      formData: FormData
    ) => Promise<DeleteProductState>,
    formData: FormData
  ) {
    startTransition(async () => {
      const result = await action(null, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {error && (
        <p className="w-full text-right text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        id={`restore-form-${productId}`}
        action={(formData) => handleAction(restoreProductAction, formData)}
        className="inline"
      >
        <input type="hidden" name="id" value={productId} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          data-testid="restore-product-button"
          onClick={() => setShowRestoreConfirm(true)}
          className="w-full sm:w-auto"
        >
          {isPending ? 'Restaurando...' : 'Restaurar'}
        </Button>
      </form>

      <form
        id={`delete-form-${productId}`}
        action={(formData) => handleAction(permanentlyDeleteProductAction, formData)}
        className="inline"
      >
        <input type="hidden" name="id" value={productId} />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          data-testid="permanently-delete-product-button"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full sm:w-auto"
        >
          {isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
        </Button>
      </form>

      <ConfirmDialog
        open={showRestoreConfirm}
        title="Restaurar producto"
        description={`¿Restaurar ${productName}?`}
        confirmLabel="Restaurar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setShowRestoreConfirm(false);
          const form = document.getElementById(
            `restore-form-${productId}`
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        }}
        onCancel={() => setShowRestoreConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar producto permanentemente"
        description={`¿Eliminar permanentemente ${productName}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          const form = document.getElementById(
            `delete-form-${productId}`
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
