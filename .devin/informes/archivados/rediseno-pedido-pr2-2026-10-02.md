# Rediseño `/pedido` — PR 2: modal de personalización estilo food-delivery

> **Estado: archivado — implementado, verificado y mergeado** en `main` (2026-10-02, commit `3a029e4`; PR 3 de aclaraciones por ítem en [rediseno-pedido-pr3-2026-10-02.md](rediseno-pedido-pr3-2026-10-02.md)).

Implementación del PR 2 de
[plan-rediseno-card-y-modal-pedido.md](../../prompts/archivados/plan-rediseno-card-y-modal-pedido.md)
según [rediseno-pedido-pr2-modal.md](../../prompts/archivados/rediseno-pedido-pr2-modal.md):
rediseño completo de `PromoOptionsDialog` con hero de producto, toggles
accesibles, stepper de cantidad y CTA con precio; propagación de `quantity`
como N líneas independientes del carrito.

## Decisiones implementadas

### Estructura del diálogo (`promo-options-dialog.tsx`)

- **Variante `public`** (`/pedido`):
  - Hero `aspect-video` con `ProductCardImage` (imagen o fallback de
    monograma sobre gradiente de marca) y botón circular blanco de cierre
    (X) flotando a la derecha.
  - `DialogContent` con `data-theme="light"` explícito: el portal cae en
    `document.body`, fuera del scope claro de `(public)/layout.tsx`.
  - En mobile (`max-sm`) se ancla al borde inferior como hoja
    (`bottom-0`, `rounded-t-3xl`, `slide-in-from-bottom`); en desktop
    conserva el diálogo centrado del componente base.
  - `max-h-[92dvh]` con el cuerpo scrolleable (`min-h-0 flex-1
    overflow-y-auto`) y footer fijo.
- **Variante `sales`** (default): tema oscuro global, sin hero, cierre
  estándar del diálogo base, centrado también en mobile.
- Nombre y precio en una misma fila (`DialogTitle` + precio en
  `text-primary`: rojo en claro, azul en oscuro); descripción corta debajo
  cuando existe.

### Secciones y toggles

- "Podés sacar" → **"A tu gusto"** (`isOptional && supplyType ===
  'manual_supply'`) y "Extras" → **"Sumale"** (`isOptional &&
  supplyType === 'service'`). Los ítems requeridos de la receta ya no se
  listan como filas editables.
- Checkboxes → `<button role="switch" aria-checked>` con `aria-label`
  "Incluir {insumo} en {producto}": activo "✓ Lleva" en `text-primary`,
  inactivo "Sin {insumo}". Se usó `aria-checked` (atributo correcto del
  rol `switch` en ARIA) en lugar del `aria-pressed` sugerido por el
  prompt, que corresponde a toggle buttons.
- Respeta `selectedByDefault` e `initialSelectedIds` (edición).

### Stepper y CTA

- Stepper `role="group" aria-label="Cantidad"` con botones `outline`
  circulares de 44px (`promo-quantity-decrease`/`increase`) y valor con
  `aria-live="polite"` (`promo-quantity-value`). Mínimo 1; tope
  `maxQuantity` (default 99). Oculto en `mode="edit"`.
- CTA `promo-options-confirm`: add → `"{label} · {formatMoney(precio ×
  quantity)}"` (labels por defecto "Agregar" / en ventas "Agregar a la
  venta"); edit → `confirmLabel` o "Guardar cambios" sin precio.
- En `public` el CTA es pill rojo `bg-brand-red`; en `sales` conserva el
  estilo default.

### Payload e integración

- `PromoOptionsConfirmPayload.quantity: number` (en `edit` siempre 1).
- `usePedidoClient` y `sales-terminal`: los productos personalizables
  generan **N líneas independientes** — se invoca `addItem`/`addLine` una
  vez por unidad, cada una con `lineId` propio. `useSellableCart` sigue
  siendo la fuente de verdad de disponibilidad en cada agregado.
- Callers propagan `imageUrl`/`description` al diálogo
  (`product-card-base`, `pedido-client`, `usePedidoClient`,
  `sales-terminal`).

## Verificaciones

- `npx tsc --noEmit` ✓ · `npm run lint` ✓ (1 warning preexistente ajeno)
- `npm test` ✓ 178 suites / 1987 tests
- `npm run knip` ✓ · `npm run build` ✓
- Capturas sobre `localhost:3000` (base dev; "Promo 1" sin imagen usa el
  fallback de monograma):
  - [Público desktop 1280px](../shots/pr2-modal-public-desktop.png) —
    cantidad 2 → CTA "Agregar · $ 2.000".
  - [Público mobile 390px](../shots/pr2-modal-public-mobile.png) — hoja
    inferior anclada (el círculo oscuro "N" abajo a la izquierda es el
    indicador de dev-tools de Next.js, no la app).
  - [Ventas desktop](../shots/pr2-modal-ventas-desktop.png) y
    [mobile](../shots/pr2-modal-ventas-mobile.png) — tema oscuro, sin hero,
    CTA "Agregar a la venta · $ 1.000".
  - [Grilla mobile de `/pedido`](../shots/pr2-pedido-grid-mobile.png) —
    encabezado de marca, selector de sucursal, pill PROMO, barra "Ver mi
    pedido · N ítems · $ X".
  - [Card sin foto](../shots/pr2-card-fallback-mobile.png) — fallback de
    monograma sobre gradiente, badge "1 en tu pedido", botón circular de
    personalización + "Agregar otro".
  - [Carrito con línea personalizada](../shots/pr2-carrito-personalizado-mobile.png)
    — dos líneas independientes de "Promo 1", la segunda "Sin: Ketchup".
- E2E en base descartable Neon (`.env.e2e`):
  `npx playwright test tests/e2e/pedido.spec.ts
  tests/e2e/ventas-disponibilidad.spec.ts` — **11 passed (4.8m)**,
  incluidos el stepper de 15 unidades y las personalizaciones por
  switch en ambas variantes.
- **Suite E2E completa** (`npx playwright test`, 182 tests, 1 worker,
  con `SEED_SAMPLE_CATALOG=1`): **179 passed, 2 flaky** (pasaron en
  retry: anulación de venta en `paso4.spec.ts` y checkout por teclado
  en `ux-perfiles.spec.ts`) **y 1 timeout** en
  `responsive.spec.ts:117` — el test itera 48 navegaciones en 60s y se
  quedó sin tiempo con el dev server bajo carga de la suite; re-corrido
  aislado pasó **10/10**. Sin regresiones atribuibles al PR: todos los
  specs que ejercen el modal (`pedido`, `ventas-disponibilidad`,
  `accesibilidad`, `ux-perfiles`) pasaron.

## Verificación en vivo (navegador real, base dev)

- **Edición sin stepper**: "Editar" en una línea abre el diálogo con los
  switches del estado de la línea (Ketchup en "Sin Ketchup"), sin grupo
  "Cantidad" y CTA "Guardar cambios".
- **Pedido real de punta a punta**: 2 líneas independientes de Promo 1
  (una "Sin: Ketchup") → checkout → `PED-1-1790949035305` creado →
  `/pedidos/73` muestra ambas líneas con su resumen de receta y el
  mensaje de preparación con las dos configuraciones.
- **Tamaños táctiles**: toggles `min-h-11` (44px), botones del stepper
  44×44px medidos en DOM, CTA `min-h-12`.
- **"Sumale" sin precio por ítem**: los servicios opcionales se listan
  por nombre + toggle (no son cobrables; extras con precio quedan fuera
  del scope declarado del PR).
- **Caja de la base dev**: se abrió una para disparar la variante
  `sales` y se cerró al terminar (conteos en 0, sin ventas
  registradas). La base dev es `neondb_dev` (branch Neon de desarrollo),
  sin datos reales de operación.

## Impacto en E2E

- Apertura del modal: `customize-product-${id}` (en `add-product-${id}`
  queda el quick-add). Migrado en `pedido.spec.ts`.
- Toggles: `getByRole('switch', { name: /Incluir .+ en .+/ })`.
- CTA: público `/Agregar ·/`; ventas `'Agregar a la venta'` sigue
  matcheando por substring sobre "Agregar a la venta · $ X".
- El resto de specs con `add-product-${id}` crean productos simples vía
  API (sin opcionales) → el quick-add conserva el comportamiento.
- `ventas-stock-compartido.spec.ts` clickea la card completa sobre
  promos con receta solo requerida → no abre el modal, sin cambios.

## Observaciones de datos y entorno

- `.env.e2e.example` y CI definen `SEED_SAMPLE_CATALOG=1`, pero el
  `.env.e2e` local no lo tenía: una primera corrida de la suite
  completa falló en los specs que buscan el catálogo sembrado
  (`paso3`, `paso4`, `productos-y-recetas`, entre otros). Se agregó la
  variable al `.env.e2e` local y la corrida definitiva se hizo con la
  misma configuración que CI.
- Durante la verificación manual se abrió una caja en la base dev
  (`/ventas`) para poder disparar el diálogo en variante `sales`.

## Pendiente para PR 3

Aclaraciones por ítem (notas del cliente en cada línea) — requiere campo
de texto por línea y persistencia en el submit del pedido/venta.
Plan aprobado en
[rediseno-pedido-pr3-2026-10-02.md](rediseno-pedido-pr3-2026-10-02.md).
