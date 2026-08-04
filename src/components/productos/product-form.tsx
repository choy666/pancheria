'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { productSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

type ProductFormData = z.infer<typeof productSchema>;

const emptyProduct: ProductFormData = {
  name: '',
  description: '',
  type: 'manual_supply',
  criticalSupplyType: null,
  price: 0,
  unit: '',
  stock: 0,
  minStock: 0,
  isActive: true,
};

interface ProductFormProps {
  product?: ProductFormData & { id: number };
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>(
    product ? { ...product } : emptyProduct
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCritical = form.type === 'critical_supply';

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = product
        ? `/api/productos/${product.id}`
        : '/api/productos';
      const method = product ? 'PUT' : 'POST';

      const body = JSON.stringify(form);
      console.log('SENDING PRODUCT', body);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar el producto');
      }

      router.push('/productos');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={form.description ?? ''}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value || null })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(value) =>
              setForm({
                ...form,
                type: value as ProductFormData['type'],
                criticalSupplyType: null,
              })
            }
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical_supply">Insumo crítico</SelectItem>
              <SelectItem value="compound">Compuesto</SelectItem>
              <SelectItem value="manual_supply">Insumo manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="criticalSupplyType">Tipo de insumo crítico</Label>
          <Select
            value={form.criticalSupplyType ?? ''}
            onValueChange={(value) =>
              setForm({
                ...form,
                criticalSupplyType: (value || null) as ProductFormData['criticalSupplyType'],
              })
            }
            disabled={!isCritical}
          >
            <SelectTrigger id="criticalSupplyType">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bread">Pan</SelectItem>
              <SelectItem value="sausage">Salchicha</SelectItem>
              <SelectItem value="beverage">Bebida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Precio</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min={0}
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: Number(e.target.value) })
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Unidad</Label>
          <Input
            id="unit"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock inicial</Label>
          <Input
            id="stock"
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) =>
              setForm({ ...form, stock: Number(e.target.value) })
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minStock">Stock mínimo</Label>
          <Input
            id="minStock"
            type="number"
            min={0}
            value={form.minStock}
            onChange={(e) =>
              setForm({ ...form, minStock: Number(e.target.value) })
            }
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="isActive">Activo</Label>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/productos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
