'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PRODUCTOS_API, RECETAS_API } from '@/config/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
}

interface RecipeEditorProps {
  productId: number;
}

export function RecipeEditor({ productId }: RecipeEditorProps) {
  const router = useRouter();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [productsRes, recipeRes] = await Promise.all([
          fetch(PRODUCTOS_API, { credentials: 'include' }),
          fetch(`${RECETAS_API}?productId=${productId}`, { credentials: 'include' }),
        ]);

        if (!productsRes.ok) throw new Error('Error al cargar productos');

        const products = (await productsRes.json()) as Supply[];
        setSupplies(
          products.filter(
            (p) =>
              p.id !== productId &&
              (p.type === 'critical_supply' || p.type === 'manual_supply')
          )
        );

        if (recipeRes.ok) {
          const recipe = (await recipeRes.json()) as {
            supplyId: number;
            quantity: number;
            autoDiscount: boolean;
          }[];
          setItems(
            recipe.map((r) => ({
              supplyId: r.supplyId,
              quantity: r.quantity,
              autoDiscount: r.autoDiscount,
            }))
          );
        } else if (recipeRes.status !== 404) {
          throw new Error('Error al cargar receta');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [productId]);

  function addItem() {
    setItems([...items, { supplyId: 0, quantity: 1, autoDiscount: false }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, updates: Partial<RecipeItem>) {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    setItems(next);
  }

  async function handleSubmit() {
    if (items.some((item) => item.supplyId === 0)) {
      setError('Todos los ítems deben tener un insumo seleccionado.');
      return;
    }

    if (!items.some((item) => item.autoDiscount)) {
      setError('La receta debe tener al menos un insumo crítico con descuento automático.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(RECETAS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          compoundProductId: productId,
          items,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar la receta');
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
      <div className="max-w-3xl space-y-5">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => {
          const supply = supplies.find((s) => s.id === item.supplyId);

          return (
            <div
              key={index}
              className="grid grid-cols-1 gap-4 rounded-2xl border border-white/8 bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="min-w-0 space-y-2 sm:col-span-2">
                <Label>Insumo</Label>
                <Select
                  value={item.supplyId.toString()}
                  onValueChange={(value) =>
                    updateItem(index, { supplyId: Number(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplies.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        <span className="flex items-center gap-2">
                          {s.name} ({s.unit})
                          {s.type === 'critical_supply' ? (
                            <Badge variant="default" className="text-xs">
                              {s.criticalSupplyType}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {s.type}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, { quantity: Number(e.target.value) })
                  }
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id={`auto-${index}`}
                  type="checkbox"
                  checked={item.autoDiscount}
                  disabled={supply?.type !== 'critical_supply'}
                  onChange={(e) =>
                    updateItem(index, { autoDiscount: e.target.checked })
                  }
                  className="h-5 w-5 accent-primary"
                />
                <Label htmlFor={`auto-${index}`} className="mb-0">
                  Descuento automático
                </Label>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
                className="justify-self-start"
              >
                Quitar
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={addItem}>
          Agregar insumo
        </Button>

        {items.some((item) => item.autoDiscount) && (
          <Badge variant="default" className="ml-0">
            Receta válida
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar receta'}
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
