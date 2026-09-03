# Prompt: Plan de implementación — pedidos con múltiples líneas del mismo producto personalizado

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />

## Estado actual relevante

El flujo de pedidos permite a un cliente anónimo armar un carrito, personalizar promos (`compound`) con insumos opcionales a través de `PromoOptionsDialog`, completar sus datos y enviar un pedido `pending`. El operador confirma el pedido desde `/pedidos`. El terminal de ventas (`/ventas`) permite al operador armar un pedido similar, confirmarlo como venta y registrar pagos.

La base de datos ya soporta múltiples líneas del mismo producto con personalizaciones distintas: `order_items` y `sale_items` tienen cada uno su tabla de recetas (`order_item_recipes` y `sale_item_recipes`) y `buildSaleItemValues` genera un ítem por entrada del array de entrada. Sin embargo, el carrito del cliente (`useCart`) y el del operador (`sales-terminal`) agrupan por `productId`, de modo que si se agrega el mismo producto con distintas selecciones de receta, se unen en una sola línea conservando la personalización del primer agregado. Además, el diálogo de checkout no muestra el resumen de ítems antes de confirmar; el cliente solo ve el total y el formulario de datos.

Los `data-testid` del carrito (`cart-item-${product.id}`), de las tarjetas de producto (`product-card-${product.id}`, `add-product-${product.id}`) y los selectores de test E2E actuales asumen una única línea por `productId`, por lo que el cambio a múltiples líneas requiere una migración coordinada de los identificadores de DOM y de los tests.

Archivos centrales del flujo vigente:
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-customer-form.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-cart-section.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-cart.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-product-card.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/ventas-helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/recipe-helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />

Tests a modificar o extender:
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.test.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.test.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.test.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido.spec.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-sucursal-y-stock.spec.ts" />

## Objetivo

Permitir que el cliente y el operador puedan armar un pedido con **varias unidades del mismo producto personalizado de forma distinta**, garantizando que:

1. Cada variante se guarde como una línea independiente del carrito.
2. El cliente pueda ver el resumen completo de su pedido (productos, cantidades y personalizaciones) antes de confirmarlo.
3. El operador pueda realizar el mismo tipo de pedido desde el terminal de ventas sin regresiones.
4. El backend reciba un array de ítems correcto y genere el pedido/venta con snapshots de receta separados.

El alcance es **frontend y lógica de carrito**. El backend ya soporta múltiples líneas del mismo `productId`; no se requieren cambios de esquema ni migraciones.

## Reglas de negocio

1. Una **línea de carrito** (`CartItem`) es una unidad identificable de producto + cantidad + selección de receta. No se identifica solo por `productId`.
2. Dos agregados del mismo producto con distintas `selectedRecipeItemIds` deben generar **dos líneas de carrito distintas**.
3. Dos agregados del mismo producto con las **mismas** `selectedRecipeItemIds` pueden unirse en una sola línea incrementando la cantidad.
4. El cliente y el operador deben poder **editar la personalización** de una línea existente sin romper el resto del pedido.
5. Si una edición de personalización hace que dos líneas queden idénticas, deben unirse automáticamente en una sola línea con la cantidad sumada.
6. El checkout del cliente debe mostrar el **resumen del pedido** (lista de ítems con cantidades y detalle de recetas) además del formulario de datos.
7. La experiencia del operador en `/ventas` debe ser equivalente: carrito con líneas identificables, edición de personalización y preview antes de confirmar la venta.
8. El total del carrito se calcula sumando `price * quantity` de cada línea, sin cambios en la lógica de precios.
9. La disponibilidad y el stock se calculan considerando cada línea individual con su propia selección, agregando el consumo de insumos al total del carrito. El límite de cantidad por línea es la disponibilidad global del producto según el catálogo; la validación final se realiza en el backend con `validateCartAvailability`.
10. Los tests unitarios y E2E deben cubrir el caso de dos líneas del mismo producto con personalizaciones distintas.
11. La migración del carrito almacenado en `localStorage` y de los `data-testid` debe hacerse de forma coordinada para no romper tests ni perder carritos activos.

## Implementación detallada por fases

> Ejecutar cada fase de forma independiente, verificando `npx tsc --noEmit`, `npm run lint`, `npm test` y `npm run build` antes de pasar a la siguiente.

---

### Fase 0 — Preparación: storage, `data-testid` y arquitectura de edición

#### Objetivo
Resolver los tres temas transversales antes de introducir `lineId`, para evitar tocar dos veces la misma superficie: migración del carrito en `localStorage`, actualización de los `data-testid` de carrito y definición de dónde y cómo se monta el diálogo de edición.

#### 0.1 — Decisión de migración del carrito en `localStorage`

El storage key vigente es `pancheria-cart-v1`. Se agregará un campo `lineId` a los ítems persistidos. Elegir UNA de las dos estrategias:

- **Opción A (recomendada): backward compatible.** `lineId` se declara como `z.string().optional()` en `cartItemSchema`. En `getInitialItems`, si un ítem restaurado no tiene `lineId`, se le asigna uno con `nanoid()` antes de devolverlo. El `version` sigue siendo `pancheria-cart-v1`.
- **Opción B: bump de versión.** Cambiar `version` a `pancheria-cart-v2` y descartar carritos de `pancheria-cart-v1`. Simplifica el schema pero pierde carritos activos.

Se recomienda la Opción A.

#### 0.2 — `data-testid` del carrito

Cambiar en `src/components/pedido/cart-summary.tsx`:
- `key={item.id}` → `key={item.lineId}`.
- `data-testid={`cart-item-${item.id}`}` → `data-testid={`cart-item-${item.lineId}`}`.
- Agregar `data-product-id={item.id}` en cada `<li>` para mantener tests que buscan por producto.

Cambiar en `src/components/ventas/sales-cart.tsx`:
- `key={item.product.id}` → `key={item.lineId}` (una vez que `CartItem` tenga `lineId`).
- Agregar `data-testid={`sales-cart-item-${item.lineId}`}` y `data-product-id={item.product.id}`.

Actualizar los tests que dependen de los `data-testid` anteriores:
- `src/components/pedido/pedido-client.test.tsx`
- `tests/e2e/pedido.spec.ts`
- `tests/e2e/pedido-sucursal-y-stock.spec.ts`

#### 0.3 — Arquitectura del diálogo de edición

Definir quién monta `PromoOptionsDialog` para editar una línea:

- **Flujo del cliente:** el diálogo se eleva a `PedidoClient` (igual que en `sales-terminal`). `usePedidoClient` expone:
  - `editingLine: { lineId: string; product: PublicCatalogProduct; initialSelectedIds: number[] } | null`
  - `startEditLine(lineId: string)`
  - `cancelEditLine()`
  - `confirmEditLine(selectedRecipeItemIds: number[])`

  `CartSummary` recibe `onEditLine(lineId: string)` y `PedidoClient` renderiza `PromoOptionsDialog` cuando `editingLine !== null`.

- **Flujo del operador:** el diálogo ya vive en `sales-terminal.tsx` (gestionado por `promoDialogProduct`). Extenderlo para soportar edición:
  - `editingLine: { lineId: string; product: SellableProduct; initialSelectedIds: number[] } | null`
  - `startEditLine(lineId: string)`
  - `confirmEditLine(lineId: string, selectedRecipeItemIds: number[])`

  `SalesCart` recibe `onEditLine(lineId: string)`.

#### 0.4 — `PromoOptionsDialog` en modo edición

Extender `src/components/promo/promo-options-dialog.tsx`:
- Agregar prop opcional `mode?: 'add' | 'edit'` (default `'add'`).
- Agregar prop opcional `confirmLabel?: string`.
- Si `mode === 'edit'`, el botón de confirmación dice "Guardar cambios" (o lo que indique `confirmLabel`).
- El título puede mantenerse como `productName`, pero el diálogo debe reflejar visualmente que se está editando una línea existente.

#### 0.5 — Lógica de unión de líneas idénticas

Centralizar la comparación de selecciones en un helper reutilizable:

- `src/lib/cart-helpers.ts` (nuevo) o `src/lib/ventas-helpers.ts`:
  ```ts
  export function areRecipeSelectionsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x - y);
    const sortedB = [...b].sort((x, y) => x - y);
    return sortedA.every((id, i) => id === sortedB[i]);
  }
  ```

Este helper se usará en `useCart.addItem`, `useCart`/`usePedidoClient` para edición, y en `sales-terminal`.

#### Tests
- No se esperan cambios de comportamiento en esta fase; verificar que `npm test` siga pasando tras los ajustes de `data-testid`.

---

### Fase 1 — Identificador único por línea de carrito

#### Objetivo
Introducir un `lineId` inmutable por línea del carrito para poder distinguir múltiples líneas del mismo `productId`.

#### `src/hooks/useCart.ts`
- Importar `nanoid`.
- Agregar `lineId: string` a `CartItem`.
- Generar `lineId` con `nanoid()` en cada nueva línea.
- Actualizar `cartItemSchema` para incluir `lineId` (de acuerdo a la estrategia elegida en Fase 0).
- Actualizar `storedCartSchema` para incluir `lineId`.
- En `getInitialItems`, asignar `lineId` si falta (Opción A) o descartar carritos viejos (Opción B).
- Cambiar `removeItem` para recibir `lineId` en lugar de `productId`.
- Cambiar `updateQuantity` para recibir `lineId`.
- Cambiar `updateSelectedRecipeItemIds` para recibir `lineId`.
- Ajustar `addItem` para comparar `productId` **y** `selectedRecipeItemIds` ordenados al decidir si unir o crear nueva línea.
- Asegurar que el estado inicial del servidor sea un arreglo vacío para evitar hydration mismatch (patrón ya vigente).

#### `src/lib/ventas-helpers.ts`
- Agregar `lineId: string` a `CartItem`.
- Exportar `areRecipeSelectionsEqual(a, b)`.

#### `src/components/pedido/cart-summary.tsx` y `src/components/ventas/sales-cart.tsx`
- Usar `lineId` como `key` de React.
- Pasar `lineId` a `onUpdateQuantity`, `onRemove` y, en Fase 3, `onEditLine`.
- Cambiar los `data-testid` según Fase 0.

#### `src/components/pedido/pedido-cart-section.tsx`
- Ajustar props de `onUpdateQuantity` y `onRemove` para recibir `lineId`.

#### `src/components/pedido/usePedidoClient.ts`
- Ajustar las funciones expuestas (`removeItem`, `updateQuantity`, `updateSelectedRecipeItemIds`) para usar `lineId`.

#### Tests
- `src/hooks/useCart.test.ts`:
  - Dos agregados del mismo producto con `selectedRecipeItemIds` distintas crean dos líneas.
  - `removeItem(lineId)` elimina solo la línea indicada.
  - `updateQuantity(lineId, n)` modifica solo la línea indicada.
  - Al agregar un producto con la misma selección de una línea existente, se incrementa la cantidad.

---

### Fase 2 — Separar agregados por personalización en el flujo del cliente

#### `src/hooks/useCart.ts`
- En `addItem`, usar `areRecipeSelectionsEqual` para comparar la selección entrante con cada línea existente del mismo producto:
  - Si existe una línea con el mismo producto y la misma selección, incrementar cantidad respetando `availability`.
  - Si no, crear una nueva línea con `lineId` nuevo.
- La cantidad máxima sigue usando `getAvailability(product.id)`. El backend valida el consumo real de insumos al enviar y `usePedidoClient` muestra el `shortageByProduct` resultante.

#### `src/components/pedido/product-card.tsx`
- Al hacer clic en un producto `compound` con opcionales, abrir `PromoOptionsDialog` con `initialSelectedIds` iguales a la selección por defecto del producto.
- Al confirmar, llamar `onAdd(selectedRecipeItemIds)`; `useCart.addItem` decidirá si une con una línea existente o crea una nueva.
- `buttonLabel`:
  - Producto `compound` con opcionales: siempre "Personalizar".
  - Producto sin opcionales y `inCart`: "Agregar otro".
  - Producto sin opcionales y no en carrito: "Agregar".
- Agregar prop `inCartQuantity?: number` y mostrar el badge con la cantidad total en carrito (no solo `inCart` booleano).
- Ajustar `data-testid` del botón a `add-product-${product.id}` (sin cambios) y agregar `data-in-cart-quantity` si es necesario para tests.

#### `src/components/pedido/pedido-catalog-section.tsx`
- Calcular `inCartQuantityByProduct` sumando `quantity` de todas las líneas del mismo `productId`.
- Pasar `inCartQuantity` a `ProductCard` en lugar de `inCart` booleano. Mantener `inCart` como `inCartQuantity > 0` para compatibilidad interna si es necesario.

#### `src/components/pedido/usePedidoClient.ts`
- Asegurar que `handleSubmitCheckout` envíe `items` como array con las `selectedRecipeItemIds` de cada línea, sin agrupar.
- Exponer `inCartQuantityByProduct` para `PedidoCatalogSection` o calcularlo allí.

#### Tests
- `src/components/pedido/product-card.test.tsx`:
  - Abrir `PromoOptionsDialog` al hacer clic en un producto con opcionales.
  - Mostrar la cantidad total en el badge cuando hay múltiples líneas.
- `src/hooks/useCart.test.ts`:
  - Agregar dos veces el mismo producto con selecciones distintas produce dos líneas.
  - Agregar dos veces el mismo producto con selecciones iguales produce una línea con cantidad 2.

---

### Fase 3 — Edición de personalización desde el carrito del cliente

#### `src/components/pedido/cart-summary.tsx`
- Para productos `compound` con opcionales, agregar un botón "Editar" en cada línea.
- Al editar, llamar `onEditLine(lineId)`.
- Pasar `lineId` a `onUpdateQuantity`, `onRemove` y `onEditLine`.

#### `src/components/pedido/usePedidoClient.ts`
- Agregar estado `editingLine: { lineId: string; product: PublicCatalogProduct; initialSelectedIds: number[] } | null`.
- Implementar `startEditLine(lineId: string)` que busque la línea en `items`, encuentre el producto en `products` y setee `editingLine` con `initialSelectedIds`.
- Implementar `confirmEditLine(selectedRecipeItemIds: number[])`:
  - Buscar la línea editada por `lineId`.
  - Buscar si existe otra línea del mismo `productId` con la misma selección (usando `areRecipeSelectionsEqual`).
  - Si existe, sumar `quantity` de la línea editada a la otra línea y eliminar la línea editada.
  - Si no, actualizar solo `selectedRecipeItemIds` de la línea editada.
  - Cerrar `editingLine`.
- Implementar `cancelEditLine()` para cerrar el diálogo sin cambios.

#### `src/components/pedido/pedido-client.tsx`
- Renderizar `PromoOptionsDialog` controlado por `editingLine`.
- Pasar `mode="edit"` y `confirmLabel="Guardar cambios"` cuando corresponda.
- Al confirmar, llamar `confirmEditLine`.
- Al cerrar, llamar `cancelEditLine`.

#### `src/components/promo/promo-options-dialog.tsx`
- Usar `mode` y `confirmLabel` definidos en Fase 0.
- Asegurar que `initialSelectedIds` se respete al abrir en modo edición.

#### `src/components/pedido/pedido-cart-section.tsx`
- Recibir `onEditLine(lineId: string)` y pasarlo a `CartSummary`.

#### Tests
- `src/components/pedido/product-card.test.tsx` o `cart-summary.test.tsx` (nuevo): editar una línea con opciones.
- `src/hooks/useCart.test.ts`: editar una línea y verificar que se unen si la selección coincide.
- Test E2E: agregar dos variantes, editar una y verificar que el pedido refleja el cambio.

---

### Fase 4 — Preview del pedido antes de confirmar

#### `src/components/pedido/pedido-client.tsx`
- En el `Dialog` de checkout, mostrar el resumen de ítems encima del formulario del cliente.
- Reutilizar `CartSummary` (sin botones de cantidad/editar) o un componente nuevo `CheckoutSummary`.

#### Componente nuevo (opcional): `src/components/pedido/checkout-summary.tsx`
- Listar ítems con cantidad, nombre, precio unitario, subtotal y resumen de recetas (`formatRecipeSummary`).
- Usar en el diálogo de checkout.

#### `src/components/pedido/pedido-customer-form.tsx`
- Mantener el total visible, ya sea en `CheckoutSummary` o conservando la sección de total existente.

#### Tests
- `src/components/pedido/pedido-client.test.tsx`: verificar que el checkout muestre el detalle de personalizaciones.
- Tests E2E o de integración: verificar que el checkout muestre el detalle de personalizaciones.

---

### Fase 5 — Equivalencia en el terminal de ventas del operador

#### `src/components/ventas/sales-terminal.tsx`
- Generar `lineId` al agregar una nueva línea.
- En `addToCart`, comparar `product.id` y `selectedRecipeItemIds` usando `areRecipeSelectionsEqual` para decidir unir o crear nueva línea.
- Cambiar `removeFromCart` y `updateQuantity` para recibir `lineId`.
- Agregar `editingLine` y `startEditLine(lineId)`, `confirmEditLine(lineId, selectedIds)`, `cancelEditLine()`.
- Implementar la unión de líneas si la edición resulta idéntica a otra existente.
- Al confirmar la venta, enviar `items` como array con `selectedRecipeItemIds` de cada línea.

#### `src/components/ventas/sales-cart.tsx`
- Usar `lineId` como `key`.
- Agregar botón "Editar" en líneas de productos `compound` con opcionales.
- Pasar `lineId` a `onUpdateQuantity`, `onRemove` y `onEditLine`.

#### `src/lib/ventas-helpers.ts`
- Agregar `lineId` a `CartItem`.
- Exportar `areRecipeSelectionsEqual` (si vive aquí) o importarlo desde `cart-helpers`.

#### `src/components/ventas/sales-product-card.tsx`
- Ajustar badge "en pedido" para reflejar cantidad total del producto. Si hay múltiples líneas, seguir mostrando la suma total; se puede agregar `data-line-count` para tests si es necesario.
- Asegurar que al hacer clic en un producto con opcionales se abra el diálogo (`sales-terminal` lo gestiona). No se requieren cambios mayores.

#### Tests
- `src/components/ventas/sales-terminal.test.tsx`:
  - Dos agregados del mismo producto con selecciones distintas crean dos líneas.
  - Editar una línea actualiza la selección.
  - Confirmar venta envía el array de ítems correcto.

---

### Fase 6 — Tests E2E y cobertura

#### Tests E2E sugeridos
- Crear un pedido con dos unidades del mismo producto pero con opcionales distintos.
- Verificar en el panel del operador que el pedido muestra ambas líneas con sus respectivas recetas.
- Verificar en el chat que el mensaje de preparación refleja ambas configuraciones.
- Repetir el flujo en el terminal de ventas (`/ventas`) y verificar que la venta se confirma con el detalle correcto.
- Verificar que al editar una línea del carrito del cliente y dejarla idéntica a otra, se unen en una sola línea.

#### Tests unitarios adicionales
- `product-helpers.test.ts`: `validateCartAvailability` con dos líneas del mismo producto y selecciones distintas calcula el stock correctamente.
- `sale-helpers.test.ts`: `buildSaleItemValues` genera dos `SaleItemValue` con snapshots distintos cuando recibe dos entradas del mismo `productId`.
- `orderService.test.ts`: `createOrder` con dos entradas del mismo `productId` y `selectedRecipeItemIds` distintas inserta dos `orderItems` y sus respectivos `orderItemRecipes`.

---

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni secretos. Los valores sensibles deben provenir de variables de entorno o configuraciones dinámicas.
- No se requieren migraciones de base de datos; el esquema actual ya soporta múltiples líneas del mismo producto con recetas independientes.
- Ejecutar `npm run test:e2e` solo en base de datos de prueba cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`, según `AGENTS.md`.
- Mantener el patrón de no leer `localStorage` durante el render inicial del cliente para evitar hydration mismatch.
- Asegurar que `nanoid` (u otra fuente de `lineId`) no se use en el servidor para calcular estado inicial del carrito.
- Los endpoints de creación de pedidos y ventas ya están protegidos por autenticación (`withAuth`) o rate limit (`createRateLimiter`); no se requieren cambios de seguridad en las rutas API.
- Al cambiar `data-testid`, actualizar los tests E2E y unitarios que dependen de ellos para evitar falsos negativos.
- Decidir y documentar la estrategia de migración de `localStorage` (Opción A: backward compatible, u Opción B: bump de versión) antes de comenzar la Fase 1.

## Verificaciones

| Fase | Comando | Propósito |
| ---- | ------- | --------- |
| 0-6 | `npx tsc --noEmit` | Tipos correctos |
| 0-6 | `npm run lint` | Estilo y calidad |
| 0-6 | `npm test` | Tests unitarios |
| 0-6 | `npm run build` | Build de producción |
| 6 | `npm run test:e2e` | Flujos críticos end-to-end (base de prueba) |

## Notas de implementación

- El backend (`orderService`, `saleService`, `product-helpers`, `buildSaleItemValues`) ya itera ítem por ítem y genera snapshots de receta por línea. Verificar que ningún punto intermedio (por ejemplo, un `reduce` por `productId` en algún helper) rompa esta propiedad.
- `cart-summary.tsx` y `sales-cart.tsx` deben usar `key={item.lineId}` para evitar advertencias de React y garantizar un render estable cuando haya duplicados.
- Si se reutiliza `PromoOptionsDialog` para editar, asegurar que `initialSelectedIds` se inicialice correctamente y que el diálogo se cierre con la selección final.
- La función de unión de líneas idénticas debe comparar `selectedRecipeItemIds` ordenados para evitar falsos negativos. Centralizar la comparación en `areRecipeSelectionsEqual`.
- El resumen del checkout puede reutilizar `formatRecipeSummary` de `src/lib/recipe-helpers.ts` para mantener consistencia con el carrito y el panel de pedidos.
- El diálogo de edición de una línea debe montarse en el componente padre (`PedidoClient` o `sales-terminal`) y no dentro de `ProductCard`/`SalesProductCard`, porque la tarjeta no conoce la línea específica del carrito.
- `ProductCard` debe mostrar la cantidad total en el badge (`inCartQuantity`) en lugar de un booleano, para que el usuario vea cuántas unidades del producto tiene en el carrito aunque sean líneas distintas.
- `useCart` no tiene acceso al cálculo de disponibilidad por selección específica; por eso se usa `getAvailability(product.id)` como límite conservador. La validación final y el mensaje de faltante se obtienen del backend (`validateCartAvailability`) y se reflejan en `shortageByProduct`.
