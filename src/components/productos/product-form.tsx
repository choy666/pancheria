'use client';

import { ApiError, authenticatedFetch, throwApiError } from '@/lib/fetch';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyAmountInput } from '@/components/pagos/money-amount-input';
import { parseMoneyAmount } from '@/lib/payment-helpers';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { ProductHelpCard } from './product-help-card';
import { ProductImageUploader } from './product-image-uploader';
import {
  imageToPersist,
  persistProductImageUpload,
  storedProductImage,
  toProductImagePayload,
  type ProductImageValue,
} from '@/lib/product-image-upload-client';
import { isPublicSellableProduct } from '@/lib/catalog';
import { PRODUCTOS_API } from '@/config/api';
import { routes } from '@/config/routes';
import { productTypeLabels, criticalTypeLabels } from '@/lib/product-style';
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

async function saveProductRequest(
  url: string,
  method: 'POST' | 'PUT',
  body: string
): Promise<Response> {
  const response = await authenticatedFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' }, body,
  });

  if (!response.ok) {
    // Se clona la response para poder leer el body acá y delegar
    // después a throwApiError sin consumirlo dos veces.
    const data = (await response
      .clone()
      .json()
      .catch(() => null)) as {
      code?: string;
      details?: { path: (string | number)[]; message: string }[];
    } | null;
    const detail = data?.details
      ?.map((issue) =>
        issue.path.length
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue.message
      )
      .join('. ');
    // Doble ruta: con details (errores Zod) se muestra el detalle en
    // el formulario; sin details delega en throwApiError, que además
    // expulsa la sesión si el body trae code BRANCH_REMOVED.
    if (detail) {
      throw new ApiError(detail, response.status, data?.code);
    }
    await throwApiError(response, 'Error al guardar el producto');
  }

  return response;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>(() =>
    product
      ? {
          ...product,
          price: product.type === 'manual_supply' ? 0 : product.price,
          // La imagen vive en `image`: el formulario principal no la reenvía.
          imageUrl: undefined,
          imageKey: undefined,
          imageMimeType: undefined,
          imageSize: undefined,
        }
      : emptyProduct
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unitTouched, setUnitTouched] = useState(() => !!product);
  const [image, setImage] = useState<ProductImageValue>(() =>
    storedProductImage(product)
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const isCritical = form.type === 'critical_supply';
  const isManual = form.type === 'manual_supply';
  const isService = form.type === 'service';
  const imageVisible = isPublicSellableProduct(form) || image.source === 'stored';
  const imageBlocked = imageVisible && (imageError !== null || imageProcessing);

  function updateType(value: ProductType) {
    const nextCriticalSupplyType =
      value === 'critical_supply' ? form.criticalSupplyType : null;
    const isStockless = value === 'service' || value === 'compound';
    setForm({
      ...form,
      type: value,
      criticalSupplyType: nextCriticalSupplyType,
      stock: isStockless ? 0 : form.stock,
      minStock: isStockless ? 0 : form.minStock,
      unit: unitTouched ? form.unit : defaultUnit(value, nextCriticalSupplyType),
      price: value === 'manual_supply' ? 0 : form.price,
    });
  }

  function updateCriticalSupplyType(value: CriticalSupplyType) {
    const next = (value || null) as CriticalSupplyType;
    setForm({
      ...form,
      criticalSupplyType: next,
      unit: unitTouched ? form.unit : defaultUnit(form.type, next),
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (imageBlocked) return;
    setIsSubmitting(true);
    setError(null);

    const imageChange = imageToPersist(image, imageVisible);
    // Si el alta creó el producto y un paso posterior falló, el reintento
    // actualiza ese mismo producto en vez de crear un duplicado.
    let productId = product?.id ?? createdId;

    try {
      const body = JSON.stringify({
        ...form,
        ...(imageChange ? toProductImagePayload(imageChange) : {}),
      });
      const url =
        productId === null ? PRODUCTOS_API : `${PRODUCTOS_API}/${productId}`;
      const response = await saveProductRequest(
        url,
        productId === null ? 'POST' : 'PUT',
        body
      );

      if (productId === null) {
        const created = (await response.json()) as { id: number };
        productId = created.id;
        setCreatedId(created.id);
      }

      if (imageChange?.source === 'upload') {
        await persistProductImageUpload(productId, imageChange.file);
      }

      router.push(routes.productos);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setError(
        !product && productId !== null
          ? `${message} El producto ya quedó guardado: volvé a guardar para completar el paso que falló.`
          : message
      );
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
          Lo ve el cliente en el catálogo, además de la terminal de ventas y
          cierres. Ej: &quot;Súper Pancho&quot;, &quot;Cerveza chica 475
          ml&quot;.
        </p>
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
        <p className="text-sm text-muted-foreground">
          La ve el cliente bajo el nombre en el catálogo (ej: &quot;Súper
          Pancho con hasta 4 aderezos a elección&quot;). Opcional.
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
              <span className="flex-1 text-left">
                {productTypeLabels[form.type]}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical_supply">
                {productTypeLabels.critical_supply}
              </SelectItem>
              <SelectItem value="manual_supply">
                {productTypeLabels.manual_supply}
              </SelectItem>
              <SelectItem value="service">
                {productTypeLabels.service}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Define si se vende, si descontará stock y cómo se comporta. Los
            tipos vendibles al público (servicio, bebida crítica) muestran
            además el campo Imagen.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="criticalSupplyType">Tipo de insumo crítico</Label>
          <Select
            value={form.criticalSupplyType ?? ''}
            onValueChange={(value) =>
              updateCriticalSupplyType((value || null) as CriticalSupplyType)
            }
            disabled={!isCritical}
          >
            <SelectTrigger id="criticalSupplyType">
              <span className="flex-1 text-left">
                {form.criticalSupplyType
                  ? criticalTypeLabels[form.criticalSupplyType]
                  : 'Seleccionar'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bread">
                {criticalTypeLabels.bread}
              </SelectItem>
              <SelectItem value="sausage">
                {criticalTypeLabels.sausage}
              </SelectItem>
              <SelectItem value="beverage">
                {criticalTypeLabels.beverage}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Solo aplica a insumos críticos. Pan y Salchicha son la base de las
            promos; Bebida se vende sola o en promos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {!isManual && (
          <div className="space-y-2">
            <Label htmlFor="price">Precio</Label>
            <MoneyAmountInput
              id="price"
              amount={form.price}
              decimals={2}
              onRawChange={(raw) => {
                const parsed = parseMoneyAmount(raw, 2);
                if (parsed !== null) {
                  setForm({ ...form, price: parsed });
                }
              }}
              ariaLabel="Precio de venta"
              className="bg-background font-mono text-base font-semibold"
            />
            <p className="text-sm text-muted-foreground">
              Precio de venta. Para insumos crudos suele ser 0.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="unit">Unidad</Label>
          <Input
            id="unit"
            value={form.unit}
            onChange={(e) => {
              setUnitTouched(true);
              setForm({ ...form, unit: e.target.value });
            }}
            required
          />
          <p className="text-sm text-muted-foreground">
            Ej: unidad, porción, envase, litro, kg, botella.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="minStock">Stock mínimo</Label>
          <Input
            id="minStock"
            type="number"
            min={0}
            value={isService || form.type === 'compound' ? 0 : form.minStock}
            onChange={(e) =>
              setForm({ ...form, minStock: Number(e.target.value) })
            }
            disabled={isService || form.type === 'compound'}
            required
          />
          <p className="text-sm text-muted-foreground">
            Umbral de alerta de stock bajo. No aplica a servicios ni promos.
          </p>
        </div>
      </div>

      {imageVisible && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imagen ilustrativa</CardTitle>
            <CardDescription>
              La ve el cliente en el catálogo y en la pantalla del local. Se
              publica en 16:9 sobre fondo blanco: sirve cualquier formato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductImageUploader
              value={image}
              onChange={setImage}
              error={imageError}
              onErrorChange={setImageError}
              onProcessingChange={setImageProcessing}
              productName={form.name}
              productPrice={form.price}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-card p-4">
        <input
          id="isActive"
          data-testid="product-is-active"
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
        Si está inactivo no aparece en la terminal ni en listados, pero no se
        borra.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={isSubmitting || imageBlocked} className="w-full sm:w-auto">
          {isSubmitting ? 'Guardando...' : 'Guardar'}
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
