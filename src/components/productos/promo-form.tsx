'use client';

import { authenticatedFetch } from '@/lib/fetch';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { ProductHelpCard } from './product-help-card';
import { PRODUCTOS_API, RECETAS_API } from '@/config/api';
import { routes } from '@/config/routes';
import {
  criticalTypeLabels,
  productTypeLabels,
} from '@/lib/product-style';
import type { CriticalSupplyType } from '@/domain/types';

interface CriticalSupply {
  id: number;
  name: string;
  type: string;
  criticalSupplyType: CriticalSupplyType | null;
  unit: string;
}

interface RecipeItem {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: CriticalSupply;
}

interface PromoProduct {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  type: string;
}

interface PromoFormData {
  name: string;
  price: string;
  isActive: boolean;
}

interface PromoRecipeItem {
  supplyId: number;
  quantity: number;
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
};

function formatSupplyLabel(supply: CriticalSupply) {
  const typeLabel = supply.criticalSupplyType
    ? criticalTypeLabels[supply.criticalSupplyType]
    : productTypeLabels.critical_supply;
  return `${supply.name} (${supply.unit}) — ${typeLabel}`;
}

export function PromoForm({ product }: PromoFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<PromoFormData>({ ...emptyForm });
  const [recipeItems, setRecipeItems] = useState<PromoRecipeItem[]>([
    { ...emptyRecipeItem },
  ]);
  const [criticalSupplies, setCriticalSupplies] = useState<CriticalSupply[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const productsRes = await authenticatedFetch(PRODUCTOS_API, {});

        if (!productsRes.ok) {
          throw new Error('Error al cargar productos');
        }

        const all = (await productsRes.json()) as CriticalSupply[];
        const critical = all.filter((p) => p.type === 'critical_supply');
        setCriticalSupplies(critical);

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
      next[index] = { ...next[index], ...updates };
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

    if (criticalSupplies.length === 0) {
      setError(
        'No hay insumos críticos activos. Creá al menos uno primero.'
      );
      return;
    }

    if (recipeItems.length === 0) {
      setError('La promo debe tener al menos un insumo crítico.');
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
      setError('No puede haber insumos críticos duplicados.');
      return;
    }

    const invalidSupply = recipeItems.some(
      (item) => !criticalSupplies.some((s) => s.id === item.supplyId)
    );
    if (invalidSupply) {
      setError('Uno o más insumos seleccionados no están disponibles.');
      return;
    }

    setIsSubmitting(true);

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

      const recipeRes = await authenticatedFetch(RECETAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          compoundProductId: productId,
          items: recipeItems.map((item) => {
            const supply = criticalSupplies.find((s) => s.id === item.supplyId);
            return {
              supplyId: item.supplyId,
              quantity: item.quantity,
              autoDiscount: true,
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
          <CardTitle className="text-base">Insumos críticos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            {recipeItems.map((item, index) => {
              const selectedSupply = criticalSupplies.find(
                (s) => s.id === item.supplyId
              );

              return (
                <div
                  key={index}
                  data-testid="recipe-item"
                  data-supply-name={selectedSupply ? selectedSupply.name : ''}
                  className="grid grid-cols-1 gap-4 rounded-2xl border border-white/8 bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <Label htmlFor={`promo-recipe-${index}`}>Insumo</Label>
                    <Select
                      value={item.supplyId ? item.supplyId.toString() : ''}
                      onValueChange={(value) =>
                        updateRecipeItem(index, {
                          supplyId: Number(value),
                        })
                      }
                    >
                      <SelectTrigger
                        id={`promo-recipe-${index}`}
                        data-testid={`recipe-supply-select-${index}`}
                      >
                        <span className="flex-1 text-left">
                          {selectedSupply
                            ? formatSupplyLabel(selectedSupply)
                            : 'Seleccionar insumo'}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {criticalSupplies.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {formatSupplyLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
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

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                      data-testid="remove-recipe-item"
                      onClick={() => removeRecipeItem(index)}
                    >
                      Quitar
                    </Button>
                  </div>
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
            Agregar insumo crítico
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
            <ul className="mt-2 list-disc pl-5 text-base">
              {recipeItems.map((item, index) => {
                const supply = criticalSupplies.find(
                  (s) => s.id === item.supplyId
                );
                if (!supply) return null;

                return (
                  <li key={index}>
                    {item.quantity} {supply.unit} de {supply.name}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Seleccioná insumos para ver el resumen.
            </p>
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
