'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
          fetch('/api/productos'),
          fetch(`/api/recetas?productId=${productId}`),
        ]);

        if (!productsRes.ok) throw new Error('Error al cargar productos');

        const products = (await productsRes.json()) as Supply[];
        setSupplies(products.filter((p) => p.id !== productId));

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
      const response = await fetch('/api/recetas', {
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

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="max-w-3xl space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => {
          const supply = supplies.find((s) => s.id === item.supplyId);

          return (
            <div
              key={index}
              className="flex flex-wrap items-end gap-2 rounded-md border p-3"
            >
              <div className="min-w-[200px] flex-1 space-y-2">
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
                        {s.name} ({s.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-28 space-y-2">
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

              <div className="flex items-center gap-2 pb-2">
                <input
                  id={`auto-${index}`}
                  type="checkbox"
                  checked={item.autoDiscount}
                  disabled={supply?.type !== 'critical_supply'}
                  onChange={(e) =>
                    updateItem(index, { autoDiscount: e.target.checked })
                  }
                  className="h-4 w-4"
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
              >
                Quitar
              </Button>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" onClick={addItem}>
        Agregar insumo
      </Button>

      {items.some((item) => item.autoDiscount) && (
        <Badge variant="default" className="ml-2">
          Receta válida
        </Badge>
      )}

      <div className="flex gap-2">
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
