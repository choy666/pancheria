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
import { publicProductTypeLabels, typePriority } from '@/lib/product-style';
import type { MenuSettings } from '@/lib/menu-pages';
import type { MenuProductItem } from '@/application/services/menuService';
import type { PantallaConfigState } from '@/app/(panel)/pantalla-config/actions';
import type { ProductType } from '@/domain/types';

interface MenuSettingsFormProps {
  settings: MenuSettings;
  /** Productos vendibles al público de la sucursal (candidatos a ocultar). */
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

/**
 * Configuración del menú digital `/menu` de la sucursal: rotación entre
 * páginas (en segundos; se persiste en ms), presupuesto de filas por página,
 * la franja QR fija y la curaduría de productos ocultos en el tablero.
 * Los ocultos siguen vendiéndose por caja y por el pedido online — solo
 * salen de la grilla de la TV.
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

  function toggleProduct(id: number) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(items: MenuProductItem[], hide: boolean) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (hide) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  return (
    <form action={formAction} data-testid="menu-settings-form">
      <Card>
        <CardHeader>
          <CardTitle>Menú digital</CardTitle>
          <CardDescription>
            La carta completa en la TV (<code>/menu?branchId=…</code>): cuánto
            rota cada página, cuántas filas entran por pantalla y qué
            productos no se listan. Los cambios se aplican solos en la próxima
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

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              Productos ocultos en el tablero
            </legend>
            <p className="text-xs text-muted-foreground">
              Tildar un producto lo quita de la grilla del menú; sigue
              vendiéndose por caja y por el pedido online del QR. Útil para no
              saturar la TV con extras o productos que no conviene mostrar.
            </p>
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                La sucursal todavía no tiene productos vendibles al público.
              </p>
            )}
            {groups.map(([type, items]) => {
              const allHidden = items.every((item) => hiddenIds.has(item.id));
              return (
                <div
                  key={type}
                  className="rounded-xl border border-white/8 p-4"
                  data-testid={`menu-hidden-group-${type}`}
                >
                  <Label className="flex cursor-pointer items-center gap-3 font-normal">
                    <input
                      type="checkbox"
                      checked={allHidden}
                      onChange={(event) =>
                        toggleGroup(items, event.target.checked)
                      }
                      className="h-4 w-4 accent-primary"
                      data-testid={`menu-hide-group-${type}`}
                    />
                    <span className="font-medium">
                      {publicProductTypeLabels[type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {items.length === 0
                        ? ''
                        : `(${items.filter((i) => hiddenIds.has(i.id)).length} de ${items.length} ocultos)`}
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
                          name="hiddenProductIds"
                          value={item.id}
                          checked={hiddenIds.has(item.id)}
                          onChange={() => toggleProduct(item.id)}
                          className="h-4 w-4 shrink-0 accent-primary"
                          data-testid={`menu-hide-product-${item.id}`}
                        />
                        <span className="truncate">{item.name}</span>
                      </Label>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>

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
