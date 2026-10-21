'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { publicProductTypeLabels, typePriority } from '@/lib/product-style';
import type { MenuSettings } from '@/lib/menu-pages';
import type { MenuProductItem } from '@/application/services/menuService';
import type { PantallaConfigState } from '@/app/(panel)/pantalla-config/actions';
import type {
  MenuCardStyle,
  MenuFontScale,
  MenuSortOrder,
  ProductType,
} from '@/domain/types';

interface MenuSettingsFormProps {
  settings: MenuSettings;
  /** Productos vendibles al público de la sucursal (candidatos de la curaduría). */
  products: MenuProductItem[];
  updateAction: (
    _prevState: PantallaConfigState,
    formData: FormData
  ) => Promise<PantallaConfigState>;
}

const initialState: PantallaConfigState = null;

function msToSeconds(ms: number): number {
  return Math.round(ms / 1000);
}

function toggleInSet(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function setGroupInSet(
  set: ReadonlySet<number>,
  ids: number[],
  add: boolean
): Set<number> {
  const next = new Set(set);
  for (const id of ids) {
    if (add) next.add(id);
    else next.delete(id);
  }
  return next;
}

type ChecklistVariant = 'hidden' | 'featured';

const CHECKLIST_TESTIDS: Record<
  ChecklistVariant,
  { group: string; toggle: string; item: string; counter: string }
> = {
  hidden: {
    group: 'menu-hidden-group',
    toggle: 'menu-hide-group',
    item: 'menu-hide-product',
    counter: 'ocultos',
  },
  featured: {
    group: 'menu-featured-group',
    toggle: 'menu-feature-group',
    item: 'menu-feature-product',
    counter: 'destacados',
  },
};

interface ProductChecklistProps {
  variant: ChecklistVariant;
  legend: string;
  description: string;
  /** Grupos ya ordenados por la prioridad pública de tipo. */
  groups: [ProductType, MenuProductItem[]][];
  selectedIds: ReadonlySet<number>;
  fieldName: 'hiddenProductIds' | 'featuredProductIds';
  onToggle: (id: number) => void;
  onToggleGroup: (items: MenuProductItem[], checked: boolean) => void;
}

/**
 * Checklist de productos agrupados por tipo con selección por grupo: el
 * patrón compartido de las dos curadurías del menú (ocultos y destacados).
 */
function ProductChecklist({
  variant,
  legend,
  description,
  groups,
  selectedIds,
  fieldName,
  onToggle,
  onToggleGroup,
}: ProductChecklistProps) {
  const testids = CHECKLIST_TESTIDS[variant];

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{description}</p>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          La sucursal todavía no tiene productos vendibles al público.
        </p>
      )}
      {groups.map(([type, items]) => {
        const allSelected = items.every((item) => selectedIds.has(item.id));
        return (
          <div
            key={type}
            className="rounded-xl border border-white/8 p-4"
            data-testid={`${testids.group}-${type}`}
          >
            <Label className="flex cursor-pointer items-center gap-3 font-normal">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) =>
                  onToggleGroup(items, event.target.checked)
                }
                className="h-4 w-4 accent-primary"
                data-testid={`${testids.toggle}-${type}`}
              />
              <span className="font-medium">
                {publicProductTypeLabels[type]}
              </span>
              <span className="text-xs text-muted-foreground">
                {items.length === 0
                  ? ''
                  : `(${items.filter((i) => selectedIds.has(i.id)).length} de ${items.length} ${testids.counter})`}
              </span>
            </Label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/8 px-3 py-2 text-sm font-normal"
                >
                  <input
                    type="checkbox"
                    name={fieldName}
                    value={item.id}
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                    data-testid={`${testids.item}-${item.id}`}
                  />
                  <span className="truncate">{item.name}</span>
                </Label>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

/**
 * Configuración del menú digital `/menu` de la sucursal: rotación entre
 * páginas (en segundos; se persiste en ms), presupuesto de filas por página,
 * columnas de la grilla, escala tipográfica, estilo de tarjeta, orden dentro
 * de cada categoría, la franja QR fija con su CTA, las descripciones y la
 * curaduría de productos ocultos y destacados del tablero. Los ocultos y
 * destacados siguen vendiéndose por caja y por el pedido online — solo
 * cambian lo que muestra la TV.
 */
export function MenuSettingsForm({
  settings,
  products,
  updateAction,
}: MenuSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateAction,
    initialState
  );
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(
    () => new Set(settings.hiddenProductIds)
  );
  const [featuredIds, setFeaturedIds] = useState<ReadonlySet<number>>(
    () => new Set(settings.featuredProductIds)
  );
  // Los Select de enums son controlados: emiten su valor al FormData por un
  // input hidden hermano (mismo patrón que la sucursal de `user-form`).
  const [gridColumns, setGridColumns] = useState(() =>
    String(settings.gridColumns)
  );
  const [fontScale, setFontScale] = useState<MenuFontScale>(settings.fontScale);
  const [cardStyle, setCardStyle] = useState<MenuCardStyle>(settings.cardStyle);
  const [sortOrder, setSortOrder] = useState<MenuSortOrder>(settings.sortOrder);

  const groups = useMemo(() => {
    const byType = new Map<ProductType, MenuProductItem[]>();
    for (const product of products) {
      const list = byType.get(product.type) ?? [];
      list.push(product);
      byType.set(product.type, list);
    }
    // Mismo orden público del tablero: promos → bebidas → extras.
    return [...byType.entries()].sort(
      (a, b) => typePriority[a[0]] - typePriority[b[0]]
    );
  }, [products]);

  return (
    <form action={formAction} data-testid="menu-settings-form">
      <Card>
        <CardHeader>
          <CardTitle>Menú digital</CardTitle>
          <CardDescription>
            La carta completa en la TV (<code>/menu?branchId=…</code>): cuánto
            rota cada página, cómo se ve la grilla y qué productos se
            destacan o no se listan. Los cambios se aplican solos en la próxima
            actualización de la TV, sin redeploy.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paginaSegundos">
                Duración de cada página (segundos)
              </Label>
              <Input
                id="paginaSegundos"
                name="paginaSegundos"
                type="number"
                min={1}
                max={600}
                step={1}
                required
                defaultValue={msToSeconds(settings.paginaMs)}
                data-testid="menu-pagina-segundos"
              />
              <p className="text-xs text-muted-foreground">
                Solo rota cuando el catálogo no entra en una sola pantalla.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filasPagina">Filas por página</Label>
              <Input
                id="filasPagina"
                name="filasPagina"
                type="number"
                min={1}
                max={12}
                step={1}
                required
                defaultValue={settings.filasPagina}
                data-testid="menu-filas-pagina"
              />
              <p className="text-xs text-muted-foreground">
                Cada cabezal de categoría y cada fila de tarjetas cuentan como
                una fila. Más filas = más productos por página pero más
                chicos.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gridColumns">Columnas en la TV</Label>
              <Select
                value={gridColumns}
                onValueChange={(value) => setGridColumns(value ?? '4')}
              >
                <SelectTrigger
                  id="gridColumns"
                  data-testid="menu-grid-columns"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 columnas</SelectItem>
                  <SelectItem value="4">4 columnas</SelectItem>
                  <SelectItem value="5">5 columnas</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="gridColumns" value={gridColumns} />
              <p className="text-xs text-muted-foreground">
                En pantallas angostas (celular) la grilla usa siempre 2
                columnas.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardStyle">Estilo de tarjeta</Label>
              <Select
                value={cardStyle}
                onValueChange={(value) =>
                  setCardStyle((value ?? 'image') as MenuCardStyle)
                }
              >
                <SelectTrigger id="cardStyle" data-testid="menu-card-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Con imagen arriba</SelectItem>
                  <SelectItem value="compact">
                    Compacta (imagen lateral)
                  </SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="cardStyle" value={cardStyle} />
              <p className="text-xs text-muted-foreground">
                La compacta entra mejor en productos con nombre largo o foto
                poco atractiva.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fontScale">Tamaño del texto</Label>
              <Select
                value={fontScale}
                onValueChange={(value) =>
                  setFontScale((value ?? 'normal') as MenuFontScale)
                }
              >
                <SelectTrigger id="fontScale" data-testid="menu-font-scale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Grande</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="fontScale" value={fontScale} />
              <p className="text-xs text-muted-foreground">
                Grande mejora la lectura a distancia; rinde mejor con pocas
                filas y columnas.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Orden dentro de cada categoría</Label>
              <Select
                value={sortOrder}
                onValueChange={(value) =>
                  setSortOrder((value ?? 'catalog') as MenuSortOrder)
                }
              >
                <SelectTrigger id="sortOrder" data-testid="menu-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalog">
                    Catálogo (alfabético)
                  </SelectItem>
                  <SelectItem value="price_asc">
                    Precio: de menor a mayor
                  </SelectItem>
                  <SelectItem value="price_desc">
                    Precio: de mayor a menor
                  </SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="sortOrder" value={sortOrder} />
              <p className="text-xs text-muted-foreground">
                Los destacados siempre van primero, en el mismo orden elegido.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qrStripText">Texto de la franja QR</Label>
            <Input
              id="qrStripText"
              name="qrStripText"
              type="text"
              required
              maxLength={60}
              defaultValue={settings.qrStripText}
              data-testid="menu-qr-strip-text"
            />
            <p className="text-xs text-muted-foreground">
              El llamado principal junto al código QR (hasta 60 caracteres).
            </p>
          </div>

          <Label
            htmlFor="showQrStrip"
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 p-4 font-normal"
          >
            <input
              id="showQrStrip"
              name="showQrStrip"
              type="checkbox"
              defaultChecked={settings.showQrStrip}
              className="h-5 w-5 accent-primary"
              data-testid="menu-show-qr"
            />
            <span>
              <span className="block font-medium">
                Franja QR de pedidos siempre visible
              </span>
              <span className="block text-sm text-muted-foreground">
                El código QR que lleva al pedido online queda fijo al pie del
                menú. Recomendado salvo que el QR ya esté en otra pantalla.
              </span>
            </span>
          </Label>

          <Label
            htmlFor="showDescriptions"
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 p-4 font-normal"
          >
            <input
              id="showDescriptions"
              name="showDescriptions"
              type="checkbox"
              defaultChecked={settings.showDescriptions}
              className="h-5 w-5 accent-primary"
              data-testid="menu-show-descriptions"
            />
            <span>
              <span className="block font-medium">
                Descripción del producto en la tarjeta
              </span>
              <span className="block text-sm text-muted-foreground">
                Muestra la descripción debajo del nombre — clave en las
                promos, donde explica qué incluye cada una.
              </span>
            </span>
          </Label>

          <ProductChecklist
            variant="featured"
            legend="Productos destacados"
            description="Tildar un producto lo encabeza dentro de su categoría y le pone la marca «Recomendado». Si un producto también está oculto, el ocultamiento gana y no se muestra."
            groups={groups}
            selectedIds={featuredIds}
            fieldName="featuredProductIds"
            onToggle={(id) =>
              setFeaturedIds((prev) => toggleInSet(prev, id))
            }
            onToggleGroup={(items, checked) =>
              setFeaturedIds((prev) =>
                setGroupInSet(
                  prev,
                  items.map((item) => item.id),
                  checked
                )
              )
            }
          />

          <ProductChecklist
            variant="hidden"
            legend="Productos ocultos en el tablero"
            description="Tildar un producto lo quita de la grilla del menú; sigue vendiéndose por caja y por el pedido online del QR. Útil para no saturar la TV con extras o productos que no conviene mostrar."
            groups={groups}
            selectedIds={hiddenIds}
            fieldName="hiddenProductIds"
            onToggle={(id) => setHiddenIds((prev) => toggleInSet(prev, id))}
            onToggleGroup={(items, checked) =>
              setHiddenIds((prev) =>
                setGroupInSet(
                  prev,
                  items.map((item) => item.id),
                  checked
                )
              )
            }
          />

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p
              className="text-sm text-green-600"
              role="status"
              data-testid="menu-settings-success"
            >
              {state.success}
            </p>
          )}
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="menu-settings-save"
            className="w-full sm:w-auto"
          >
            {isPending ? 'Guardando...' : 'Guardar configuración del menú'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
