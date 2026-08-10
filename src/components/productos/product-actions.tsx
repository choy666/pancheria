'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (hasSubmittedRef.current && !isPending && state === null) {
      hasSubmittedRef.current = false;
      router.refresh();
    }
  }, [isPending, state, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`¿Eliminar ${productName}?`)) {
      event.preventDefault();
      return;
    }

    hasSubmittedRef.current = true;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/productos/${productId}/editar`}>
        <Button variant="ghost" size="sm">
          Editar
        </Button>
      </Link>
      <form action={formAction} className="inline" onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={productId} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="text-destructive hover:text-destructive"
        >
          {isPending ? 'Eliminando...' : 'Eliminar'}
        </Button>
        {state?.error && (
          <p
            className="mt-1 max-w-xs text-right text-xs text-destructive"
            role="alert"
            aria-live="polite"
          >
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
