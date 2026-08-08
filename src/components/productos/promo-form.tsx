'use client';

import { useEffect, useState } from 'react';
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
  SelectValue,
} from '@/components/ui/select';
import { ProductHelpCard } from './product-help-card';
import { PRODUCTOS_API, RECETAS_API } from '@/config/api';

interface Supply {
  id: number;
  name: string;
  type: string;
  criticalSupplyType: string | null;
  unit: string;
}

interface RecipeItem {
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: Supply;
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
  price: number;
  superPanchos: number;
  includesBeverage: boolean;
  beverageProductId: number;
  beverageQuantity: number;
  isActive: boolean;
}

interface PromoFormProps {
  product?: PromoProduct;
}

const emptyForm: PromoFormData = {
  name: '',
  price: 0,
  superPanchos: 1,
  includesBeverage: false,
  beverageProductId: 0,
  beverageQuantity: 1,
  isActive: true,
};

export function PromoForm({ product }: PromoFormProps) {
  const router = useRouter();
  const [panSupply, setPanSupply] = useState<Supply | null>(null);
  const [sausageSupply, setSausageSupply] = useState<Supply | null>(null);
  const [beverages, setBeverages] = useState<Supply[]>([]);
  const [form, setForm] = useState<PromoFormData>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(PRODUCTOS_API, { credentials: 'include' });
        if (!res.ok) throw new Error('Error al cargar productos');

        const all = (await res.json()) as Supply[];
        const pan =
          all.find(
            (p) =>
              p.type === 'critical_supply' && p.criticalSupplyType === 'bread'
          ) ?? null;
        const sausage =
          all.find(
            (p) =>
              p.type === 'critical_supply' && p.criticalSupplyType === 'sausage'
          ) ?? null;
        const bevs = all.filter(
          (p) =>
            p.type === 'critical_supply' && p.criticalSupplyType === 'beverage'
        );

        setPanSupply(pan);
        setSausageSupply(sausage);
        setBeverages(bevs);

        const base: PromoFormData = {
          ...emptyForm,
          beverageProductId: bevs[0]?.id ?? 0,
        };

        if (product) {
          base.name = product.name;
          base.price = product.price;
          base.isActive = product.isActive;

          const recipeRes = await fetch(
            `${RECETAS_API}?productId=${product.id}`,
            { credentials: 'include' }
          );

          if (recipeRes.ok) {
            const recipe = (await recipeRes.json()) as RecipeItem[];
            const panItem = recipe.find(
              (r) => r.supply?.criticalSupplyType === 'bread'
            );
            const sausageItem = recipe.find(
              (r) => r.supply?.criticalSupplyType === 'sausage'
            );
            const bevItem = recipe.find(
              (r) => r.supply?.criticalSupplyType === 'beverage'
            );

            let superPanchos = 1;
            if (panItem) {
              superPanchos = panItem.quantity;
            } else if (sausageItem) {
              superPanchos = Math.max(1, Math.floor(sausageItem.quantity / 2));
            }

            base.superPanchos = superPanchos;
            base.includesBeverage = !!bevItem;
            base.beverageProductId =
              bevItem?.supplyId ?? bevs[0]?.id ?? 0;
            base.beverageQuantity = bevItem?.quantity ?? 1;
          }
        }

        setForm(base);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [product]);

  function toggleBeverage(includes: boolean) {
    setForm((prev) => ({
      ...prev,
      includesBeverage: includes,
      beverageProductId:
        prev.beverageProductId || beverages[0]?.id || 0,
    }));
  }

  async function handleSubmit() {
    setError(null);

    if (!panSupply || !sausageSupply) {
      setError(
        'No se encontraron Pan y Salchichas como insumos criticos. Crea esos productos primero.'
      );
      return;
    }

    if (!form.name.trim()) {
      setError('El nombre de la promo es obligatorio.');
      return;
    }

    if (form.price < 0) {
      setError('El precio no puede ser negativo.');
      return;
    }

    if (form.superPanchos < 1) {
      setError('La cantidad de Super Panchos debe ser al menos 1.');
      return;
    }

    if (form.includesBeverage) {
      if (!form.beverageProductId) {
        setError('Selecciona una bebida.');
        return;
      }
      if (form.beverageQuantity < 1) {
        setError('La cantidad de bebida debe ser al menos 1.');
        return;
      }
      const selectedBev = beverages.find((b) => b.id === form.beverageProductId);
      if (!selectedBev) {
        setError('La bebida seleccionada no existe.');
        return;
      }
    }

    setIsSubmitting(true);

    const recipeItems = [
      {
        supplyId: panSupply.id,
        quantity: form.superPanchos,
        autoDiscount: true,
      },
      {
        supplyId: sausageSupply.id,
        quantity: form.superPanchos * 2,
        autoDiscount: true,
      },
    ];

    if (form.includesBeverage) {
      recipeItems.push({
        supplyId: form.beverageProductId,
        quantity: form.beverageQuantity,
        autoDiscount: true,
      });
    }

    try {
      let productId = product?.id;

      if (!productId) {
        const productRes = await fetch(PRODUCTOS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: form.name.trim(),
            type: 'compound',
            price: form.price,
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
        const productRes = await fetch(`${PRODUCTOS_API}/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: form.name.trim(),
            price: form.price,
            isActive: form.isActive,
          }),
        });

        if (!productRes.ok) {
          const data = await productRes.json();
          throw new Error(data.error || 'Error al actualizar la promo');
        }
      }

      const recipeRes = await fetch(RECETAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          compoundProductId: productId,
          items: recipeItems,
        }),
      });

      if (!recipeRes.ok) {
        const data = await recipeRes.json();
        throw new Error(
          data.error || 'Error al guardar la receta de la promo'
        );
      }

      router.push('/productos');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
    <div className="max-w-2xl space-y-5">
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
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          placeholder="Ej: Promo 1"
          required
        />
        <p className="text-sm text-muted-foreground">
          Nombre visible en la terminal de ventas y cierres.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="promo-price">Precio</Label>
          <Input
            id="promo-price"
            type="number"
            step="0.01"
            min={0}
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: Number(e.target.value) })
            }
            required
          />
          <p className="text-sm text-muted-foreground">
            Precio fijo de la promo. No depende de los insumos.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="promo-super-panchos">
            Cantidad de Super Panchos
          </Label>
          <Input
            id="promo-super-panchos"
            type="number"
            min={1}
            value={form.superPanchos}
            onChange={(e) =>
              setForm({ ...form, superPanchos: Number(e.target.value) })
            }
            required
          />
          <p className="text-sm text-muted-foreground">
            1 Super Pancho equivale a 1 Pan y 2 Salchichas.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-card p-4">
          <input
            id="promo-includes-beverage"
            type="checkbox"
            checked={form.includesBeverage}
            onChange={(e) => toggleBeverage(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
          <Label htmlFor="promo-includes-beverage" className="mb-0">
            Incluye bebida
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Si la promo lleva bebida, se descontara del stock de la bebida
          seleccionada.
        </p>
      </div>

      {form.includesBeverage && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="promo-beverage">Bebida</Label>
            <Select
              value={
                form.beverageProductId ? form.beverageProductId.toString() : ''
              }
              onValueChange={(value) =>
                setForm({ ...form, beverageProductId: Number(value) })
              }
            >
              <SelectTrigger id="promo-beverage">
                <SelectValue placeholder="Seleccionar bebida" />
              </SelectTrigger>
              <SelectContent>
                {beverages.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.name} ({b.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Solo aparecen bebidas del catalogo con stock critico.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="promo-beverage-quantity">Cantidad de bebida</Label>
            <Input
              id="promo-beverage-quantity"
              type="number"
              min={1}
              value={form.beverageQuantity}
              onChange={(e) =>
                setForm({
                  ...form,
                  beverageQuantity: Number(e.target.value),
                })
              }
              required
            />
            <p className="text-sm text-muted-foreground">
              Botellas o unidades que incluye la promo.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de stock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Al vender una unidad de esta promo se descontara:
          </p>
          <ul className="mt-2 list-disc pl-5 text-base">
            <li>
              {form.superPanchos} {panSupply?.unit ?? 'pan'} de{' '}
              {panSupply?.name ?? 'Pan'}
            </li>
            <li>
              {form.superPanchos * 2}{' '}
              {sausageSupply?.unit ?? 'unidad'} de{' '}
              {sausageSupply?.name ?? 'Salchichas'}
            </li>
            {form.includesBeverage && (
              <li>
                {form.beverageQuantity}{' '}
                {beverages.find((b) => b.id === form.beverageProductId)
                  ?.unit ?? 'unidad'} de{' '}
                {beverages.find((b) => b.id === form.beverageProductId)
                  ?.name ?? 'la bebida seleccionada'}
              </li>
            )}
          </ul>
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
        Si esta inactiva no aparece en la terminal de ventas.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || loading}
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
          onClick={() => router.push('/productos')}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
