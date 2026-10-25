# Auditoría de sincronización `/ventas` ↔ `/pedido` — terminal POS vs. flujo público rediseñado

**Estado:** abierto
**Fecha de ejecución:** 2026-10-25
**HEAD:** `3a905ac2018b4687193644c1f46d9640301807a0`
**Alcance:** auditoría estrictamente de solo lectura. No se modificó código, esquema, configuración ni datos. Las capturas de evidencia se generaron contra la base de desarrollo `neondb_dev` (`.env.local`) navegando en modo lectura; no se abrió caja ni se confirmó ninguna venta. El prompt de origen es `.devin/prompts/auditoria-sincronizacion-ventas-pedido.md`. Todas las afirmaciones citan `archivo:líneas` del `HEAD` indicado.

---

## 0. Síntesis ejecutiva

- **La base técnica ya está compartida.** `/pedido` y `/ventas` consumen el mismo `ProductCardBase` con variantes (`src/components/productos/product-card-base.tsx:41`), el mismo `PromoOptionsDialog` con variantes (`src/components/promo/promo-options-dialog.tsx:166`), el mismo `CartPanel` (`src/components/cart/cart-panel.tsx:24`) y el mismo motor de carrito `useSellableCart` (`src/hooks/useSellableCart.ts:79`). La divergencia es de *configuración de superficie*, no de componentes: qué variante se usa, con qué tema y con qué estrategia de refresco.
- **La brecha más importante no es visual sino operativa: el catálogo del POS no se refresca solo.** `/ventas` descarga el catálogo completo una sola vez al montar (`src/components/ventas/sales-terminal.tsx:152-158`) y solo recalcula disponibilidad cuando cambia el carrito local (debounce 300 ms, `sales-terminal.tsx:160-225`) o tras confirmar una venta (`sales-terminal.tsx:369-371`). Si otra terminal vende, un pedido público reserva stock o un admin edita el catálogo, el POS muestra datos viejos hasta la próxima interacción local. `/pedido`, en cambio, hace polling cada 30 s con `useVisibilityPolling` (`src/components/pedido/usePedidoClient.ts:402-410`).
- **El tema claro es portable con un mecanismo ya probado** (`[data-theme='light']` en `src/app/globals.css:101-138` + `data-theme="light"` explícito en cada superficie portaleada). La recomendación es una **variante híbrida**: contenido de `/ventas` claro, chrome del panel (`PanelHeader`, menú mobile) oscuro. Ver §2 y las capturas del anexo A.
- **El quick-add ya existe en el carrito compartido**: `useSellableCart.addItem` resuelve `selectedByDefault` y aplica `maxOptionalSelections` cuando no recibe selección (`src/hooks/useSellableCart.ts:93-100`). Lo que falta es la decisión de UX en `/ventas`: hoy la card completa abre el diálogo en compuestos con opcionales (`sales-terminal.tsx:234-238`), y el patrón público de "Agregar directo + personalizar aparte" exige rediseñar el contrato de click de la card, que los tests E2E usan intensivamente (§7).
- **Las garantías del POS son superiores a las del flujo público y deben preservarse intactas**: `CajaStatus` con bloqueo operativo, pago mixto con `PaymentPartsInput`, shortages internos con insumo/cantidades, "Podés sumar N más" por card, toggle de agotados, idempotencia por `saleSignature`, edición de línea y notas. Inventario en §6.

---

## 1. Estructura y layout

### 1.1 `/pedido` (referencia)

- **Shell:** `src/app/(public)/layout.tsx:11-42` — wrapper `data-theme="light"` con header sticky (marca Panc**hería**), `<main>` y footer con link "Acceso para el personal".
- **Datos:** `src/app/(public)/pedido/page.tsx:33-71` — componente async `PedidoCatalog` que carga en paralelo `listPublicCatalogWithAvailability` (primera página, `pageSize` de `getCatalogPageSize()`) y `listPublicBranches`, envuelto en `<Suspense fallback={<PedidoSkeleton />}>` (`page.tsx:97-101`). Redirige a `?branchId=` cuando resuelve la sucursal por defecto (`page.tsx:93-95`).
- **Encabezado de catálogo:** `src/components/pedido/pedido-catalog-section.tsx:84-170` — card con `h1` "Catálogo de {sucursal}", steps 1→2→3 (`pedido-steps`), link a seguimiento, `Select` de sucursal (`branch-select-trigger`/`SelectContent data-theme="light"`, líneas 123-146), `BranchStatusChip` (abierto/cerrado + próximo horario) y `BranchInfoCard variant="header"`.
- **Grilla:** grupos por tipo con headers (`pedido-catalog-section.tsx:183-204`), cada uno `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (línea 190); "Cargar más productos" (`catalog-load-more`, líneas 206-218); estado vacío `catalog-empty-state` (líneas 174-182).
- **Carrito:** columna derecha `id="pedido-cart"` con scroll-mt (línea 221), renderiza `PedidoCartSection` → `CartSummary` sobre `CartPanel` (sticky `lg:top-24`, `cart-panel.tsx:42-47`).
- **Barra móvil:** pill roja fija `mobile-cart-bar` con "Ver mi pedido · N ítems · $total" (`pedido-client.tsx:261-283`).

### 1.2 `/ventas` (estado actual)

- **Shell:** `src/app/(panel)/layout.tsx:45-57` — `PanelHeader` oscuro (navegación, selector de sucursal vía cookie `activeBranchId`, menú mobile `data-tour="mobile-nav"`, `TourProvider`) + `<main>`. La página `src/app/(panel)/ventas/page.tsx:15-20` agrega `h1` "Ventas" + `SalesTerminal`.
- **Datos:** client-side puro. `useEffect` de montaje → `fetchProducts()` → `fetchAllPages` sobre `GET /api/productos?includeAvailability=true&page=N&limit=100` (`sales-terminal.tsx:121-150`, `fetch-all-pages.ts:10-26`, `src/config/pagination.ts:4`). Skeleton inline (3 `Skeleton` de card, `sales-terminal.tsx:385-396`).
- **Bloque superior:** `CajaStatus` dentro de `data-tour="caja-status"` (`sales-terminal.tsx:402-416`).
- **Grilla:** `grid gap-5 lg:grid-cols-3` (línea 418); columna izquierda con `h2` "Catálogo" + toggle `toggle-show-out-of-stock` (líneas 420-432) y **grid plano** `data-tour="sales-products"` (líneas 434-458) ordenado por `sortSellableProducts` (`src/lib/ventas-helpers.ts:22-31`); columna derecha `SalesCart` en `CartPanel` con `data-tour="sales-cart"` (`sales-cart.tsx:331`).
- **Barra móvil:** barra fina `cart-mobile-bar` (ítems, total, "Ver venta") que scrollea al carrito (`sales-cart.tsx:354-372`). **Nota:** el testid invierte el orden respecto al público (`cart-mobile-bar` vs `mobile-cart-bar`).

### 1.3 Brechas estructurales

| Aspecto | `/pedido` | `/ventas` |
| --- | --- | --- |
| Carga inicial | SSR (Suspense + skeleton) | Cliente tras hidratar (skeleton inline) |
| Selector de sucursal | En la página (invalida carrito, `usePedidoClient.ts:525-533`) | En `PanelHeader` (cookie `activeBranchId`) |
| Estado operativo | `BranchStatusChip` + `BranchInfoCard` (horarios + caja) | `CajaStatus` (caja real, turnos, alertas) — más útil para operación |
| Catálogo | Grupos con headers de tipo | Plano, ordenado por prioridad de tipo sin headers |
| Card | Hero con imagen/fallback, pill PROMO, CTA "Agregar" + `customize-product-${id}` | Card completa `role="button"`, sin imagen, badges tipo/opcionales/cantidad, "Disponible"/"Podés sumar" |
| Carrito | `CartSummary` (público, shortage booleano) | `SalesCart` (pago mixto, shortages detallados, blocker) |
| Barra móvil | Pill roja `mobile-cart-bar` | Barra fina `cart-mobile-bar` |
| Estado vacío catálogo | `catalog-empty-state` | **No existe** (grid vacío sin mensaje) |

**Recomendación estructural:** conservar el layout de dos columnas con `CartPanel` sticky (idéntico patrón ya) y evaluar solo tres sumas de la superficie pública: headers de grupo (§5), estado vacío de catálogo, y opcionalmente hero/imagen en la card `sales` — esta última es la decisión visual más costosa: la card sin imagen muestra más productos por pantalla (mejor para mostrador), mientras que la imagen ayuda a operadores nuevos. Las capturas del anexo A muestran la diferencia real de densidad.

---

## 2. Tema claro en el terminal

### 2.1 Mecanismo existente (ya probado en producción)

- `<html>` permanece `.dark`; `:root` y `.dark` definen la paleta oscura (`src/app/globals.css:59-93` y `174-207`).
- `[data-theme='light']` redefine **todas** las variables de superficie + tipografías de marca (`--font-sans` → Poppins, `--font-heading` → Anton) y aplica `font-family` (`globals.css:101-138`).
- Fix de anillos: `[data-theme='light'] [data-slot='card'|'dialog-content'|'select-content'] { --tw-ring-color: var(--border) }` (`globals.css:145-149`) — los `ring-white/…` de los componentes base quedan invisibles sobre fondo claro.
- `[data-theme='screen']` solo hereda tipografías sobre fondo oscuro (`globals.css:156-162`) — precedente de "tema parcial".
- Contrato de portales: cada superficie que portalea a `document.body` lleva `data-theme` explícito — `SelectContent` (`pedido-catalog-section.tsx:139`), `DialogContent` del checkout (`pedido-client.tsx:161`), `PromoOptionsDialog` (`promo-options-dialog.tsx:256`, `data-theme={isPublic ? 'light' : undefined}`) y `ConfirmDialog` con prop `dataTheme` (`src/components/ui/confirm-dialog.tsx:23,40`).

### 2.2 Inventario de lo que pasaría a claro en `/ventas`

Dentro del scope (si el `main` de `/ventas` lleva `data-theme="light"`):

- `CajaStatus` (cards ya basadas en tokens) + `CashRegisterAlertBanner` (paletas `*-700`, light-safe, `cash-register-alert.tsx:80-82`) + `CashRegisterShiftBadge` (`text-green-400`/`text-amber-400` sobre `*-500/20` — `cash-register-shift-badge.tsx:41,55`, contraste a verificar sobre claro).
- Cards de producto `variant="sales"`: tokens OK; los badges de tipo usan `Badge variant="secondary"/"outline"/"default"` (tokens) — las clases `productTypeBadgeClasses`/`productTypeTextClasses`/`productTypeGroupClasses` (`src/lib/product-style.ts:42-68`) usan `*-400`/`*-300` pensadas para oscuro: si se reutilizan en headers de grupo o badges, **hay que tomar el mapa claro** `publicProductTypeGroupClasses` (`product-style.ts:75-80`) o crear uno interno equivalente.
- `SalesCart`: dos `border-white/10` hardcodeados (`sales-cart.tsx:282,288`) que desaparecerían sobre fondo claro → migrar a `border-border`. El aviso de caja cerrada (`text-amber-700` sobre `bg-amber-600/10`, línea 129) y el shortage (`text-amber-700`, línea 207) ya usan paletas light-safe.
- `PaymentPartsInput`/`MoneyAmountInput`: tokens (`payment-parts-input.tsx:109,128`); `text-amber-500` del mensaje restante (línea 76) es legible en ambos.
- Precio `ProductCardPrice` (`product-card-price.tsx:9`): `font-mono text-primary` → en claro quedaría rojo de marca con Geist Mono; el público usa `font-heading` (Anton) para precios — diferencia deliberada a definir (Anton mejora la lectura de montos a distancia; mono facilita comparación vertical en grillas densas).

Portales que saldrían del scope y **necesitan decisión**:

- `PromoOptionsDialog` (agregar opciones/editar línea): portalea a body. Habría que pasarle tema claro (prop `variant` nueva o `dataTheme`) — el diálogo ya soporta ambos temas (`promo-options-dialog.tsx:253-264`).
- `ConfirmDialog` "Vaciar venta" (`sales-cart.tsx:342-352`): ya acepta `dataTheme="light"`.
- `DialogContent` de abrir/cerrar caja (`cash-register-controls.tsx:88,240`): **compartidos con `/cierre`** (oscuro). Si se aclaran en `/ventas` necesitan un prop de tema que `CajaStatus`/`CashRegisterOpenControls`/`CashRegisterCloseControls` propaguen — o permanecer oscuros (el diálogo oscuro sobre fondo claro es legible y consistente con "la caja es chrome operativo").
- Popover del tour (`.pancheria-tour-popover`, `globals.css:229-239`): usa `var(--card)` resuelto en `body` → permanece oscuro incluso sobre contenido claro. Aceptable: es overlay del driver, no del layout; si se quiere coherencia, driver.js admite estilos por popover.

### 2.3 Decisión recomendada: variante híbrida

**Chrome oscuro + contenido claro.** El `PanelHeader` y el menú mobile (`data-tour="mobile-nav"`) siguen oscuros (como ya hace el shell del panel para todas las páginas), y solo el contenido de `/ventas` —el bloque de `SalesTerminal`, incluido `CajaStatus`— va dentro de un contenedor `data-theme="light"`. Fundamentos:

1. El chrome es de navegación interna; cambiarlo para una sola página generaría discontinuidad al navegar a `/productos`, `/pedidos`, `/cierre` (que siguen oscuras).
2. El bloqueo "vender en un terminal claro con header oscuro" ya tiene precedente interno: `[data-theme='screen']` mezcla tipografías públicas sobre fondo oscuro.
3. Minimiza riesgo: los componentes compartidos del panel (`panel-header`, `branch-selector`, `mobile-nav`) no se tocan.
4. Las capturas del anexo A muestran que el lenguaje "card clara + CTA rojo + acento mostaza" convive bien con un header oscuro (es exactamente el look de la mayoría de los POS de food-delivery: barra superior oscura, lienzo claro).

**Riesgo residual:** textos `text-amber-400`/`green-400`/`violet-400` hardcodeados (badges de tipo en `product-style.ts`, `cash-register-shift-badge`) pierden contraste sobre claro; cada uso dentro del scope debe migrarse a las clases `*-700`/mapa público o a tokens.

---

## 3. Refresco en vivo del catálogo

### 3.1 Estado actual comparado

| | `/pedido` | `/ventas` |
| --- | --- | --- |
| Carga base | SSR + `loadMore` incremental | `fetchAllPages` una vez al montar |
| Refresco periódico | `useVisibilityPolling` 30 s (`usePedidoClient.ts:402-410`) — primera página + disponibilidad de extras cargados (`refreshCatalog`, líneas 302-363) + estado de sucursal | **Ninguno** |
| Validación reactiva | Debounce 300 ms contra `POST /api/public/disponibilidad` cuando cambia el carrito (`usePedidoClient.ts:412-466`); shortage **booleano** | Debounce 300 ms contra `POST /api/ventas/disponibilidad` con `productIds` de **todo el catálogo** (`sales-terminal.tsx:160-225`); shortage **detallado** (insumo, disponible, requerido) |
| Post-operación | `router.refresh()` + revalidación | `router.refresh()` + `refresh()` caja + `fetchProducts()` (`sales-terminal.tsx:369-371`) |
| Estado del local | `GET /api/public/sucursal/estado` al montar, en cada poll y al abrir checkout (`usePedidoClient.ts:296-300,538`) | `useCashRegister` ya hace polling propio cada 5 s (`src/hooks/useCashRegister.ts:73`, `getCajaRefreshInterval` en `src/config/caja.ts:163-171`) |

**Detalle clave:** el primer POST de disponibilidad del POS se dispara cuando `products` cambia de `[]` a cargado (el efecto depende de `[lines, products]`, `sales-terminal.tsx:225`), así que el estado inicial *sí* muestra disponibilidad real calculada en vivo — el hueco es todo lo que pasa **después**: ventas en otra terminal, reservas de pedidos `in_process`, cambios de stock o del catálogo. `product.availability` queda congelado y `cartAvailability` solo se corrige al próximo cambio de `lines`.

### 3.2 Opciones evaluadas para `/ventas`

1. **`GET /api/productos` paginado con `includeAvailability`** (repetir `fetchProducts`): recarga base + disponibilidad. Más pesado (N páginas × 100, re-computa disponibilidad por ítem en `productService.listActiveProductsWithAvailabilityPage`, `src/application/services/productService.ts:52-71`) pero detecta **productos nuevos/editados/eliminados**, no solo stock.
2. **`POST /api/ventas/disponibilidad` con `items` actuales + `productIds` completo**: es exactamente el precálculo que ya hace el efecto de `sales-terminal.tsx:160-225`. Liviano (un POST con ≤500 ids, `cartAvailabilitySchema`), devuelve `availabilityByProduct` + `shortageByProduct` detallado, y considera reservas activas (`collectAvailabilityLockIds`, `src/lib/product-helpers.ts:525-550`). **No detecta altas/bajas de catálogo.**
3. **Combinado (recomendado):** disponibilidad con el patrón de `refreshCatalog` — POST liviano con `items` del carrito + todos los `productIds` en cada tick (mantiene `cartAvailability` y `cartShortage` frescos, cubre ventas cruzadas y reservas) **más** un `fetchProducts()` completo a menor cadencia o al volver a visible (el `onResume` de `useVisibilityPolling` ya corre el callback inmediato, `use-visibility-polling.ts:58-68`), que es cuando importa ver un catálogo editado. El polling de caja (5 s) sigue independiente.
4. Reusar `getPedidoRefetchIntervalMs` como cadencia: funciona técnicamente, pero mezcla el tuning del tráfico público con el del panel. **Preferir variable propia** `NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS` con default propio (sugerido 15-30 s, mínimo ~5 s), siguiendo el patrón ya usado por `getCajaRefreshInterval` (default/min 5000, `config/caja.ts:32-33,163-171`) y `getPedidosRefreshIntervalMs` (`src/config/orders.ts:64` — default 0 deshabilitado; para `/ventas` conviene default habilitado porque el costo por tick es un POST acotado).
5. Comportamiento con caja cerrada: refrescar disponibilidad igual (el operador ve el catálogo antes de abrir; `addToCart` ya bloquea por `cartDisabled`, `sales-terminal.tsx:231,398`). El POST autenticado no requiere caja abierta.

**Salvaguarda obligatoria:** el bloqueo real siempre ocurre en la transacción (`POST /api/ventas` → `confirmSale`, `src/app/api/ventas/route.ts:52-59`); el polling es precheck informativo, nunca fuente de verdad. Documentar igual que hoy: los mensajes de `confirm-sale-blocker` siguen siendo la superficie de verdad en cliente.

---

## 4. Quick-add en compuestos con opcionales

### 4.1 Estado actual

- **`/pedido`:** la card no es interactiva; `add-product-${id}` agrega directo (`product-card-base.tsx:206-214`) y `customize-product-${id}` (SlidersHorizontal) abre el diálogo con `initialSelectedIds = selectedByDefault` (líneas 192-205, 219-238). Click total: **1** para el caso por defecto.
- **`/ventas`:** toda la card es `role="button"` (`product-card-base.tsx:250-264`); `addToCart` abre `PromoOptionsDialog` siempre que `hasOptionalRecipeItems(product)` (`sales-terminal.tsx:234-238`). Los opcionales ya vienen con `selectedByDefault` marcado porque el diálogo cae al default cuando `initialSelectedIds` es `undefined` (`promo-options-dialog.tsx:171-176`). Click total: **2** (card → "Agregar a la venta").
- **El motor ya soporta quick-add:** `useSellableCart.addItem(product)` sin selección aplica `getDefaultSelectedRecipeItemIds` y capea a `maxOptionalSelections` (`useSellableCart.ts:93-100`), crea línea propia por unidad personalizable (nunca fusiona, líneas 107-138), respeta agotados (`onOutOfStock`, líneas 145-148) y el stepper del diálogo ya está acotado por `getProductAdditional` (`sales-terminal.tsx:498-508`).

### 4.2 Opciones para el POS

| Opción | Descripción | Riesgo E2E |
| --- | --- | --- |
| A — Patrón catálogo | La card deja de ser `role="button"`; dos botones reales: "Agregar" (quick-add) + icono "Personalizar" (`customize-sale-product-${id}` o similar) | **Alto:** los specs hacen click a `[data-testid="product-card"][data-product-name]` para abrir el diálogo y personalizar (§7) |
| B — Click = quick-add, editar desde la línea | La card sigue siendo `role="button"`; el click agrega con defaults y la personalización se hace con el botón "Editar" que ya existe en `SalesCart` (`sales-cart.tsx:246-258`) | Medio: mismo cambio de semántica del click |
| C — Conservador | Mantener click → diálogo (defaults ya precargados); solo mejorar el diálogo (Enter confirma, foco inicial en CTA) | Nulo |
| D — Híbrido recomendado | Card `role="button"` = quick-add con defaults **y** botón separado de personalización *fuera* del área clickeable (p. ej. icono en esquina tipo `customize-product-${id}` del catálogo, con `stopPropagation`) | Medio: requiere sacar el botón del flujo del `role="button"` (anidar botones en `role="button"` es inválido ARIA) — conviene renderizar la variante sales como card con botones reales, igual que catalog |

**Recomendación:** **A/D convergen**: adoptar la estructura de la variante `catalog` (card presentacional + "Agregar" + "Personalizar") dentro de la variante `sales`, manteniendo `data-testid="product-card"` + `data-product-name` en el contenedor y agregando testids nuevos para los dos controles. Así el click en "Agregar" es 1 click, "Personalizar" abre el diálogo, y los tests se migran de "click en card" a "click en `add-sale-product`" con cambios mecánicos. La edición por línea (`Editar` → `mode="edit"`) no cambia.

**Velocidad de mostrador:** para el caso común "pancho completo con sus aderezos por defecto", el POS pasa de 2 clicks + scroll en diálogo a 1 click; para personalizaciones el costo se mantiene. Los agotados no se pueden superar: `useSellableCart` rechaza la línea y `ProductCardSalesExtra` ya muestra "Sin stock"/"Podés sumar N más" (`product-card-sales-extra.tsx:18`).

---

## 5. Agrupado y paginación

- **Público:** `groupPublicProductsByType` (`src/lib/catalog.ts:39-43`) delega en `groupProductsByType` (`src/lib/product-grouping.ts:8-56`) con `typePriority` (compound→critical_supply→manual→service) + `criticalSupplyTypePriority` (bread→sausage→beverage) + alfabético; headers con `publicProductTypeLabels` y `publicProductTypeGroupClasses` (`src/lib/product-style.ts:16-21,75-80`); paginación `getCatalogPageSize` (default 48, `src/config/catalog.ts:24-32`) + "Cargar más".
- **POS:** `sortSellableProducts` (`src/lib/ventas-helpers.ts:22-31`) produce **el mismo orden** (compound→beverage→service→resto, alfabético dentro) pero sin headers; `fetchAllPages` recorre todo con `MAX_LIMIT=100` (`src/config/pagination.ts:4`) y el precheck envía `products.map(p => p.id)` — todo el catálogo (`sales-terminal.tsx:183`).

**Trade-off paginación:** paginar el POS rompería dos cosas que dependen del set completo: el precálculo de disponibilidad (los `productIds` cubren todo lo cargado) y el toggle `toggle-show-out-of-stock` (que muestra agotados aunque no estén en pantalla). Además, "Cargar más" en medio de una venta es fricción operativa. **Recomendación: mantener carga completa con `fetchAllPages`** (100/requests — catálogos típicos de 35-80 ítems resuelven en 1 request) y adoptar solo el agrupado visual.

**Agrupado para el POS:** reusar `groupProductsByType` sobre `displayProducts` (resulta trivial: el orden ya coincide) con headers. Decisión abierta de etiquetas: `publicProductTypeLabels` ("Combos y promos / Bebidas / Extras") es lenguaje de cliente; `productTypeLabels` ("Promo / Insumo crítico / Servicio") es jerga interna correcta pero más fría. Sugerencia: crear `salesProductTypeLabels` = ["Combos y promos", "Bebidas", "Servicios y extras"] y un mapa de clases claras (o reusar `publicProductTypeGroupClasses` si el contenido va en tema claro). Mantener `data-tour="sales-products"` envolviendo los grupos para no romper el tour (§7).

---

## 6. Funciones exclusivas del POS a preservar

Todo ítem de esta lista es contrato operativo: ninguna recomendación del informe debe degradarlo.

| Función | Ubicación | Por qué no existe en `/pedido` |
| --- | --- | --- |
| `CajaStatus` (abrir/cerrar/forzar cierre, alertas, autocierre, `cash-register-opened-by`) | `sales-terminal.tsx:402-416`, `src/components/caja/caja-status.tsx`, `cash-register-controls.tsx` | El público solo consulta estado (`/api/public/sucursal/estado`) |
| Bloqueo de venta con caja cerrada (`cartDisabled`, `cart-closed-register`) | `sales-terminal.tsx:231,398`; `sales-cart.tsx:126-134` | — |
| Pago mixto efectivo/transferencia con atajos "Todo en X" y `payment-remaining-message` | `sales-cart.tsx:288-296`; `payment-parts-input.tsx:103-152`; `usePaymentParts` redistribute (`sales-terminal.tsx:305-310`) | El pedido público no cobra |
| Shortage interno detallado `cart-item-shortage` ("falta {insumo} (disponible N, requerido M)") | `sales-cart.tsx:204-213` | Público: `shortageByProduct: boolean` + `publicShortageMessage` (`cart-summary.tsx:129-137`, `pedido-client.tsx:111-122`) |
| Disponibilidad restante por card ("Podés sumar: N más", "Sin stock") | `product-card-base.tsx:312-317`, `product-card-sales-extra.tsx` | Público: disponibilidad cualitativa sr-only (`product-card-availability.tsx:22-32`) |
| Toggle `toggle-show-out-of-stock` | `sales-terminal.tsx:422-431` | Público oculta agotados vía disable |
| Idempotencia `idempotencyKey = saleSignature(items, payments)` con persistencia en reintentos | `sales-terminal.tsx:60-61,356-358`; `use-submit-idempotency-key.ts` | Público: `checkoutSignature` (`usePedidoClient.ts:187`) |
| Edición de línea (`mode="edit"`, `initialSelectedIds`, `initialNotes`) | `sales-terminal.tsx:273-303,517-534` | Existe también en público (paridad ya) |
| Notas por ítem `cart-item-note` | `sales-cart.tsx:196-203` | Paridad (`cart-summary.tsx:121-128`) |
| Blocker textual `confirm-sale-blocker` con razón específica | `sales-cart.tsx:83-99,317-325` | Público: `checkout-blocker` genérico |
| Barra móvil `cart-mobile-bar` | `sales-cart.tsx:354-372` | Público: `mobile-cart-bar` (pill) |
| Confirm "Vaciar venta" | `sales-cart.tsx:342-352` | Paridad ("Vaciar pedido" con `dataTheme="light"`) |
| `data-tour` anchors | `caja-status`, `sales-products`, `sales-cart`, `payment-parts-input`, `mobile-nav` | El tour es interno |
| Historial `/ventas/historial` | `sales-history.tsx` | Fuera de scope de esta auditoría (página separada, permanece oscura) |

---

## 7. Riesgos E2E y del tour

### 7.1 Selectores bajo contrato

**POS (no romper sin migrar specs):**
- Card: `[data-testid="product-card"][data-product-name]` + `data-out-of-stock`, `role="button"`, `aria-disabled` (`product-card-base.tsx:250-264`).
- Catálogo: `toggle-show-out-of-stock`.
- Carrito: `cart-item` + `data-line-id`/`data-product-id`/`data-product-name`, `cart-item-note`, `cart-item-shortage`, `cart-item-remove`, `cart-item-count`, `cart-clear`, `empty-cart-message`, `cart-closed-register`, `cart-mobile-bar`, `confirm-sale-button`, `confirm-sale-blocker`, `sale-error`.
- Cobro: `payment-cash-input`, `payment-transfer-input`, `payment-cash-full`, `payment-transfer-full`, `payment-remaining-message`.
- Caja: `open-cash-register`, `confirm-open-cash-register`, `close-cash-register`, `confirm-close-cash-register`, `cash-register-empty-message`, `cash-register-opened-by`, `closing-*-input`, `forced-close-reason-input`.
- Promos: `promo-options-confirm`, `promo-quantity-decrease/-increase/-value`, `promo-options-included`, `promo-options-limit`, switches `role="switch" aria-label="Incluir …"`.
- Tour: `data-tour="caja-status"`, `sales-products`, `sales-cart`, `payment-parts-input`, `mobile-nav`.

**Público (referencia, ya en uso):** `product-card-${id}`, `add-product-${id}`, `customize-product-${id}`, `product-card-cart-quantity-${id}`, `product-availability` (sr-only), `catalog-load-more`, `catalog-empty-state`, `mobile-cart-bar`, `checkout-button`, `checkout-blocker`, `confirm-order-button`, `branch-select-*`, `branch-status-chip`, `pedido-steps`, `cart-title`, `single-branch-indicator`.

### 7.2 Specs afectados por cada cambio candidato

| Cambio | Specs en riesgo | Nota |
| --- | --- | --- |
| Quick-add / cambio del click de card | `ventas-disponibilidad.spec.ts` (11 usos: personaliza dos variantes del mismo producto), `ventas-stock-compartido.spec.ts`, `ventas-pago-mixto.spec.ts`, `ventas-historial.spec.ts`, `paso3.spec.ts`, `paso4.spec.ts`, `flujo-diario.spec.ts`, `ux-perfiles.spec.ts` | Migración mecánica: click en card → click en `add-sale-product-${id}` o en el nuevo control |
| Agrupado con headers | Ninguno por selectores; el tour espera `data-tour="sales-products"` — conservar el atributo en el contenedor de grupos | `tour.spec.ts:125-126` |
| Tema claro | Ninguno por selectores; riesgo visual en `accessibility.spec.ts` y revisión manual de contraste (`*-400` sobre claro) | Validar con axe tras implementar |
| Refresco periódico | `ventas-disponibilidad` (estados pueden cambiar mid-test si otra sesión vende — en E2E la base es descartable y aislada, riesgo bajo); vigilar flakes por timing | Mantener el precheck reactivo como hoy |
| Barra móvil / estructura del carrito | `responsive.spec.ts`, `ventas-*.spec.ts` que usan `cart-mobile-bar` | Renombrar a `mobile-cart-bar` rompe specs; mantener ambos o migrar |

**Recomendación de identificadores:** mantener la convención ya establecida por `ProductCardBase` (testids por variante, `product-card-base.tsx:77-79`): conservar `product-card`/`data-product-name` en el contenedor de la variante `sales` y **agregar** `add-sale-product`/`customize-sale-product` para los nuevos controles — así los specs que solo verifican presencia/clase siguen pasando y solo migran los que dependen de la interacción del click.

---

## 8. Matriz comparativa final y propuesta de fases

### 8.1 Matriz

| Aspecto | `/pedido` | `/ventas` | Brecha | Recomendación | Prioridad | Esfuerzo | Riesgo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tema | Claro `[data-theme='light']` scoped | Oscuro global | Visual + tokens `*-400`/`border-white/*` hardcodeados | Híbrido: contenido claro, chrome oscuro; portales con `dataTheme` | Alta | Medio | Medio (contraste, portales compartidos con `/cierre`) |
| Refresco catálogo | Polling 30 s + visibilidad | Solo montaje + reactivo + post-venta | Datos stale entre terminales/pedidos | `useVisibilityPolling` + POST disponibilidad con todos los ids; `fetchProducts` al reanudar; env propia | Alta | Bajo-Medio | Bajo (precheck, no muta) |
| Quick-add opcionales | 1 click + customize aparte | Siempre diálogo (2 clicks) | Velocidad de mostrador | Card con botones reales: `add-sale-product` + `customize-sale-product` | Alta | Medio | Alto en specs (migración mecánica) |
| Agrupado | Headers por tipo | Plano | Escaneo visual | `groupProductsByType` + labels/clases POS; conservar `sales-products` | Media | Bajo | Bajo |
| Paginación | SSR + "Cargar más" | `fetchAllPages` completo | Ninguna real (POS necesita set completo) | **Mantener carga completa** | — | — | — |
| Card | Hero + pill PROMO + CTA | Plana informativa | Densidad vs claridad | Evaluar hero opcional; conservar "Podés sumar"/badges | Baja | Medio | Medio (densidad) |
| Estado vacío catálogo | `catalog-empty-state` | Ausente | Feedback | Agregar mensaje equivalente | Baja | Bajo | Nulo |
| Barra móvil | Pill `mobile-cart-bar` | Barra `cart-mobile-bar` | Consistencia | Unificar visual (pill) conservando testid | Baja | Bajo | Bajo |
| Diálogo opciones | `variant="public"` (hero, bottom-sheet) | `variant="sales"` (oscuro, centrado) | Tema si /ventas aclara | Prop de tema; decidir si hero entra al POS | Media | Bajo | Bajo |
| Caja en catálogo | `BranchStatusChip`/horarios | `CajaStatus` operativo | Ninguna (POS superior) | Preservar | — | — | — |
| Shortage | Booleano público | Detallado interno | Ninguna (POS superior) | Preservar | — | — | — |
| Pago | Sin cobro | `PaymentPartsInput` mixto | Ninguna | Preservar | — | — | — |
| Idempotencia | `checkoutSignature` | `saleSignature` | Ninguna | Preservar | — | — | — |

### 8.2 Propuesta de fases (sin ejecutar)

**Fase 1 — Tema y estructura** *(prioridad alta, sin cambios funcionales)*
1. Envolver el contenido de `/ventas` en `data-theme="light"` (contenedor en `ventas/page.tsx` o raíz de `SalesTerminal`), chrome oscuro.
2. Migrar `border-white/10` → `border-border` en `sales-cart.tsx:282,288` y auditar clases `*-400`/`*-300` dentro del scope (`product-style.ts`, `cash-register-shift-badge.tsx`).
3. Pasar tema claro a portales: `ConfirmDialog` "Vaciar venta" (`dataTheme="light"`), `PromoOptionsDialog` (prop nueva o `dataTheme`), diálogos de caja (prop propagado por `CajaStatus` — decidir vs. dejarlos oscuros como "chrome operativo").
4. Headers de grupo con `groupProductsByType` + `salesProductTypeLabels`/`publicProductTypeGroupClasses`; estado vacío de catálogo.
5. Verificaciones sugeridas para esa fase: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e` con `.env.e2e` en base descartable, `npm run test:accessibility`, revisión visual 1280/390.

**Fase 2 — Funciones** *(prioridad alta, comportamiento)*

> **Estado parcial (2026-10-25):** ítems 1–2 (refresco en vivo del catálogo) **implementados** — `src/config/ventas.ts` (`getVentasCatalogRefreshIntervalMs`: default 30000 ms, mínimo 5000 ms, `0` deshabilita) + `useVisibilityPolling` en `SalesTerminal` con tick silencioso a `POST /api/ventas/disponibilidad` y `onResume` → `fetchProducts({ silent: true })`. Restan quick-add (ítem 3) y la migración de specs (ítem 4).

1. `NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS` en `src/config/` (default 15-30 s, mínimo ~5 s). ✅
2. `useVisibilityPolling` en `SalesTerminal`: tick = POST `/api/ventas/disponibilidad` `{items, productIds: todos}` (reusa el efecto actual); `onResume`/intervalo mayor = `fetchProducts()`. ✅
3. Quick-add: reestructurar variante `sales` de `ProductCardBase` a card con botones reales (`add-sale-product`, `customize-sale-product`), conservando `product-card`/`data-product-name`/`data-out-of-stock` en el contenedor; `addToCart` deja de abrir el diálogo salvo desde el control de personalizar.
4. Migración mecánica de specs ventas-* (§7.2) + tests unitarios de `sales-terminal.test.tsx` (`[data-slot="card"]`).

**Fase 3 — Pulido** *(prioridad media/baja, opcionales)*
1. Evaluar hero/imagen en card `sales` (densidad vs. reconocimiento — capturas anexo A).
2. `variant` del diálogo con tema claro para `/ventas` (o `data-theme` neutro), decisión sobre bottom-sheet mobile.
3. Unificación visual de la barra móvil (pill) conservando `cart-mobile-bar`.
4. Documentar en `lecciones-aprendidas.md` el patrón "contenido claro + chrome oscuro" si se adopta en otras páginas del panel.

---

## Anexo A. Evidencia visual

Capturas del 2026-10-25 contra `neondb_dev` (`.env.local`), en `.devin/informes/shots/` (no trackeado, `.gitignore`):

- `pedido-desktop.png` (1280×900): tema claro cálido, hero con gradiente marca + monograma fallback, pill PROMO, precio Anton rojo, CTA "Agregar" + botón circular de personalizar, header de grupo "Combos y promos", carrito claro sticky.
- `ventas-desktop.png` (1280×900): terminal oscuro, `CajaStatus` con caja cerrada, cards planas con badges "Promo"/"+18 opcionales", "Disponible: 10 unidad", "Incluye: …" con insumos internos, "Podés sumar: 10 más", carrito con aviso amber, inputs Efectivo/Transferencia.
- `pedido-mobile.png` (390×844): hero con foto real de producto, mismo lenguaje.
- `ventas-mobile.png` (390×844): card plana oscura con toda la info interna; menú hamburguesa en header.

La comparación directa evidencia: (a) el lenguaje visual del rediseño es portable al POS, (b) la card del POS muestra más información operativa por ítem (insumos incluidos, disponible, "podés sumar") — si se adopta hero hay que reubicarla, (c) el contraste chrome oscuro / contenido claro es la variante híbrida recomendada en §2.3.

## Anexo B. Variables y endpoints relevantes

| Variable / endpoint | Default / contrato | Uso actual |
| --- | --- | --- |
| `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` | 30000, min 1000 (`config/catalog.ts:8-16`) | Polling `/pedido` |
| `NEXT_PUBLIC_CATALOG_PAGE_SIZE` | 48 (`config/catalog.ts:24-32`) | Paginación pública |
| `PUBLIC_CATALOG_CACHE_S_MAXAGE` / `PUBLIC_CATALOG_CACHE_SWR` | 10 s / 30 s (`config/catalog.ts:34-69`) | Headers CDN `GET /api/public/catalogo` (`route.ts:44-49`) |
| `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` | 5000, min 5000 (`config/caja.ts:163-171`) | Polling caja (panel) |
| `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` | 0 = deshabilitado (`config/orders.ts:64`) | Lista `/pedidos` |
| `GET /api/productos?includeAvailability=true` | Paginado, `MAX_LIMIT=100`, auth | Carga inicial POS |
| `POST /api/ventas/disponibilidad` | `{items, productIds≤500}` → `availabilityByProduct` + `shortageByProduct` detallado, auth | Precheck POS |
| `POST /api/public/disponibilidad` | Mismo schema → shortage **booleano**, rate-limit de poll | Precheck público |
| `POST /api/ventas` | `confirmSale` transaccional + `idempotencyKey` | Bloqueo real de stock |
| `GET /api/public/sucursal/estado` | `isOpen` = caja abierta ∩ horarios | Estado público del local |
