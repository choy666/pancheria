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
import { ProductHelpCard } from './product-help-card';
import { PRODUCTOS_API } from '@/config/api';
import type { productSchema } from '@/lib/zod-schemas';
import type { z } from 'zod';

type ProductFormData = z.infer<typeof productSchema>;
type ProductType = ProductFormData['type'];
type CriticalSupplyType = ProductFormData['criticalSupplyType'];

function defaultUnit(
  type: ProductType,
  criticalSupplyType: CriticalSupplyType
): string {
  if (type === 'critical_supply' && criticalSupplyType === 'beverage') {
    return 'botella';
  }
  return 'unidad';
}

const emptyProduct: ProductFormData = {
  name: '',
  description: '',
  type: 'manual_supply',
  criticalSupplyType: null,
  price: 0,
  unit: 'unidad',
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
  const isService = form.type === 'service';

  function updateType(value: ProductType) {
    const nextCriticalSupplyType =
      value === 'critical_supply' ? form.criticalSupplyType : null;
    setForm({
      ...form,
      type: value,
      criticalSupplyType: nextCriticalSupplyType,
      stock: value === 'service' ? 0 : form.stock,
      unit: defaultUnit(value, nextCriticalSupplyType),
    });
  }

  function updateCriticalSupplyType(value: CriticalSupplyType) {
    const next = (value || null) as CriticalSupplyType;
    setForm({
      ...form,
      criticalSupplyType: next,
      unit: defaultUnit(form.type, next),
    });
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = product
        ? `${PRODUCTOS_API}/${product.id}`
        : PRODUCTOS_API;
      const method = product ? 'PUT' : 'POST';

      const body = JSON.stringify(form);
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
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <ProductHelpCard variant="product" />

      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
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
        <p className="text-sm text-muted-foreground">
          Nombre visible en listados, ventas y cierres.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripcion</Label>
        <Textarea
          id="description"
          value={form.description ?? ''}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value || null })
          }
        />
        <p className="text-sm text-muted-foreground">
          Notas internas opcionales.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select
            value={form.type}
            onValueChange={(value) => updateType(value as ProductType)}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical_supply">Insumo critico</SelectItem>
              <SelectItem value="manual_supply">Insumo manual</SelectItem>
              <SelectItem value="service">Servicio / extra</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Define si se vende, si descontara stock y como se comporta.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="criticalSupplyType">Tipo de insumo critico</Label>
          <Select
            value={form.criticalSupplyType ?? ''}
            onValueChange={(value) =>
              updateCriticalSupplyType((value || null) as CriticalSupplyType)
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
          <p className="text-sm text-muted-foreground">
            Solo aplica a insumos criticos. Pan y Salchicha son la base de las
            promos; Bebida se vende sola o en promos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
          <p className="text-sm text-muted-foreground">
            Precio de venta. Para insumos crudos suele ser 0.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock inicial</Label>
          <Input
            id="stock"
            type="number"
            min={0}
            value={isService ? 0 : form.stock}
            onChange={(e) =>
              setForm({ ...form, stock: Number(e.target.value) })
            }
            disabled={isService}
            required
          />
          <p className="text-sm text-muted-foreground">
            Cantidad disponible. No aplica a servicios.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-card p-4">
        <input
          id="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-5 w-5 accent-primary"
        />
        <Label htmlFor="isActive" className="mb-0">
          Activo
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Si esta inactivo no aparece en la terminal ni en listados, pero no se
        borra.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
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
