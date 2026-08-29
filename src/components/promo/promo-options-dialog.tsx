'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { RecipeItemConfig } from '@/domain/types';

export interface PromoOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productPrice: number;
  recipe: RecipeItemConfig[];
  initialSelectedIds?: number[];
  onConfirm: (selectedRecipeItemIds: number[]) => void;
}

export function PromoOptionsDialog({
  open,
  onOpenChange,
  productName,
  productPrice,
  recipe,
  initialSelectedIds,
  onConfirm,
}: PromoOptionsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialSelectedIds ??
      recipe
        .filter((item) => item.isOptional && item.selectedByDefault)
        .map((item) => item.supplyId)
  );

  const criticalItems = useMemo(
    () => recipe.filter((item) => !item.isOptional),
    [recipe]
  );
  const optionalItems = useMemo(
    () => recipe.filter((item) => item.isOptional),
    [recipe]
  );

  const handleToggle = (supplyId: number) => {
    setSelectedIds((prev) =>
      prev.includes(supplyId)
        ? prev.filter((id) => id !== supplyId)
        : [...prev, supplyId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="dialog" aria-modal="true" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>
            Total: ${productPrice.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {criticalItems.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Siempre incluye</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {criticalItems.map((item) => (
                  <li key={item.supplyId}>
                    {item.supplyName} ({item.quantity})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {optionalItems.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Quitá lo que no querás
              </h4>
              <ul className="space-y-2">
                {optionalItems.map((item) => (
                  <li key={item.supplyId} className="flex items-center gap-2">
                    <input
                      id={`promo-option-${item.supplyId}`}
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      checked={selectedIds.includes(item.supplyId)}
                      onChange={() => handleToggle(item.supplyId)}
                      aria-label={`Incluir ${item.supplyName} en ${productName}`}
                    />
                    <label
                      htmlFor={`promo-option-${item.supplyId}`}
                      className="text-sm"
                    >
                      {item.supplyName} ({item.quantity})
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Agregar al pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
