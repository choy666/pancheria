# Rediseño `/pedido` — PR 1: tema claro, tokens de marca y card pública

**Estado:** implementado (PR 2 completado en [rediseno-pedido-pr2-2026-10-02.md](rediseno-pedido-pr2-2026-10-02.md))

Implementación del PR 1 de [plan-rediseno-card-y-modal-pedido.md](../prompts/plan-rediseno-card-y-modal-pedido.md):
paleta clara y tokens de marca para el flujo público, fuentes Anton/Poppins y
la nueva card estilo food-delivery con hero visual, quick-add y botón de
personalización separado.

## Decisiones implementadas

### Scope de tema claro sin tocar el panel oscuro

- `<html>` sigue con clase `dark` global (panel y `/ventas` la necesitan).
- `src/app/(public)/layout.tsx` envuelve el flujo público con
  `data-theme="light"`; el bloque `[data-theme='light']` en `globals.css`
  redefine **todos** los tokens (`--background`, `--card`, `--primary`,
  `--border`, `--ring`, sidebar, charts) con una paleta clara cálida
  (`--background` crema `oklch(0.972 0.008 90)`, `--primary` rojo de marca).
- Los overlays que portalean a `document.body` salen del scope; se marcan
  explícitos: `DialogContent data-theme="light"` en checkout
  (`pedido-client.tsx`), `pedido-success-dialog.tsx` y `PromoOptionsDialog`
  vía prop nueva `variant="public" | "sales"` (default `sales` = oscuro,
  compatible con `/ventas`). También `SelectContent data-theme="light"` en
  el selector de sucursal y en `pedido-customer-form.tsx`.
- Los componentes base traen `ring-1 ring-white/8` (invisible sobre fondo
  claro); se agregó una regla que resuelve `--tw-ring-color: var(--border)`
  para `data-slot` card/dialog-content/select-content dentro del scope claro.

### Fuentes de marca

- `next/font/google`: `Anton` (`--font-anton`) y `Poppins`
  (`--font-poppins`, pesos 400–700) cargadas en `layout.tsx`.
- En el scope claro: `--font-heading` → Anton (títulos, precios, logo) y
  `--font-sans` → Poppins con fallback a la stack del sistema. El tema oscuro
  conserva Geist vía herencia de `:root`.
- Token nuevo `font-heading` expuesto en `@theme inline` (`font-heading`
  utility class).

### Tokens de marca

En `@theme` (valores estáticos, no var-linked): `--color-brand-red`
(`#d81f26`), `--color-brand-mustard` (`#f9b217`), `--color-brand-ink`
(`#1a1a1a`) → utilities `bg-brand-red`, `text-brand-ink`, etc.

### Card pública (`ProductCardBase`, `variant="catalog"`)

- Card blanca `rounded-3xl`, hero `aspect-video` con gradiente diagonal
  `bg-linear-to-br from-brand-red to-brand-mustard` e imagen a todo ancho
  (`next/image`, zoom suave en hover).
- Pill amarillo **PROMO** solo en `compound`; badge `N en tu pedido` flotando
  sobre el hero.
- Cuerpo: nombre en `font-heading`, descripción `line-clamp-2`, precio grande
  en `text-brand-red`.
- **Quick-add**: "Agregar" siempre agrega con la selección por defecto
  (`addItem` ya resuelve `selectedByDefault` cuando no recibe ids). Nuevo
  botón circular `data-testid="customize-product-${id}"` (icono sliders)
  abre `PromoOptionsDialog` en productos con opcionales.
- La card es **presentacional** (sin `role="button"`): evita interactives
  anidados y dobles acciones; el hero no es clickeable.
- La disponibilidad cualitativa se mantiene en `sr-only` (`product-availability`
  sigue existiendo para E2E/lectores de pantalla); se eliminó
  `ProductCardRecipeIncluded` de la vista pública.
- La variante `sales` quedó intacta (card-botón, badges de tipo/opcionales,
  `N en venta`, stock restante).

### Imagen (`ProductCardImage`)

- Prop `priority` (la recibe solo la primera fila del catálogo: los primeros
  3 productos aplanados de `groupedProducts`, via `imagePriority`).
- `Skeleton` translúcido mientras carga (`opacity` transicionada al `onLoad`).
- **Fallback de marca sin asset nuevo**: monograma con la inicial del
  producto en círculo blanco translúcido sobre el gradiente (no se creó logo
  en `public/`; la inicial es más específica que un logo genérico y no suma
  un archivo). Manejo de error por URL conservado (`failedUrl`).

### Ajustes de contraste del flujo público

Clases pensadas para oscuro corregidas a variantes claras (todas dentro del
flujo `/pedido` y chat):

- `branch-status-chip.tsx`, `branch-info-card.tsx`, `order-tracker.tsx`:
  `*-400/200` → `green-700`/`amber-700`/`amber-800`/`green-800` con dots
  `*-500`.
- `border-white/8|10` → `border-border` en `pedido-catalog-section`,
  `recent-orders-banner`, `cart-summary`, `pedido-customer-form`,
  `pedido-error`, `pedido-client` (barra mobile) y `chat/*` (compartido con
  el panel: `--border` adapta en ambos temas, sin cambio visual en oscuro).
- `product-style.ts`: nuevo `publicProductTypeGroupClasses` (encabezados de
  grupo claros); `productTypeGroupClasses`/`productTypeBadgeClasses` quedan
  para el panel. Eliminado `publicProductTypeBadgeLabels` (sin consumidores:
  el badge de tipo público se reemplazó por el pill PROMO).

## Verificaciones

- `npx tsc --noEmit` ✓ · `npm run lint` ✓ (1 warning preexistente ajeno)
- `npm test` ✓ 178 suites / 1981 tests
- `npm run knip` ✓ · `npm run build` ✓
- Capturas (base dev local, los productos sin imagen muestran el fallback):
  - [Desktop 1280px](shots/pr1-pedido-desktop.png)
  - [Mobile 390px](shots/pr1-pedido-mobile.png)
  - [Diálogo de personalización en tema claro](shots/pr1-pedido-dialog.png)
- Errores de consola observados: solo el 404 del script de Vercel Insights
  en local (preexistente, sin relación).

## Impacto en E2E (pendiente de corrida)

- `add-product-${id}` ahora es **quick-add**: en productos con opcionales ya
  no abre el modal. Los specs que personalicen deben migrar a
  `customize-product-${id}` (ej. `pedido.spec.ts`).
- `Agregar al pedido` sigue siendo el CTA del modal (PR 2 lo cambia a
  `Agregar · $ X` con precio).
- `product-card-${id}`, `product-availability`, `checkout-button`,
  `cart-item` sin cambios.

## Addenda de revisión (misma sesión)

Verificación en vivo sobre `localhost:3000` (base dev; todos los productos
sin imagen → se ejercita el fallback de monograma en todas las cards):

- Quick-add en promo con opcionales: `add-product-${id}` agrega directo con
  `selectedByDefault` (la línea del carrito muestra "Incluye: Pan (1),
  Salchichas (2), Ketchup, Vaso de gaseosa"), aparece el badge "1 en tu
  pedido" sobre el hero y el CTA pasa a "Agregar otro".
- `customize-product-${id}` abre el diálogo en claro; checkout y
  `PedidoSuccessDialog` también; el `SelectContent` del selector de sucursal
  portalea en claro (opción destacada usa el mostaza de `--accent`).
- Barra mobile "Ver mi pedido · N ítems · $ X" y panel `/` en oscuro
  intacto (`pr1-panel-dark.png`).
- `/pedido/seguimiento` renderiza en claro.
- **Fix menor detectado en revisión**: el select "Tipo de entrega" de
  `pedido-customer-form.tsx` mostraba el valor crudo (`pickup`); ahora
  `SelectValue` con render function muestra la etiqueta
  (`Retiro en sucursal: {nombre}` / `Envío a domicilio`).
- Quirk de datos preexistente (no del PR): la sucursal sin horarios muestra
  "Abre No hay horarios de apertura configurados." — mensaje concatenado que
  viene del backend, no del rediseño.
- Capturas adicionales: [carrito con badge](shots/pr1-pedido-carrito.png),
  [checkout en claro](shots/pr1-pedido-checkout.png),
  [select portaleado](shots/pr1-pedido-select.png),
  [seguimiento](shots/pr1-pedido-seguimiento.png),
  [panel oscuro intacto](shots/pr1-panel-dark.png),
  [mobile con barra de carrito](shots/pr1-pedido-mobile-carrito.png).
- Prompt de continuación del PR 2:
  [rediseno-pedido-pr2-modal.md](../prompts/rediseno-pedido-pr2-modal.md).

## Pendiente para PR 2

Rediseño completo de `PromoOptionsDialog` (hero con imagen, secciones "A tu
gusto"/"Sumale", toggles accesibles, stepper de cantidad oculto en
`mode="edit"`, CTA con precio, hoja inferior en mobile). El prop `variant`
ya quedó como punto de extensión. Restyle de `mobile-cart-bar`. Aclaraciones
por ítem quedan descartadas del plan (no hay `notes` por ítem en backend).
