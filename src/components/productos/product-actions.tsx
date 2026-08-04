'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ProductActionsProps {
  productId: number;
  productName: string;
  isCompound: boolean;
  deleteProduct: (formData: FormData) => Promise<void>;
}

export function ProductActions({
  productId,
  productName,
  isCompound,
  deleteProduct,
}: ProductActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete(formData: FormData) {
    if (!confirm(`¿Eliminar ${productName}?`)) return;
    setIsDeleting(true);
    await deleteProduct(formData);
    setIsDeleting(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      {isCompound && (
        <Link href={`/recetas/${productId}/editar`}>
          <Button variant="outline" size="sm">
            Receta
          </Button>
        </Link>
      )}
      <form action={handleDelete} className="inline">
        <input type="hidden" name="id" value={productId} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={isDeleting}
          className="text-destructive"
        >
          {isDeleting ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </form>
      <Link href={`/productos/${productId}/editar`}>
        <Button variant="ghost" size="sm">
          Editar
        </Button>
      </Link>
    </div>
  );
}
