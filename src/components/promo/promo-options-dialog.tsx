'use client';

import { useId, useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ProductCardImage } from '@/components/productos/product-card-image';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { ITEM_NOTE_MAX_LENGTH } from '@/lib/cart-helpers';
import type { RecipeItemConfig } from '@/domain/types';

export interface PromoOptionsConfirmPayload {
  selectedRecipeItemIds: number[];
  /**
   * Unidades a agregar. Cada unidad de un producto personalizable ocupa su
   * propia línea del carrito (`lineId` propio) para editarla por separado.
   * En `mode="edit"` siempre es 1: la línea editada representa una unidad.
   */
  quantity: number;
  /**
   * Aclaración libre de la línea (ej. "bien tostado"). `null` cuando el
   * usuario deja el campo vacío.
   */
  notes: string | null;
}

export interface PromoOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productPrice: number;
  recipe: RecipeItemConfig[];
  /** Imagen del producto para el hero (solo `variant="public"`). */
  imageUrl?: string | null;
  /** Descripción corta del producto, bajo el nombre. */
  description?: string | null;
  initialSelectedIds?: number[];
  /** Aclaración precargada al editar una línea existente. */
  initialNotes?: string | null;
  onConfirm: (payload: PromoOptionsConfirmPayload) => void;
  mode?: 'add' | 'edit';
  confirmLabel?: string;
  /**
   * Tope del stepper de cantidad (unidades adicionales que pueden agregarse).
   * Si no se informa, el stepper se acota a 99; el tope real siempre lo impone
   * `useSellableCart` al confirmar.
   */
  maxQuantity?: number;
  /**
   * Tope de insumos opcionales seleccionables por unidad (ej. 4 aderezos en
   * el pancho común). Al llegar al tope los toggles no seleccionados se
   * deshabilitan. `null`/`undefined` = sin límite.
   */
  maxOptionalSelections?: number | null;
  /**
   * `public`: el diálogo se renderiza desde el flujo `/pedido` (tema claro,
   * hero con la imagen del producto y hoja inferior en mobile).
   * Como el popup portalea fuera del scope `[data-theme='light']` de
   * `(public)`, se marca el `DialogContent` con el mismo atributo.
   * `sales` (default): terminal `/ventas`, tema oscuro global y diálogo
   * centrado sin hero.
   */
  variant?: 'public' | 'sales';
}

const DEFAULT_MAX_QUANTITY = 99;

interface OptionsSectionProps {
  productName: string;
  title: string;
  items: RecipeItemConfig[];
  selectedIds: number[];
  onToggle: (supplyId: number) => void;
  /** `true` cuando ya se alcanzó el tope de opcionales seleccionables. */
  limitReached?: boolean;
}

/**
 * Sección de insumos opcionales con toggles accesibles (`role="switch"`).
 * El control es un checkbox circular de ancho fijo: activo = círculo relleno
 * en el color primario con ✓; inactivo = círculo vacío con borde gris.
 */
function OptionsSection({
  productName,
  title,
  items,
  selectedIds,
  onToggle,
  limitReached = false,
}: OptionsSectionProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="mb-1 font-heading text-sm uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const checked = selectedIds.includes(item.supplyId);

          return (
            <li
              key={item.supplyId}
              className="flex items-center justify-between gap-3 py-1"
            >
              <span className="min-w-0 flex-1 text-base leading-snug">
                {item.supplyName}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={`Incluir ${item.supplyName} en ${productName}`}
                disabled={!checked && limitReached}
                onClick={() => onToggle(item.supplyId)}
                className="group inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span
                  aria-hidden="true"
                  data-state={checked ? 'checked' : 'unchecked'}
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full border-2 transition-colors',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/50 bg-transparent group-hover:border-primary/70'
                  )}
                >
                  {checked && (
                    <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PromoOptionsDialog({
  open,
  onOpenChange,
  productName,
  productPrice,
  recipe,
  imageUrl,
  description,
  initialSelectedIds,
  initialNotes,
  onConfirm,
  mode = 'add',
  confirmLabel,
  maxQuantity,
  maxOptionalSelections,
  variant = 'sales',
}: PromoOptionsDialogProps) {
  const isPublic = variant === 'public';
  const notesLabelId = useId();

  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialSelectedIds ??
      recipe
        .filter((item) => item.isOptional && item.selectedByDefault)
        .map((item) => item.supplyId)
  );
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState(initialNotes ?? '');

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

  // Cota superior de UI para el stepper (99 por defecto); el tope real de
  // stock siempre lo impone `useSellableCart` al confirmar.
  const effectiveMaxQuantity = Math.max(
    1,
    Math.min(maxQuantity ?? DEFAULT_MAX_QUANTITY, DEFAULT_MAX_QUANTITY)
  );

  // Tope de opcionales por unidad (ej. 4 aderezos en el pancho común).
  // `overLimit` solo puede darse con una selección inicial heredada de un
  // tope anterior más alto; en ese caso se permite quitar pero no confirmar.
  const maxOptional =
    maxOptionalSelections != null && maxOptionalSelections > 0
      ? maxOptionalSelections
      : null;
  const optionalCount =
    optionalManualItems.length + optionalServiceItems.length;
  const overOptionalLimit =
    maxOptional != null && selectedIds.length > maxOptional;
  const atOptionalLimit =
    maxOptional != null && selectedIds.length >= maxOptional;

  const handleToggle = (supplyId: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(supplyId)) {
        return prev.filter((id) => id !== supplyId);
      }
      if (maxOptional != null && prev.length >= maxOptional) {
        return prev;
      }
      return [...prev, supplyId];
    });
  };

  const handleConfirm = () => {
    onConfirm({
      selectedRecipeItemIds: selectedIds,
      quantity: mode === 'edit' ? 1 : quantity,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  const confirmText =
    mode === 'edit'
      ? (confirmLabel ?? 'Guardar cambios')
      : `${confirmLabel ?? 'Agregar'} · ${formatMoney(productPrice * quantity)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        data-theme={isPublic ? 'light' : undefined}
        // El hero y el CTA van borde a borde: el contenido general pierde el
        // padding del diálogo base y scrollea solo el tramo central.
        showCloseButton={!isPublic}
        className={cn(
          'flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md',
          isPublic &&
            'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:data-open:slide-in-from-bottom-8 max-sm:data-closed:slide-out-to-bottom-8'
        )}
      >
        {isPublic && (
          <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-linear-to-br from-brand-red to-brand-mustard">
            <ProductCardImage
              imageUrl={imageUrl}
              productName={productName}
            />
            <DialogClose
              aria-label="Cerrar"
              className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-5" />
            </DialogClose>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <DialogHeader
            className={cn('gap-1', isPublic ? 'pt-4' : 'pt-5 pr-12')}
          >
            <div className="flex items-baseline justify-between gap-3">
              <DialogTitle className="font-heading text-2xl leading-tight">
                {productName}
              </DialogTitle>
              <span className="shrink-0 font-heading text-2xl leading-tight text-primary">
                {formatMoney(productPrice)}
              </span>
            </div>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {maxOptional != null && optionalCount > 0 && (
              <p
                data-testid="promo-options-limit"
                role={overOptionalLimit ? 'alert' : undefined}
                className={cn(
                  'text-sm',
                  overOptionalLimit
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {overOptionalLimit
                  ? `Elegiste ${selectedIds.length} opcionales; el máximo es ${maxOptional}. Quitá alguno para continuar.`
                  : `Podés elegir hasta ${maxOptional} opcionales (llevas ${selectedIds.length}).`}
              </p>
            )}
            <OptionsSection
              productName={productName}
              title="A tu gusto"
              items={optionalManualItems}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              limitReached={atOptionalLimit}
            />
            <OptionsSection
              productName={productName}
              title="Sumale"
              items={optionalServiceItems}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              limitReached={atOptionalLimit}
            />
            <section>
              <h3
                id={notesLabelId}
                className="mb-1 font-heading text-sm uppercase tracking-wide text-muted-foreground"
              >
                Aclaraciones
              </h3>
              <Textarea
                aria-labelledby={notesLabelId}
                placeholder="Ej: bien tostado"
                maxLength={ITEM_NOTE_MAX_LENGTH}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-20 resize-none"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {notes.length}/{ITEM_NOTE_MAX_LENGTH}
              </p>
            </section>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-border bg-popover px-4 py-3">
          {mode !== 'edit' && (
            <div
              role="group"
              aria-label="Cantidad"
              className="flex items-center gap-1"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid="promo-quantity-decrease"
                aria-label="Disminuir cantidad"
                disabled={quantity <= 1}
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className="rounded-full"
              >
                <Minus />
              </Button>
              <span
                data-testid="promo-quantity-value"
                aria-live="polite"
                className="min-w-9 text-center font-heading text-lg"
              >
                {quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid="promo-quantity-increase"
                aria-label="Aumentar cantidad"
                disabled={quantity >= effectiveMaxQuantity}
                onClick={() =>
                  setQuantity((prev) =>
                    Math.min(effectiveMaxQuantity, prev + 1)
                  )
                }
                className="rounded-full"
              >
                <Plus />
              </Button>
            </div>
          )}
          <Button
            type="button"
            data-testid="promo-options-confirm"
            disabled={overOptionalLimit}
            onClick={handleConfirm}
            className={cn(
              'min-h-12 flex-1 text-base font-semibold',
              isPublic &&
                'rounded-full bg-brand-red text-white hover:bg-brand-red/90'
            )}
          >
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
