# Prompt: Quick-add en compuestos del terminal `/ventas` + migración de specs (Fase 2 restante de §8.2 de la auditoría)

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/checklist-pre-push.md`
- `.devin/informes/archivados/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` — **fuente de verdad**: §4 (quick-add, opciones evaluadas y recomendación A/D), §6 (garantías del POS), §7 (selectores bajo contrato y specs afectados).

Todo el trabajo, comentarios y documentación en español.

## Alcance

**Implementación acotada.** Solo la interacción de la card `variant="sales"`: quick-add con la selección por defecto + botón de personalización separado, y la migración mecánica de specs/tests que dependen del click en la card. No se toca tema visual, ni el diálogo, ni el agrupado del catálogo, ni ningún otro comportamiento del terminal.

> Si la Fase 1 (tema claro) ya está mergeada, esta fase no cambia: la estructura de botones es la misma bajo cualquier tema. Si se ejecutan en paralelo, evitar tocar las mismas líneas del `CardHeader`/`CardContent` salvo el pie de acciones nuevo.

## Estado actual verificado (punto de partida — no re-derivar)

Verificado contra `HEAD` `bbcb1b8` (post-refresco, commit `da0af67`):

- **Card sales:** `ProductCardBase` (`src/components/productos/product-card-base.tsx:249-320`) renderiza toda la card como `role="button"` con `onClick`/`onKeyDown`/`aria-disabled`/`aria-label` (250-264). Ya calcula `hasOptions` (98-100), `defaultSelectedIds` (108-110) y `openOptionsDialog` (112-115) para la variante `catalog`.
- **Catálogo de referencia:** la variante `catalog` (136-241) muestra el patrón destino: card presentacional + `Button` "Agregar" (`add-product-${id}`, 206-214) + botón circular `customize-product-${id}` (192-205) + `PromoOptionsDialog` interno con `variant="public"`.
- **Flujo del terminal:** `SalesTerminal.addToCart` (`sales-terminal.tsx:275-295`) abre `PromoOptionsDialog` siempre que `hasOptionalRecipeItems(product) && payload === undefined` (282-286). El diálogo vive en el terminal (estado `promoDialogProduct`/`promoDialogKey`, render 535-565) con `maxQuantity={getProductAdditional(...)}` y `confirmLabel="Agregar a la venta"`.
- **Quick-add ya soportado por el motor:** `useSellableCart.addItem(product)` sin selección aplica `getDefaultSelectedRecipeItemIds` + capea a `maxOptionalSelections` (`useSellableCart.ts:93-100`), crea línea propia por unidad personalizable — nunca fusiona (107-138) — y rechaza agotados vía `onOutOfStock` (145-148).
- **Wrapper:** `SalesProductCard` (`sales-product-card.tsx`) pasa `onAdd={() => onAdd(product)}` y calcula `isOutOfStock`/`maxAdditional` con `cartAvailability` (25-37).
- **Badges/datos que se conservan:** `product-card` + `data-product-name` + `data-out-of-stock` en el contenedor, badges tipo/+N opcionales/`N en venta` (271-292), `ProductCardPrice`, `ProductCardAvailability`, `ProductCardRecipeIncluded`, `ProductCardSalesExtra` "Podés sumar: N más"/"Sin stock" (296-318).
- **Specs E2E que clickean la card** (`[data-testid="product-card"][data-product-name]` + `.click()`):
  - `ventas-disponibilidad.spec.ts`: 44-45, 98-100, 245 (agregado directo de bebida/servicio/promo sin opcionales); **332 y 348** (única spec que abre el diálogo por la card — "dos variantes del mismo producto con personalizaciones distintas"); assertions `data-out-of-stock`/`aria-disabled`/`opacity-50` en 54-55, 69.
  - `ventas-stock-compartido.spec.ts`: loop 5× click en cardA (~89-92), click en cardB (~101).
  - `ventas-pago-mixto.spec.ts`: 50.
  - `ventas-historial.spec.ts`: 34, 87.
  - `paso3.spec.ts`: 56-57 (click → llena pago directo; la promo del seed agrega sin diálogo).
  - `flujo-diario.spec.ts`: 108-109 (2× click combo, espera `getByText('2')` en una línea — el combo se crea sin ítems opcionales, así que fusiona), 112.
  - `caja-cierre-vacios.spec.ts:13` y `caja-cierre-automatico.spec.ts:32` navegan a `/ventas` pero no clickean cards.
- **Unit tests:** `sales-terminal.test.tsx` hace `fireEvent.click(card)` sobre `closest('[data-slot="card"]')` en ~20 lugares (325-337, 366-369, 414-424, 504-535, 598-603, 696-698, 823-857, 908-909, 979-1012, 1041-1048, 1080-1081, 1118-1119, 1323-1324); algunos luego interactúan con toggles/`promo-options-confirm` del diálogo (979-1012, 991-994).
- Specs que NO se tocan: `tour.spec.ts` (solo espera `data-tour`), `responsive`, `accessibility`, `ux-perfiles` (usan `product-card-${id}` del catálogo público), `pedido.spec.ts`.

## Decisiones ya tomadas (no re-debatir)

1. **Patrón catálogo dentro de la variante `sales`** (convergencia A/D de la auditoría): la card deja de ser `role="button"`; se renderizan dos controles reales — "Agregar" (quick-add) y un botón de personalización — porque anidar botones dentro de `role="button"` es ARIA inválido.
2. **El diálogo sigue siendo del terminal**, no interno de la card: `SalesTerminal` conserva `promoDialogProduct`/`promoDialogKey`, `maxQuantity` calculado con `cartAvailability` y `confirmLabel="Agregar a la venta"`. La card recibe un callback `onCustomize`.
3. **Testids nuevos por card, localizados por el contenedor**: `data-testid="add-sale-product"` y `data-testid="customize-sale-product"` (repetibles, se alcanzan vía `card.getByTestId(...)`, mismo patrón que `cart-item-remove`). El contenedor conserva `product-card`/`data-product-name`/`data-out-of-stock`.
4. **`aria-disabled` sale del contenedor**: sin `role` es ARIA inválido y la fase de accesibilidad lo audita con axe. El estado deshabilitado se expresa en los botones (`disabled`) + `data-out-of-stock` + `opacity-50` en la card; las assertions de specs se migran.
5. **La edición por línea no cambia**: `Editar` en `SalesCart` sigue abriendo el diálogo en `mode="edit"`.

## Objetivo

Que el caso común de mostrador ("promo con sus opcionales por defecto") pase de 2 clicks + diálogo a 1 click, manteniendo la personalización a 1 click desde la card (`customize-sale-product`) y toda la maquinaria de disponibilidad/idempotencia intacta.

## Reglas de negocio

1. "Agregar" agrega siempre una unidad con `selectedByDefault` (capeado a `maxOptionalSelections` por `useSellableCart`); productos sin opcionales fusionan línea como hoy, personalizables crean línea propia por unidad.
2. El botón de personalización solo aparece en compuestos con opcionales (`hasOptions` ya calculado en la card); abre el diálogo con defaults precargados (hoy: `initialSelectedIds` `undefined` → `selectedByDefault`).
3. Agotado (`isOutOfStock`) o caja cerrada (`cartDisabled` → `disabled`) deshabilitan ambos botones; la card muestra `opacity-50` y `data-out-of-stock="true"` como hoy.
4. Cero cambios en `data-testid`/`data-tour` existentes fuera de los listados; el diálogo mantiene `promo-options-confirm`, switches `role="switch"` y "Agregar a la venta".
5. `addToCart` con `payload === undefined` deja de abrir el diálogo: agrega directo (la guarda `hasOptionalRecipeItems && payload === undefined` se elimina). El único camino al diálogo en modo `add` es `customize-sale-product`.
6. La trampa de los `dark:`/tema no aplica acá: esta fase no toca estilos de tema.

## Implementación detallada

### `src/components/productos/product-card-base.tsx`

- En la variante `sales`: quitar `role="button"`, `tabIndex`, `onClick`, `onKeyDown`, `aria-disabled`, `aria-label` del `Card` (250-264) y la clase `cursor-pointer`/`active:scale` (la card ya no es el control). Mantener `transition`, `opacity-50` en disabled, `hover:border-primary/30` opcional como affordance visual de los botones internos (o quitarlo si queda raro sin click — decidir con captura).
- Agregar prop `onCustomize?: () => void` a `ProductCardBaseProps` (solo lo usa la variante `sales`).
- Pie de acciones nuevo dentro de `CardContent` (o `CardFooter`): fila `mt-auto` con:
  - `Button` "Agregar"/"Agregar otro" (label dinámico igual que catálogo: `buttonLabel` ya existe, 102-106) con `data-testid="add-sale-product"`, `disabled={isDisabled}`, `onClick={() => onAdd()}`. Estilo sobrio para POS (no necesariamente la pill roja de marca — decisión visual; si Fase 1 ya corrió, `bg-primary` queda rojo-marca bajo tema claro).
  - Si `hasOptions`: `Button` `variant="ghost"`/`"outline"` `size="icon"` con `SlidersHorizontal`, `data-testid="customize-sale-product"`, `aria-label={`Personalizar ${product.name}`}`, `disabled={isDisabled}`, `onClick={onCustomize}`.
- El badge `N en venta` (`product-card-cart-quantity-${id}`) y "Podés sumar"/"Sin stock" quedan donde están.
- Actualizar el comentario de cabecera del componente (64-80) con la nueva semántica de la variante `sales`.

### `src/components/ventas/sales-product-card.tsx` y `sales-terminal.tsx`

- `SalesProductCard`: nueva prop `onCustomize: (product: SellableProduct) => void` pasada solo cuando corresponde (`hasOptionalRecipeItems(product)`); la card muestra el botón solo si `hasOptions && onCustomize` está presente.
- `SalesTerminal`:
  - `addToCart(product, payload)`: eliminar el branch que abre el diálogo (282-286); con `payload === undefined` llama `addLine(product)` y listo.
  - Nueva `openCustomize(product)`: `setPromoDialogKey((p) => p + 1); setPromoDialogProduct(product);` — reusada como `onCustomize` de cada card.
  - Sin cambios en `confirmSale`, edición de línea, polling ni precheck.

### Migración de tests

- **Unitarios** `sales-terminal.test.tsx`: reemplazar `fireEvent.click(card)` por `fireEvent.click(within(card).getByTestId('add-sale-product'))` (o `screen.getByTestId` scoping al card por texto). Los casos que hoy abren el diálogo por click de card (personalización, 979-1012 y afines) pasan por `customize-sale-product`. Mantener las aserciones de `product-card-cart-quantity-*`, agotados y badge.
- **E2E** (mecánico, mismo patrón en todos): `card.click()` → `card.getByTestId('add-sale-product').click()`; los dos clicks que abren el diálogo (`ventas-disponibilidad` 332/348) → `customize-sale-product`.
  - `ventas-disponibilidad`: 44-45, 98-100, 245 → `add-sale-product`; 332, 348 → `customize-sale-product`; líneas 54-55: `aria-disabled` ya no existe — assert `add-sale-product` `toBeDisabled()` + `data-out-of-stock="true"`; línea 69 `opacity-50` sigue igual.
  - `ventas-stock-compartido`: clicks del loop y cardB → `add-sale-product`.
  - `ventas-pago-mixto`: 50 → `add-sale-product`.
  - `ventas-historial`: 34, 87 → `add-sale-product`.
  - `paso3`: 56-57 → `add-sale-product` (verificar que la promo del seed no tenga opcionales; si los tuviera, quick-add agrega igual — no abre diálogo).
  - `flujo-diario`: 108-109, 112 → `add-sale-product`.
- **No** renombrar ni tocar `product-card`, `data-product-name`, `data-out-of-stock`, `cart-item*`, `promo-options-*`, `data-tour`.

## Fuera de alcance (explícito)

- No cambios visuales de tema (Fase 1, prompt propio).
- No hero/imagen/pill PROMO en la card (fase de pulido).
- No cambios en `PromoOptionsDialog` (props, layout, variantes).
- No tocar el contador "N en venta", `ProductCardSalesExtra`, ni el resumen de receta.
- No cambios de servidor/endpoints/esquema.
- No agrupado del catálogo ni estado vacío (Fase 1).

## Consideraciones de seguridad y entorno

- Sin endpoints ni env vars nuevas; `authenticatedFetch` sin cambios.
- E2E solo con `.env.e2e` en base descartable (el `global-setup` trunca tablas).
- Riesgo central: la suite E2E comparte la base entre specs — la migración no introduce inserciones nuevas, solo cambia cómo se interactúa con la card; mantener las limpiezas `finally` existentes.

## Criterios de aceptación

- [ ] 1 click en "Agregar" de una promo con opcionales crea una línea con la selección por defecto (sin abrir diálogo).
- [ ] 1 click en "Personalizar" abre el diálogo con los defaults marcados; "Agregar a la venta" agrega con la selección editada.
- [ ] Productos sin opcionales se comportan igual que antes (merge de línea, contador `N en venta`).
- [ ] Agotado/caja cerrada deshabilitan ambos botones; "Sin stock"/"Podés sumar: N más" intactos.
- [ ] Editar una línea desde el carrito sigue abriendo el diálogo en modo edición.
- [ ] `npm run test:e2e` verde sin modificar selectores fuera de la migración prevista.
- [ ] axe sin violación de "botón dentro de botón" ni `aria-disabled` huérfano.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Tipos (prop nueva en `ProductCardBaseProps`) |
| `npm test` | Unitarios migrados del terminal + card |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto |
| `npm run test:e2e` (con `.env.e2e`, base descartable) | `ventas-*`, `paso3`, `flujo-diario`, `tour`, `responsive`, `accessibility` |

## Cierre de la tarea

- Actualizar `.devin/informes/archivados/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` §8.2: marcar ítems 3-4 de la Fase 2 como implementados con nota breve de estado.
- Si se mergea un PR, `reporte-estado.md` §0 se actualiza según la convención del proyecto.
- No archivar el informe ni los prompts hasta completar todas las fases.
