'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useEffect, useMemo, useState, FormEvent } from 'react';
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
import {
  calculateCompoundAvailability,
  type CompoundAvailabilityRecipe,
} from '@/lib/availability-helpers';
import { routes } from '@/config/routes';
import {
  productTypeBadgeClasses,
  productTypeDotClasses,
} from '@/lib/product-style';

import { Plus, Trash2 } from 'lucide-react';
import {
  getSupplyGroupKey,
  SupplySearchableSelect,
  type Supply,
  type SupplyGroupKey,
} from './supply-searchable-select';

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

  const supplyById = useMemo(
    () => new Map(supplies.map((s) => [s.id, s])),
    [supplies]
  );

  const selectedRecipeItems = useMemo(
    () => recipeItems.filter((item) => item.supplyId),
    [recipeItems]
  );

  const recipeForAvailability = useMemo<CompoundAvailabilityRecipe[]>(
    () =>
      selectedRecipeItems.map((item) => {
        const supply = supplyById.get(item.supplyId);
        return {
          supplyId: item.supplyId,
          quantity: item.quantity,
          autoDiscount: supply?.type === 'critical_supply',
          supply: supply ? { stock: supply.stock } : null,
        };
      }),
    [selectedRecipeItems, supplyById]
  );

  const promoAvailability = useMemo(
    () => calculateCompoundAvailability(recipeForAvailability),
    [recipeForAvailability]
  );

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

          {selectedRecipeItems.length > 0 && (
            <div className="mt-5 border-t border-white/8 pt-4">
              <h4 className="mb-3 text-sm font-medium">
                Stock de insumos seleccionados
              </h4>
              <ul className="space-y-2">
                {selectedRecipeItems.map((item, index) => {
                  const supply = supplyById.get(item.supplyId);
                  if (!supply) return null;

                  return (
                    <li
                      key={index}
                      data-testid="promo-stock-item"
                      data-supply-name={supply.name}
                      className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-sm"
                    >
                      <span>{supply.name}</span>
                      <span className="font-mono">
                        {supply.stock} {supply.unit} en stock · usa{' '}
                        {item.quantity} {supply.unit}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {recipeForAvailability.some((r) => r.autoDiscount) && (
                <p
                  className={cn(
                    'mt-3 text-sm',
                    promoAvailability > 0
                      ? 'text-muted-foreground'
                      : 'text-destructive'
                  )}
                >
                  {promoAvailability > 0 ? (
                    <>
                      Con el stock crítico actual se pueden armar aproximadamente{' '}
                      <span className="font-mono font-medium text-foreground">
                        {promoAvailability}
                      </span>{' '}
                      promos.
                    </>
                  ) : (
                    <>
                      No hay stock crítico suficiente para armar promos con la
                      configuración actual.
                    </>
                  )}
                </p>
              )}
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
