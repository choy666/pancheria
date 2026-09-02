'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
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

function renderSection(
  productName: string,
  title: string,
  items: RecipeItemConfig[],
  selectedIds: number[],
  onToggle: (supplyId: number) => void,
  allowToggle: boolean
) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">
        {items.map((item) => {
          const checked = selectedIds.includes(item.supplyId);
          const inputId = `promo-option-${item.supplyId}`;

          return (
            <li key={item.supplyId} className="flex items-center gap-2">
              {allowToggle ? (
                <>
                  <input
                    id={inputId}
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    checked={checked}
                    onChange={() => onToggle(item.supplyId)}
                    aria-label={`Incluir ${item.supplyName} en ${productName}`}
                  />
                  <label
                    htmlFor={inputId}
                    className="text-sm"
                  >
                    {item.isOptional ? item.supplyName : `${item.supplyName} (${item.quantity})`}
                  </label>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {item.isOptional ? item.supplyName : `${item.supplyName} (${item.quantity})`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
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

  const alwaysIncludeItems = useMemo(
    () => recipe.filter((item) => !item.isOptional),
    [recipe]
  );

  const optionalManualItems = useMemo(
    () =>
      recipe.filter(
        (item) => item.isOptional && item.supplyType === 'manual_supply'
      ),
    [recipe]
  );

  const optionalServiceItems = useMemo(
    () =>
      recipe.filter(
        (item) => item.isOptional && item.supplyType === 'service'
      ),
    [recipe]
  );

  const selectedItems = useMemo(
    () =>
      recipe.filter(
        (item) => !item.isOptional || selectedIds.includes(item.supplyId)
      ),
    [recipe, selectedIds]
  );

  const selectedSummary = useMemo(() => {
    return selectedItems.map((item) => item.supplyName).join(', ');
  }, [selectedItems]);

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
            Total: {formatMoney(productPrice)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {renderSection(
            productName,
            'Siempre incluye',
            alwaysIncludeItems,
            selectedIds,
            handleToggle,
            false
          )}

          {renderSection(
            productName,
            'Insumos opcionales',
            optionalManualItems,
            selectedIds,
            handleToggle,
            true
          )}

          {renderSection(
            productName,
            'Servicios / extras',
            optionalServiceItems,
            selectedIds,
            handleToggle,
            true
          )}

          {selectedSummary && (
            <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Incluye: </span>
              {selectedSummary}
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
