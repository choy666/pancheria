# Rediseño `/pedido` — PR 3: aclaraciones por ítem

**Estado:** en curso (implementado y verificado el 2026-10-02; pendiente PR/merge)

Plan del PR 3 de
[plan-rediseno-card-y-modal-pedido.md](../prompts/plan-rediseno-card-y-modal-pedido.md),
pendiente declarado en
[rediseno-pedido-pr2-2026-10-02.md](rediseno-pedido-pr2-2026-10-02.md)
§"Pendiente para PR 3".

## Objetivo

Nota de texto libre por línea del carrito (mockup: placeholder "Ej: bien
tostado"), persistida en `order_items`/`sale_items`, visible en cocina
(`/pedidos/[id]` + mensaje de preparación del chat), historial de ventas y
resumen del pedido del cliente.

El plan fue verificado contra el código y corregido en tres puntos donde la
nota se perdería silenciosamente (ver §"Correcciones de la revisión").

## Decisiones aprobadas

| # | Decisión | Resolución |
|---|---|---|
| 1 | ¿En qué líneas se puede aclarar? | **Todas**, no solo personalizables. El campo vive en `PromoOptionsDialog`; para líneas sin opcionales el botón de edición abre el mismo diálogo en `mode="edit"`, que renderiza solo la sección Aclaraciones (las secciones de opcionales ya devuelven `null` cuando están vacías — `promo-options-dialog.tsx` `OptionsSection`). Un solo editor, accesible, en ambas variantes. |
| 2 | Nota con stepper N>1 | La nota del diálogo aplica a las N unidades que se crean — comparten texto; al agrupar para el submit quedan `quantity: N` + una nota. Para notas distintas por unidad, se edita cada línea después. |
| 3 | Largo máximo | **200 caracteres** por ítem (el `notes` de pedido es 1000). Validación zod server-side + `maxLength` en el textarea. |
| 4 | Extras cobrables ("+ $X" en Sumale) | **Fuera de scope** — requiere pricing server-side y snapshots; decisión de negocio aparte (plan general decisión 6). |
| 5 | Versión del carrito localStorage | **Sin bump.** `notes` opcional en `cartItemSchema` carga carritos `pancheria-cart-v1` sin pérdida (compatibilidad hacia atrás). |
| 6 | Convivencia con `orders.notes` | `orders.notes` ya existe a nivel pedido (schema.ts, `orderSchema` max 1000, textarea del checkout). La nota de ítem es `items[].notes` — campo distinto, no se unifican. |

## Cambios por capa

### Schema y migración

- `src/db/schema.ts`: `notes text` nullable en `orderItems` (~línea 371) y
  `saleItems` (~línea 296).
- `npx drizzle-kit generate` → migración commiteada en `drizzle/`; aplicar
  con `npx drizzle-kit migrate` en `neondb_dev` y `neondb_e2e`. Producción
  sigue el flujo de [entornos.md](entornos.md).
- Las lecturas fluyen solas: drizzle `with:` devuelve todas las columnas y
  `normalizeOrderItem`/`SaleWithDetails` propagan por spread.

### Dominio y carrito

- `src/domain/types.ts`: `notes?: string | null` en `SaleItemInput`,
  `OrderItem` y `PublicOrderItem`.
- `src/lib/sale-helpers.ts`: `SaleItemValue.notes`; `buildSaleItemValues` lo
  propaga normalizado (`trim()` → `''` pasa a `null`). Este es el único
  punto de normalización trim→null del pipeline.
- `src/hooks/useSellableCart.ts`:
  - `SellableCartLine.notes`; `addItem(product, ids?, notes?)`; nuevo
    `updateLineNotes(lineId, notes)` (mismo patrón que
    `updateSelectedRecipeItemIds`).
  - **Merge por identidad con nota**: el `existing` de `addItem` (~líneas
    92-121) fusiona hoy por `product.id` + selección de receta en productos
    no personalizables. Debe comparar además la nota **normalizada**: misma
    nota → fusiona (cantidad+1); nota distinta → línea nueva. Sin esto,
    agregar "Gaseosa" y después "Gaseosa (nota: fría)" incrementa la línea
    sin nota y descarta la aclaración.
- `src/hooks/useCart.ts`:
  - `CartItem.notes` + `cartItemSchema` con `notes` opcional (sin bump de
    versión) + `lineToCartItem` + `getInitialItems`. Conviene
    `max(200)` también en el schema local: sin él, un localStorage editado a
    mano con una nota larga pasa el parse y rompe el submit entero con 400
    del servidor.
  - **Restore — tres puntos, no uno**: `notes` viene del ítem guardado, no
    de `product`, así que hay que agregarla en las **dos** ramas del
    `flatMap` de `getInitialItems` (la expansión de personalizables
    ~líneas 118-125 y la rama normal ~líneas 127-134) **y** en el `setLines`
    del efecto de restauración (~líneas 182-189), que también arma la línea
    con campos explícitos — si falta en alguno, la nota se descarta aunque
    el schema la haya parseado.
  - Exponer `updateLineNotes` envuelto (setea `userInteractedRef`).
- `src/lib/cart-helpers.ts`: `CartSubmitLine.notes`; la clave de
  `groupCartItemsForSubmit` incluye la nota **normalizada** (trim; `" fría "`
  y `"fría"` forman un solo grupo) y la fila agrupada la emite.
- `src/hooks/use-submit-idempotency-key.ts`: `cartSignature` recibe la nota
  normalizada dentro de la firma por línea — cubre `saleSignature` y
  `checkoutSignature` sin tocarlas. (Ojo: `checkoutSignature` ya tiene un
  parámetro `notes` que es la nota **del pedido**, no la de ítem — no
  confundir.)

### APIs y servicios

- `src/lib/zod-schemas.ts`: `notes: z.string().trim().max(200).optional().nullable()`
  en `saleItemSchema` (~línea 181) — alcanza `saleSchema` (`/api/ventas`),
  `orderSchema` (`/api/public/pedido`) y `cartAvailabilitySchema` (ambas
  disponibilidades; la disponibilidad la ignora).
- **Idempotencia — forma canónica única**: `serializeCanonical` omite
  `undefined`, así que `normalizeIdempotencyItems`
  (`idempotencyService.ts:38`) debe mapear `undefined`/`null`/`''` (post-trim)
  a una sola forma (p. ej. `null`), y las reconstrucciones deben emitir esa
  misma forma para que una fila con `notes NULL` matchee un retry sin nota:
  - `getLegacySaleHash` (`idempotencyService.ts:138-145`): el map de ítems
    guardados agrega `notes` desde la fila.
  - `createStoredOrderRequestHash` (`orderService.ts:163-170`): ídem.
  Basta pasar `notes: item.notes` crudo en ambos maps: la canonicalización
  vive solo en `normalizeIdempotencyItems` (no normalizar dos veces).
- `orderService`:
  - `buildOrderItemValues` (`order-helpers.ts:56`) escribe
    `order_items.notes`.
  - **Conversión pedido→venta**: la nota viaja por `buildItems`
    (`orderService.ts:624-630`) — es lo que alimenta `buildSaleItemValues` →
    `sale_items`. Agregar `notes: item.notes` ahí es **obligatorio**;
    `toSaleItemInputWithSelection` (:124) solo alimenta la validación de
    stock (agregarla también por consistencia, pero no es el camino de la
    nota).
- `saleService`: el map de `insertItems` en
  `insertSaleAndUpdateCashRegister` (~líneas 314-323) agrega
  `notes: item.notes`.
- `/api/public/pedido` POST: el map a `PublicOrderItem` (~líneas 70-77)
  agrega `notes`.
- Sin cambios de pricing ni de disponibilidad.
- Menor/opcional: `saleRepository.create` también inserta ítems sin nota;
  solo lo usa su test — actualizar por completitud o dejar.

### UI

- `promo-options-dialog.tsx`: sección "Aclaraciones" con textarea etiquetado
  (`aria-label="Aclaraciones para {producto}"`, placeholder "Ej: bien
  tostado", `maxLength={200}`, contador opcional). Estado local `notes`
  inicializado desde nueva prop `initialNotes` (edición);
  `PromoOptionsConfirmPayload` gana `notes`. En `mode="edit"` sobre producto
  sin opcionales queda solo esta sección (el stepper ya se oculta y las
  secciones de opcionales devuelven `null`).
- **Cadena del payload hacia el carrito**: `notes` atraviesa
  `ProductCardBase.onAdd` → `ProductCard.onAdd` → `PedidoCatalogSection.onAdd`
  → `usePedidoClient.addItem` → `useCart.addItem` → `useSellableCart.addItem`.
  Como `quantity` ya es parámetro posicional en el medio
  (`onAdd(selected?, quantity?)`), preferir objeto opciones
  `{ selectedRecipeItemIds?, quantity?, notes? }` (o pasar
  `PromoOptionsConfirmPayload` directo) antes que un cuarto posicional.
- `cart-summary.tsx` (`/pedido`) y `sales-cart.tsx` (`/ventas`):
  - la nota se muestra bajo el resumen de receta ("Nota: …");
  - el botón de edición deja de estar gateado por `personalizable`
    (`cart-summary.tsx:148`, `sales-cart.tsx:238`): se habilita en **todas**
    las líneas. Las no personalizables conservan su stepper ± y ganan el
    botón — definir label ("Personalizar" vs "Aclaración"/"Editar").
- `checkout-summary.tsx` y `pedido-success-dialog.tsx`
  (`OrderItemRecipeDetails`): muestran la nota por ítem.
- `usePedidoClient`: `editingLine` gana `initialNotes` (`startEditLine` lo
  puebla desde `item.notes`); `confirmEditLine` aplica
  `updateSelectedRecipeItemIds` + `updateLineNotes`; los maps de
  `groupCartItemsForSubmit` (disponibilidad ~línea 427 y submit ~línea 564)
  pasan `notes`. El diálogo de edición se renderiza en
  `pedido-client.tsx` (~líneas 223-241): ahí se pasa
  `initialNotes={editingLine.initialNotes}` al `PromoOptionsDialog`.
  `sales-terminal`: ídem (`editingLine.initialNotes`,
  `confirmEditLine`, `addToCart` recibe la nota del payload y la pasa a
  `addLine` en cada unidad; maps en ~166 y ~337).
- Interfaces a extender con `notes`: `usePedidoDetail.OrderDetailItem`
  (:22-33), `pedido-items-list.OrderDetailItem` (:5-16),
  `sales-history.Sale["items"]` (:41-47).

### Cocina y visualización

- `pedido-items-list.tsx` (`/pedidos/[id]`): "Nota: …" bajo el
  `Incluye:/Sin:`.
- `order-helpers.ts` `buildRecipeSnapshotMessageContent` (:79-93): agregar
  `Nota: …` por línea — llega al chat como mensaje de preparación
  (`orderService.ts:377`). **El filtro actual descarta ítems sin
  `recipeSnapshot`** — con notas en todas las líneas debe incluir también
  los que tengan solo nota (`snapshot?.length || notes`), con formato de
  línea para el caso sin receta (p. ej. `Gaseosa x1 — Nota: bien fría`).
- `sales-history.tsx`: nota en el detalle de cada ítem vendido (tabla y
  diálogo de anulación).
- `/pedidos` (lista de cocina): no renderiza detalle por ítem — sin cambios.
- Tracking público: `TrackOrderResult` no devuelve ítems — la nota llega al
  cliente solo por el `pedido-success-dialog` y el mensaje de preparación en
  el chat. (Mostrar ítems en `/pedido/seguimiento` sería scope extra.)

## Correcciones de la revisión

La revisión del plan contra el código encontró tres puntos donde la nota se
perdería silenciosamente, ya integrados arriba:

1. **Merge en `useSellableCart.addItem`** (~líneas 92-121): la fusión de
   líneas no personalizables ocurre antes del submit; la nota es parte de la
   identidad de la línea ahí también, no solo en `groupCartItemsForSubmit`.
2. **`buildItems` en `convertOrderToSale`** (`orderService.ts:624-630`), no
   `toSaleItemInputWithSelection`, es el camino real de la nota hacia
   `sale_items`.
3. **Filtro de `buildRecipeSnapshotMessageContent`**
   (`order-helpers.ts:82-83`): descarta líneas sin snapshot; una aclaración
   sobre producto simple nunca llegaría al mensaje de preparación.

Ajustes de precisión adicionales incorporados: normalización canónica
`undefined`/`null`/`''` → `null` en los cuatro puntos de hash; `setLines` de
restore con campos explícitos; cadena de firmas del `onAdd` (objeto
opciones); interfaces duplicadas `OrderDetailItem`/`Sale["items"]`;
`TrackOrderResult` sin ítems.

Segunda pasada de revisión (2026-10-02, verificada contra el código):
todas las referencias del plan confirmadas exactas. Precisiones
incorporadas: el wiring de `initialNotes` vive en `pedido-client.tsx` (no
en `usePedidoClient.ts`); el restore de `useCart` tiene tres puntos de
construcción (dos ramas de `getInitialItems` + `setLines`); `max(200)`
también en `cartItemSchema` de localStorage; la canonicalización queda solo
en `normalizeIdempotencyItems` (los maps de reconstrucción pasan
`item.notes` crudo); el merge de `addItem` también aplica a `service`
(caso de test).

## Tests

- **Unitarios** (extender los archivos existentes, no crear paralelos):
  `promo-options-dialog.test.tsx` (campo, payload con `notes`, precarga vía
  `initialNotes` en edit, diálogo solo-nota sin secciones vacías ni
  stepper), `cart-helpers.test.ts` (agrupamiento por nota), `zod-schemas.test.ts`
  (trim/max 200), `useCart.test.ts` (round-trip localStorage),
  `useSellableCart.test.ts` (merge solo con nota igual — incluir caso
  `type: 'service'`, que también entra al bloque de fusión — y
  `updateLineNotes`),
  `sale-helpers`/`order-helpers` (`buildSaleItemValues` trim→null,
  `buildOrderItemValues`, mensaje de preparación incluyendo línea
  solo-con-nota), `use-submit-idempotency-key.test.ts` (firma cambia con
  nota distinta), `idempotencyService.test.ts` (reconstrucciones legacy con
  `notes NULL` matchean request sin nota), `orderService.test.ts`
  (conversión pedido→venta preserva la nota), `sales-terminal.test.tsx`.
- **E2E**: `/pedido` — agregar con nota → carrito → submit → `/pedidos/[id]`
  muestra nota y mensaje de preparación; `/ventas` — línea con nota →
  venta → historial; edición de nota en línea existente.
- axe sobre el modal con el campo nuevo.

## Verificaciones

`npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run knip` ·
`npm run build` · `npx drizzle-kit migrate` (dev + e2e) · suite E2E completa
sobre `neondb_e2e` · capturas del modal con el campo y de `/pedidos` con la
nota · actualizar este informe + `README.md` de informes.

## Riesgos a cuidar

1. **Fusión de líneas en dos puntos**: `useSellableCart.addItem` (merge de
   no personalizables) y `groupCartItemsForSubmit` (submit). La nota
   normalizada es parte de la identidad de la línea en ambos.
2. **Idempotencia**: dos hashes cliente (`cartSignature`, vía
   `saleSignature`/`checkoutSignature`) + dos reconstrucciones server
   (`getLegacySaleHash`, `createStoredOrderRequestHash`) — los cuatro con la
   misma forma canónica de nota.
3. **Conversión pedido→venta**: `buildItems` es el punto donde la nota se
   puede perder sin error visible.
4. **Mensaje de preparación**: el filtro por snapshot no debe descartar
   líneas solo-con-nota.
5. El diálogo en modo "solo nota" (producto simple) no debe mostrar
   secciones vacías ni el stepper (ya resuelto estructuralmente; verificar
   visualmente en ambas variantes).

## Resultado de la implementación (2026-10-02)

Implementado completo siguiendo este plan:

- **Schema/migración**: `drizzle/0034_needy_puppet_master.sql` agrega
  `notes text` nullable a `order_items` y `sale_items`. Aplicada con
  `drizzle-kit migrate` en la base de desarrollo y en la base E2E
  (`drizzle-kit check`: OK).
- **Dominio/carrito**: `notes?: string | null` en `SaleItemInput`,
  `SaleItemValue`, `OrderItem`, `PublicOrderItem`, `CartItem` y
  `SellableCartLine`. `normalizeItemNote` (`cart-helpers.ts`) concentra la
  forma canónica (`trim` → `null`); `ITEM_NOTE_MAX_LENGTH = 200` vive ahí y
  lo consumen el textarea y `saleItemSchema` (zod). Merge de líneas por
  producto + selección + nota en `useSellableCart.addItem` y en
  `groupCartItemsForSubmit`. `cartSignature` incluye la nota; sin bump de
  `pancheria-cart-v1`.
- **Servicios/APIs**: `notes` persiste en `order_items` (via
  `buildOrderItemValues`) y `sale_items`; la conversión pedido→venta la
  conserva (`buildItems`); las reconstrucciones de huella (`getLegacySaleHash`,
  `createStoredOrderRequestHash`) emiten la misma forma canónica;
  `POST /api/public/pedido` devuelve `notes` por ítem.
- **UI**: `PromoOptionsDialog` gana sección "Aclaraciones" (textarea con
  label asociado vía `aria-labelledby`, `maxLength`, contador) y prop
  `initialNotes`; en `mode="edit"` sobre producto sin opcionales queda solo
  esa sección. El payload `PromoOptionsConfirmPayload.notes` atraviesa
  `ProductCardBase → ProductCard → PedidoCatalogSection → usePedidoClient →
  useCart → useSellableCart` y la rama de ventas (`sales-terminal`). La nota
  se muestra como "Nota: …" en `cart-summary`, `checkout-summary`,
  `pedido-success-dialog`, `sales-cart`, `pedido-items-list` y
  `sales-history`; el mensaje de preparación del chat incluye
  `— Aclaración: …` por línea (también en líneas sin receta).
- **Tests**: ampliados los archivos existentes (diálogo, helpers, hooks,
  schemas, idempotencia, servicios, repositorios, ruta pública y
  `pedido-success-dialog`); E2E nuevo en `pedido.spec.ts` (aclaraciones
  end-to-end carrito→panel→chat + líneas separadas por nota distinta) y en
  `ventas-historial.spec.ts` (nota en historial de ventas). Fix menor: el
  aria-label del botón de línea pasó de "Editar personalización de X" a
  "Editar X" (ahora edita también la aclaración en productos sin
  opcionales) y el spec se actualizó acorde.

**Verificación ejecutada**: `npm run lint` ✓ · `npx tsc --noEmit` ✓ ·
`npm test` 2025/2025 ✓ · `npm run knip` ✓ · `npm run build` ✓ ·
`drizzle-kit migrate` dev + e2e ✓ · E2E `pedido.spec.ts` +
`ventas-historial.spec.ts` 10/10 ✓ · `npm run test:accessibility` 4/4 ✓ ·
**suite E2E completa** (`npx playwright test`, 185 tests, 1 worker,
`SEED_SAMPLE_CATALOG=1`): **183 passed, 1 flaky** (`paso4` anulación de
venta, pasó en retry — mismo flaky de la corrida PR 2) **y 1 timeout** en
`responsive.spec.ts:117` bajo carga de la suite; re-corrido aislado pasó
en 2.4m. Sin regresiones atribuibles al PR.

**Capturas** (base dev `neondb_dev`, pedido real `PED-1-1790972031642-cbacea89`
creado vía UI pública, luego cancelado; caja abierta y cerrada para el
flujo, sin ventas):

- [Modal con campo Aclaraciones — desktop 1280px](shots/pr3-modal-aclaraciones-desktop.png)
- [Modal con campo Aclaraciones — mobile 390px](shots/pr3-modal-aclaraciones-mobile.png)
- [Diálogo de éxito con la nota del ítem — mobile](shots/pr3-exito-con-nota-mobile.png)
- [`/pedidos/[id]` con "Nota: …" en el ítem](shots/pr3-pedidos-detalle-nota.png)
- [Mensaje de preparación del chat con "— Aclaración: …"](shots/pr3-pedidos-chat-preparacion.png)

Para las capturas se creó un usuario admin temporal en la base dev
(`devin-capturas`), eliminado al terminar; la contraseña del `.env.local`
no correspondía al seed vigente de `neondb_dev`.
