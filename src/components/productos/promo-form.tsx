'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductHelpCard } from './product-help-card';
import {
  ProductImageUploader,
  ProductImageValue,
} from './product-image-uploader';
import { uploadProductImage } from '@/lib/product-image-upload-client';
import { PRODUCTOS_API, RECETAS_API } from '@/config/api';
import { routes } from '@/config/routes';
import {
  criticalTypeLabels,
  productTypeLabels,
  productTypeBadgeClasses,
  productTypeDotClasses,
} from '@/lib/product-style';
import type { CriticalSupplyType, ProductType } from '@/domain/types';
import { Check, ChevronDown, Plus, Search, Trash2 } from 'lucide-react';

interface Supply {
  id: number;
  name: string;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  unit: string;
}

interface RecipeItem {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  isOptional: boolean;
  selectedByDefault: boolean;
  supply?: Supply;
}

interface PromoProduct {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  type: string;
  imageUrl?: string | null;
  imageKey?: string | null;
  imageMimeType?: string | null;
  imageSize?: number | null;
}

interface PromoFormData {
  name: string;
  price: string;
  isActive: boolean;
}

interface PromoRecipeItem {
  supplyId: number;
  quantity: number;
  isOptional: boolean;
  selectedByDefault: boolean;
}

interface PromoFormProps {
  product?: PromoProduct;
}

type SupplyGroupKey = CriticalSupplyType | 'manual_supply' | 'service' | 'compound';

const emptyForm: PromoFormData = {
  name: '',
  price: '',
  isActive: true,
};

const emptyRecipeItem: PromoRecipeItem = {
  supplyId: 0,
  quantity: 1,
  isOptional: true,
  selectedByDefault: true,
};

const groupPriorityDefault: Record<SupplyGroupKey, number> = {
  bread: 1,
  sausage: 2,
  beverage: 3,
  manual_supply: 4,
  service: 5,
  compound: 6,
};

function getSupplyGroupKey(supply: Supply): SupplyGroupKey {
  if (supply.type === 'critical_supply' && supply.criticalSupplyType) {
    return supply.criticalSupplyType;
  }
  if (
    supply.type === 'manual_supply' ||
    supply.type === 'service' ||
    supply.type === 'compound'
  ) {
    return supply.type;
  }
  return 'manual_supply';
}

function getGroupLabel(key: SupplyGroupKey): string {
  if (['bread', 'sausage', 'beverage'].includes(key)) {
    return `Insumos críticos — ${criticalTypeLabels[key as CriticalSupplyType]}`;
  }
  return productTypeLabels[key as ProductType];
}

function formatSupplyLabel(supply: Supply) {
  if (supply.type === 'critical_supply' && supply.criticalSupplyType) {
    return `${supply.name} (${supply.unit}) — ${criticalTypeLabels[supply.criticalSupplyType]}`;
  }
  return `${supply.name} (${supply.unit}) — ${productTypeLabels[supply.type]}`;
}

function getPreferredGroupKey(
  items: PromoRecipeItem[],
  supplies: Supply[]
): SupplyGroupKey | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const supply = supplies.find((s) => s.id === items[i].supplyId);
    if (supply) return getSupplyGroupKey(supply);
  }
  return undefined;
}

interface SupplySearchableSelectProps {
  id?: string;
  'data-testid'?: string;
  supplies: Supply[];
  value: number;
  onChange: (value: number) => void;
  preferredGroupKey?: SupplyGroupKey;
}

function SupplySearchableSelect({
  id,
  'data-testid': testId,
  supplies,
  value,
  onChange,
  preferredGroupKey,
}: SupplySearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSupply = useMemo(
    () => supplies.find((s) => s.id === value),
    [supplies, value]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const groupedOptions = useMemo(() => {
    const filtered = supplies.filter((s) => {
      const haystack = [
        s.name,
        productTypeLabels[s.type],
        s.criticalSupplyType ? criticalTypeLabels[s.criticalSupplyType] : '',
        s.unit,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const groups = new Map<SupplyGroupKey, Supply[]>();
    for (const s of filtered) {
      const key = getSupplyGroupKey(s);
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      const priorityA = (groupPriorityDefault[a] ?? 99) + (a === preferredGroupKey ? -100 : 0);
      const priorityB = (groupPriorityDefault[b] ?? 99) + (b === preferredGroupKey ? -100 : 0);
      return priorityA - priorityB || a.localeCompare(b);
    });

    return sortedKeys.map((key) => ({
      key,
      label: getGroupLabel(key),
      items:
        groups
          .get(key)
          ?.sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    }));
  }, [supplies, normalizedQuery, preferredGroupKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open]);

  function handleSelect(supply: Supply) {
    onChange(supply.id);
    setOpen(false);
    setQuery('');
  }

  function handleToggle() {
    const nextOpen = !open;
    if (nextOpen) setQuery('');
    setOpen(nextOpen);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        data-testid={testId}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full min-h-11 items-center justify-between gap-1.5 rounded-lg border border-input bg-input/50 px-3 py-2 text-base transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          !selectedSupply && 'text-muted-foreground'
        )}
      >
        <span className="flex-1 truncate text-left">
          {selectedSupply ? formatSupplyLabel(selectedSupply) : 'Seleccionar insumo'}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-white/10"
          role="listbox"
        >
          <div className="sticky top-0 mb-1 p-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, tipo o unidad"
                autoFocus
                className="min-h-11 w-full rounded-lg border border-input bg-input/50 px-3 py-2 pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:min-h-9 md:px-2.5 md:pl-9 md:pr-2.5 md:text-sm"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {groupedOptions.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No se encontraron insumos.
              </div>
            ) : (
              groupedOptions.map((group) => (
                <div key={group.key} role="group" aria-label={group.label}>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((supply) => {
                    const isSelected = supply.id === value;
                    return (
                      <button
                        key={supply.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(supply)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/80 hover:text-accent-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-2 w-2 shrink-0 rounded-full',
                            productTypeDotClasses[supply.type]
                          )}
                        />
                        <span className="flex-1 truncate">
                          {formatSupplyLabel(supply)}
                        </span>
                        {isSelected && <Check className="size-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PromoForm({ product }: PromoFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<PromoFormData>({ ...emptyForm });
  const [recipeItems, setRecipeItems] = useState<PromoRecipeItem[]>([
    { ...emptyRecipeItem },
  ]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [image, setImage] = useState<ProductImageValue>({ source: 'none' });

  useEffect(() => {
    async function load() {
      try {
        const productsRes = await authenticatedFetch(PRODUCTOS_API, {});

        if (!productsRes.ok) {
          throw new Error('Error al cargar productos');
        }

        const all = (await productsRes.json()) as Supply[];
        setSupplies(all);

        const base: PromoFormData = product
          ? {
              name: product.name,
              price: String(product.price),
              isActive: product.isActive,
            }
          : { ...emptyForm };

        if (product) {
          const recipeRes = await authenticatedFetch(
            `${RECETAS_API}?productId=${product.id}`,
            {}
          );

          if (recipeRes.ok) {
            const recipe = (await recipeRes.json()) as RecipeItem[];
            const mapped = recipe.map((r) => ({
              supplyId: r.supplyId,
              quantity: r.quantity,
              isOptional: r.isOptional,
              selectedByDefault: r.selectedByDefault,
            }));

            setRecipeItems(
              mapped.length > 0 ? mapped : [{ ...emptyRecipeItem }]
            );
          } else if (recipeRes.status === 404) {
            setRecipeItems([{ ...emptyRecipeItem }]);
          } else {
            throw new Error('Error al cargar la receta');
          }
        } else {
          setRecipeItems([{ ...emptyRecipeItem }]);
        }

        if (product?.imageUrl) {
          setImage({
            source: 'stored',
            imageUrl: product.imageUrl,
            imageKey: product.imageKey ?? null,
            imageMimeType: product.imageMimeType ?? null,
            imageSize: product.imageSize ?? null,
          });
        } else {
          setImage({ source: 'none' });
        }

        setForm(base);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [product]);

  function addRecipeItem() {
    setRecipeItems((prev) => [...prev, { ...emptyRecipeItem }]);
  }

  function removeRecipeItem(index: number) {
    setRecipeItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRecipeItem(index: number, updates: Partial<PromoRecipeItem>) {
    setRecipeItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const merged = { ...current, ...updates };

      if (updates.supplyId !== undefined) {
        const supply = supplies.find((s) => s.id === merged.supplyId);
        if (supply) {
          const isCritical = supply.type === 'critical_supply';
          merged.isOptional = isCritical ? false : true;
          merged.selectedByDefault = isCritical ? false : true;
        }
      }

      next[index] = merged;
      return next;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('El nombre de la promo es obligatorio.');
      return;
    }

    if (Number(form.price) < 0) {
      setError('El precio no puede ser negativo.');
      return;
    }

    if (supplies.length === 0) {
      setError(
        'No hay productos activos. Creá al menos uno primero.'
      );
      return;
    }

    if (recipeItems.length === 0) {
      setError('La promo debe tener al menos un insumo.');
      return;
    }

    if (recipeItems.some((item) => !item.supplyId)) {
      setError('Todos los ítems deben tener un insumo seleccionado.');
      return;
    }

    if (
      recipeItems.some(
        (item) => !Number.isInteger(item.quantity) || item.quantity < 1
      )
    ) {
      setError('Las cantidades deben ser enteros mayores o iguales a 1.');
      return;
    }

    const uniqueIds = new Set(recipeItems.map((item) => item.supplyId));
    if (uniqueIds.size !== recipeItems.length) {
      setError('No puede haber insumos duplicados.');
      return;
    }

    const invalidSupply = recipeItems.some(
      (item) => !supplies.some((s) => s.id === item.supplyId)
    );
    if (invalidSupply) {
      setError('Uno o más insumos seleccionados no están disponibles.');
      return;
    }

    const hasCriticalAutoDiscount = recipeItems.some((item) => {
      const supply = supplies.find((s) => s.id === item.supplyId);
      return supply?.type === 'critical_supply';
    });
    if (!hasCriticalAutoDiscount) {
      setError('La promo debe incluir al menos un insumo crítico con descuento automático.');
      return;
    }

    setIsSubmitting(true);

    async function updateProductImage(productId: number) {
      if (image.source === 'none') {
        return authenticatedFetch(`${PRODUCTOS_API}/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: null,
            imageKey: null,
            imageMimeType: null,
            imageSize: null,
          }),
        });
      }

      if (image.source === 'url') {
        return authenticatedFetch(`${PRODUCTOS_API}/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: image.imageUrl,
            imageKey: null,
            imageMimeType: null,
            imageSize: null,
          }),
        });
      }

      if (image.source === 'upload' && image.file) {
        const saved = await uploadProductImage(image.file, productId);
        return authenticatedFetch(`${PRODUCTOS_API}/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: saved.imageUrl,
            imageKey: saved.imageKey,
            imageMimeType: saved.imageMimeType,
            imageSize: saved.imageSize,
          }),
        });
      }

      if (image.source === 'stored') {
        // No hay cambios; conservar la imagen actual.
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 204 });
    }

    try {
      const formData = new FormData(e.currentTarget);
      const price =
        Number(formData.get('promo-price')) || Number(form.price) || 0;

      let productId = product?.id;

      if (!productId) {
        const productRes = await authenticatedFetch(PRODUCTOS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            name: form.name.trim(),
            type: 'compound',
            price,
            unit: 'unidad',
            stock: 0,
            minStock: 0,
            isActive: form.isActive,
          }),
        });

        if (!productRes.ok) {
          const data = await productRes.json();
          throw new Error(data.error || 'Error al crear la promo');
        }

        const created = (await productRes.json()) as { id: number };
        productId = created.id;
      } else {
        const productRes = await authenticatedFetch(`${PRODUCTOS_API}/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            name: form.name.trim(),
            price,
            isActive: form.isActive,
          }),
        });

        if (!productRes.ok) {
          const data = await productRes.json();
          throw new Error(data.error || 'Error al actualizar la promo');
        }
      }

      const imageRes = await updateProductImage(productId);

      if (!imageRes.ok) {
        const data = await imageRes.json();
        throw new Error(data?.error || 'Error al guardar la imagen de la promo');
      }

      const recipeRes = await authenticatedFetch(RECETAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          compoundProductId: productId,
          items: recipeItems.map((item) => {
            const supply = supplies.find((s) => s.id === item.supplyId);
            const isCritical = supply?.type === 'critical_supply';
            return {
              supplyId: item.supplyId,
              quantity: item.quantity,
              autoDiscount: isCritical,
              isOptional: item.isOptional,
              selectedByDefault: item.selectedByDefault,
              supplyType: supply?.type,
            };
          }),
        }),
      });

      if (!recipeRes.ok) {
        const data = await recipeRes.json();
        throw new Error(data.error || 'Error al guardar la receta de la promo');
      }

      router.push(routes.productos);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-5">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const preferredGroupKey = getPreferredGroupKey(recipeItems, supplies);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <ProductHelpCard variant="promo" />

      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="promo-name">Nombre de la promo</Label>
        <Input
          id="promo-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ej: Promo 1"
          required
        />
        <p className="text-sm text-muted-foreground">
          Nombre visible en la terminal de ventas y cierres.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promo-price">Precio</Label>
        <input
          id="promo-price"
          name="promo-price"
          type="text"
          inputMode="decimal"
          pattern="^[0-9]*\.?[0-9]*$"
          className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-input/50 px-3 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:min-h-9 md:px-2.5 md:text-sm"
          value={form.price}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              price: e.target.value,
            }))
          }
          required
        />
        <p className="text-sm text-muted-foreground">
          Precio fijo de la promo. No depende de los insumos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imagen ilustrativa</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImageUploader
            value={image}
            onChange={setImage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insumos de la promo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            {recipeItems.map((item, index) => {
              const selectedSupply = supplies.find(
                (s) => s.id === item.supplyId
              );
              const isCritical = selectedSupply?.type === 'critical_supply';

              return (
                <div
                  key={index}
                  data-testid="recipe-item"
                  data-supply-name={selectedSupply ? selectedSupply.name : ''}
                  className="space-y-3 rounded-2xl border border-white/8 bg-card p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Label htmlFor={`promo-recipe-${index}`}>Insumo</Label>
                      <SupplySearchableSelect
                        id={`promo-recipe-${index}`}
                        data-testid={`recipe-supply-select-${index}`}
                        supplies={supplies}
                        value={item.supplyId}
                        onChange={(value) =>
                          updateRecipeItem(index, {
                            supplyId: value,
                          })
                        }
                        preferredGroupKey={preferredGroupKey}
                      />
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-28">
                      <Label htmlFor={`promo-recipe-quantity-${index}`}>
                        Cantidad
                      </Label>
                      <Input
                        id={`promo-recipe-quantity-${index}`}
                        data-testid={`recipe-quantity-input-${index}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateRecipeItem(index, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="flex w-full justify-end sm:w-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        data-testid="remove-recipe-item"
                        onClick={() => removeRecipeItem(index)}
                      >
                        <Trash2 className="mr-1.5 size-4" />
                        Quitar
                      </Button>
                    </div>
                  </div>

                  {!isCritical && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/8 pt-3">
                      <Label
                        htmlFor={`promo-recipe-optional-${index}`}
                        className="cursor-pointer gap-2 text-sm font-normal"
                      >
                        <input
                          id={`promo-recipe-optional-${index}`}
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={item.isOptional}
                          onChange={(e) =>
                            updateRecipeItem(index, {
                              isOptional: e.target.checked,
                            })
                          }
                        />
                        Opcional
                      </Label>

                      <Label
                        htmlFor={`promo-recipe-default-${index}`}
                        className="cursor-pointer gap-2 text-sm font-normal"
                      >
                        <input
                          id={`promo-recipe-default-${index}`}
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={item.selectedByDefault}
                          onChange={(e) =>
                            updateRecipeItem(index, {
                              selectedByDefault: e.target.checked,
                            })
                          }
                        />
                        Preseleccionado
                      </Label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button
            id="promo-add-recipe-item"
            type="button"
            variant="outline"
            onClick={addRecipeItem}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 size-4" />
            Agregar insumo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Al vender una unidad de esta promo se descontará:
          </p>
          {recipeItems.some((item) => item.supplyId) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipeItems.map((item, index) => {
                const supply = supplies.find(
                  (s) => s.id === item.supplyId
                );
                if (!supply) return null;

                return (
                  <Badge
                    key={index}
                    variant="outline"
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 text-sm',
                      productTypeBadgeClasses[supply.type]
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-2 w-2 rounded-full',
                        productTypeDotClasses[supply.type]
                      )}
                    />
                    <span className="font-medium">
                      {item.quantity} {supply.unit}
                    </span>
                    <span className="opacity-80">de {supply.name}</span>
                    {item.isOptional && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-background/50 px-1.5 py-0.5 text-xs text-foreground">
                        Opcional
                      </span>
                    )}
                    {item.isOptional && item.selectedByDefault && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-background/50 px-1.5 py-0.5 text-xs text-foreground">
                        Preseleccionado
                      </span>
                    )}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-white/8 bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Todavía no hay insumos seleccionados.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agregá al menos un insumo crítico para que el descuento de stock sea automático.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-card p-4">
        <input
          id="promo-is-active"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-5 w-5 accent-primary"
        />
        <Label htmlFor="promo-is-active" className="mb-0">
          Activa
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Si está inactiva no aparece en la terminal de ventas.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          data-testid="promo-submit"
          disabled={isSubmitting || loading}
          className="w-full sm:w-auto"
        >
          {isSubmitting
            ? 'Guardando...'
            : product
            ? 'Actualizar promo'
            : 'Guardar promo'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(routes.productos)}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
