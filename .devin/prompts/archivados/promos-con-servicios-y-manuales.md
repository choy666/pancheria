# Prompt: personalizar promos permitiendo quitar insumos manuales y servicios

> **Estado:** resuelto y archivado.  
> La funcionalidad está implementada en `main` con las migraciones `0018_black_vin_gonzales.sql` (reservas de pedido), `0021_ambiguous_mandarin.sql` (snapshots iniciales) y `0023_chubby_sersi.sql` (tablas `sale_item_recipes` y `order_item_recipes`, columnas `is_optional`/`selected_by_default` en `recipes`, `recipe_supplies_summary`). Este prompt se conserva como registro histórico; para trabajo nuevo consultar `pancheria.prompt.md`, `lecciones-aprendidas.md` y `guia-funcionamiento-pancheria.md`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />

Código relevante:

- Esquema y tipos: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />.
- Validaciones: <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />.
- Servicios: <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" />.
- Helpers: <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/stock-helpers.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/summary-helpers.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/catalog.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/product-style.ts" />.
- Hooks: <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />.
- Repositorios: <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/saleRepository.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" />.
- UI: <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-form.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-history.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-cart-section.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-items-list.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-panel.tsx" />.
- Rutas API: <ref_file file="C:/developer/paginas/pancheria/src/app/api/recetas/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/recibir/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/disponibilidad/route.ts" />.

## Estado actual relevante

- El sistema tiene cuatro tipos de producto: `critical_supply`, `compound` (promos), `manual_supply` y `service` (<ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="20-35" />).
- `guia-funcionamiento-pancheria.md` describe que una receta puede vincular un producto `compound` con insumos `critical_supply` o `manual_supply`, y que los servicios son ilimitados; sin embargo, el código actual restringe las recetas a insumos `critical_supply`.
- `recipeService.saveRecipe` rechaza insumos que no sean `critical_supply` (<ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" lines="57-75" />).
- `recipeItemSchema` en `zod-schemas.ts` solo permite insumos críticos en recetas (<ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" lines="76-97" />).
- `promo-form.tsx` solo carga y permite seleccionar insumos críticos para armar una promo (<ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" lines="114-116" />).
- El descuento automático de stock en ventas y pedidos depende de `autoDiscount = true` en la receta. `stock-helpers.ts` ya filtra por `autoDiscount` (<ref_file file="C:/developer/paginas/pancheria/src/lib/stock-helpers.ts" lines="27-61" />).
- `sale_items` y `order_items` solo registran el producto compuesto vendido, pero no guardan el detalle de la receta en el momento de la venta/pedido.
- `cash_registers` y `daily_closures` acumulan `productsSummary` y `criticalSuppliesSummary`, pero no tienen un resumen separado de todos los insumos incluidos en las promos vendidas.
- El carrito (`useCart.ts`) solo guarda `productId` y cantidad. No hay concepto de personalización de combo.

## Objetivo

Permitir que las promos (`compound`) detallen qué llevan (insumos críticos, manuales y servicios) y que el cliente u operador **pueda quitar los insumos manuales y servicios** al armar el pedido. El precio de la promo no cambia, y **no se puede agregar más de lo que la promo ya ofrece**. Solo se pueden quitar los insumos opcionales, nunca los críticos.

El cliente/operador debe ver detallado qué lleva la promo (por ejemplo: pan, salchicha, vaso de coca, mayonesa, ketchup) y poder quitar los manuales/servicios que no quiera. Los ítems manuales/servicios no descuentan stock automáticamente, pero quedan registrados para consultar cómo se vende y prepara cada combo.

Alcance:

1. Crear y editar promos con insumos críticos obligatorios, y manuales/servicios que el cliente puede quitar.
2. Vender combos en el terminal y en pedidos públicos, mostrando un diálogo para quitar opcionales.
3. Registrar un **snapshot de la receta** al momento de la venta/pedido, con el detalle completo y qué ítems fueron incluidos (`selected = true`) y cuáles fueron quitados (`selected = false`).
4. Agregar un resumen de insumos de receta en caja y cierre diario para controlar qué complementos se consumen/venden.
5. Mostrar el detalle de preparación en el catálogo, el carrito, el panel de pedidos, el historial de ventas y el cierre diario.

## Reglas de negocio

1. Una receta debe tener **al menos un insumo crítico** con `autoDiscount = true`. Sin insumos críticos, la promo no se puede guardar.
2. Los insumos críticos (`critical_supply`) son **siempre obligatorios** en la promo, siempre `autoDiscount = true` y son los **únicos** que descuentan stock automáticamente al vender o reservar un combo. No se pueden quitar.
3. Los insumos manuales (`manual_supply`) y los servicios (`service`) pueden estar en una receta con `autoDiscount = false`. No generan movimientos de stock automáticos.
4. Un insumo manual o servicio en una receta es **siempre opcional**: el cliente u operador puede quitarlo al armar el pedido. El administrador puede decidir si viene preseleccionado por defecto (`selectedByDefault = true`) o no (`selectedByDefault = false`).
5. **No se puede agregar a la promo nada que no esté en su receta.** El cliente/operador solo puede quitar insumos manuales/servicios de los que ya ofrece la promo.
6. La disponibilidad de una promo sigue calculándose solo con los insumos críticos con `autoDiscount = true`, como hace `calculateCompoundAvailability`. Los manuales/servicios no afectan disponibilidad ni stock.
7. Los servicios (`service`) conservan disponibilidad infinita; los insumos manuales (`manual_supply`) no son vendibles directamente al público (`isPublicSellableProduct` sigue excluyéndolos).
8. El precio de una promo es **inalterable**: sigue siendo el precio fijo del producto `compound`, sin importar cuántos insumos manuales o servicios se quiten. Los insumos manuales no tienen precio (`price = 0`) y los servicios/extras no suman ni modifican el precio.
9. Al vender o crear un pedido, se guarda un **snapshot** con todos los ítems de la receta en el momento de la operación (nombre, tipo, cantidad, `autoDiscount`, `isOptional`, `selected`, `selectedByDefault`). Este snapshot es la fuente de verdad para anulaciones, reintegros y reportes.
10. Si una receta cambia después de una venta, los snapshots históricos no se deben modificar. El detalle histórico de qué se vendió permanece intacto.
11. El resumen `recipeSuppliesSummary` en caja y cierre diario debe contar las unidades de cada insumo realmente incluido en promos vendidas, es decir, los ítems del snapshot con `selected = true`. El resumen `criticalSuppliesSummary` sigue contando solo los críticos con `autoDiscount = true` (control de stock).
12. Al anular una venta o cancelar un pedido en reserva (`in_process`), el reintegro de stock debe usar el snapshot, no la receta actual, considerando solo los ítems con `selected = true` y `autoDiscount = true`.

## Supuestos de diseño

1. **Estrategia de snapshot:** se agregan las tablas `sale_item_recipes` y `order_item_recipes` para guardar una copia inmutable del detalle de receta por cada línea de venta/pedido. Cada fila del snapshot indica `isOptional`, `selected` y `selectedByDefault` para reconstruir exactamente cómo se armó el combo.
2. **Compatibilidad histórica:** las ventas/pedidos previos sin snapshot se seguirán consultando con la receta actual (fallback), reconociendo que puede no coincidir con la receta original. La migración debe intentar generar snapshots para datos históricos desde `recipes`, asumiendo `selected = true` para todos los ítems.
3. **Resumen de insumos:** se agrega la columna JSON `recipeSuppliesSummary` a `cash_registers` y `daily_closures`, separada de `criticalSuppliesSummary`, para no romper la lógica contable y de stock existente.
4. **Cálculo de stock:** los helpers `collectStockProductIdsToLock` e `iterRecipeConsumptions` aceptan un snapshot opcional. Si existe snapshot, iteran solo ítems con `selected = true` y `autoDiscount = true`; si no, usan `recipesByProduct` actual.
5. **Recepción de pedido:** al pasar un pedido a `in_process`, se genera/actualiza el snapshot con la receta actual y la selección del cliente, y se usa ese snapshot para reservas y movimientos de stock.
6. **Conversión de pedido a venta:** se copian los snapshots de `order_item_recipes` a `sale_item_recipes` dentro de la misma transacción.
7. **Personalización: quitar, no agregar:** el diálogo al agregar una promo al carrito muestra todos los ítems de la receta, con los manuales/servicios preseleccionados según `selectedByDefault`. El cliente/operador puede desmarcar los que no quiere. No se permite agregar ítems fuera de la receta.
8. **Opcionales binarios:** en esta versión un insumo manual/servicio se incluye o no con la cantidad fijada en la receta. No se soportan múltiples porciones del mismo ítem ni precios adicionales.

## Implementación detallada

### Esquema y migración

En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />:

- Modificar la tabla `recipes` para agregar:
  - `isOptional: boolean('is_optional').default(false).notNull()` — indica si el ítem es opcional en la promo.
  - `selectedByDefault: boolean('selected_by_default').default(false).notNull()` — indica si un opcional viene preseleccionado al armar el pedido.
- Crear la tabla `sale_item_recipes`:
  - `id: serial().primaryKey()`
  - `saleItemId: integer('sale_item_id').notNull().references(() => saleItems.id, { onDelete: 'cascade' })`
  - `supplyId: integer('supply_id').notNull().references(() => products.id, { onDelete: 'restrict' })`
  - `supplyName: varchar('supply_name', { length: 255 }).notNull()` (snapshot)
  - `supplyType: productTypeEnum('supply_type').notNull()` (snapshot)
  - `quantity: integer('quantity').notNull()`
  - `autoDiscount: boolean('auto_discount').notNull()`
  - `isOptional: boolean('is_optional').notNull()` (snapshot)
  - `selected: boolean('selected').notNull()` (snapshot)
  - `selectedByDefault: boolean('selected_by_default').notNull()` (snapshot)
  - `createdAt: timestamp('created_at').defaultNow().notNull()`
  - Índice por `saleItemId`.
- Crear la tabla `order_item_recipes` con la misma estructura, referenciando `orderItems.id`.
- Agregar `recipeSuppliesSummary: jsonb('recipe_supplies_summary').$type<Record<string, number>>().default({}).notNull()` a `cash_registers` y a `daily_closures`.
- Definir relaciones: `saleItemsRelations.recipeSnapshots`, `orderItemsRelations.recipeSnapshots`, `saleItemRecipesRelations.saleItem`, `orderItemRecipesRelations.orderItem`.

Migración con `npx drizzle-kit generate`:

- Agregar columnas a `recipes`.
- Crear tablas y columnas nuevas.
- Para cada `sale_item` cuyo producto sea `compound`, insertar filas en `sale_item_recipes` desde `recipes` actual con `isOptional = false` y `selected = true` (datos históricos no tienen selección, se asume todo incluido).
- Para cada `order_item` cuyo producto sea `compound`, insertar filas en `order_item_recipes` de la misma forma.
- Para cajas y cierres existentes, dejar `recipeSuppliesSummary = {}` o recalcularlo a partir de ventas activas con snapshot.
- Verificar que `supplyId` referenciado aún exista. Si un insumo fue eliminado permanentemente, conservar el `supplyName` snapshot y omitir la FK o ajustar según política de soft delete.

### Tipos

En <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />:

- Agregar `RecipeItemConfig = { supplyId: number; supplyName: string; supplyType: ProductType; quantity: number; autoDiscount: boolean; isOptional: boolean; selected: boolean; selectedByDefault: boolean; }`.
- Agregar `SelectedRecipeOption = { recipeId: number; selected: boolean }` o, más simple, `selectedRecipeItemIds: number[]`.
- Extender `SaleItemInput` y `OrderItemInput` (o el tipo que use el carrito) para incluir `selectedRecipeItemIds?: number[]`.
- Extender `ProductAvailability` para incluir `recipe: RecipeItemConfig[]` y permitir mostrar todos los insumos del combo con sus flags.
- Actualizar tipos de `SaleItem`/`OrderItem` para exponer `recipeSnapshot?: RecipeItemConfig[]`.

### Validaciones (Zod)

En <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />:

- `recipeItemSchema`:
  - Permitir `supplyType` `critical_supply`, `manual_supply` y `service`.
  - Si `supplyType === 'critical_supply'`, `isOptional` debe ser `false` y `autoDiscount` debe ser `true`.
  - Si `supplyType !== 'critical_supply'`, `autoDiscount` debe ser `false`; `isOptional` por defecto debe ser `true`.
  - `selectedByDefault` solo puede ser `true` si `isOptional = true`.
- `recipeSchema`:
  - Validar que haya al menos un ítem crítico con `autoDiscount = true`.
  - Validar que no haya `supplyId` duplicados.
  - Validar que el `compoundProductId` no esté en los ítems.
- `saleItemSchema` y el schema de ítems de pedido:
  - Agregar `selectedRecipeItemIds: z.array(z.number().int().positive()).optional().default([])`.
  - Validar que los IDs correspondan a ítems opcionales (manuales o servicios) de la receta del producto.
  - Validar que no se envíe ningún `supplyId` que no pertenezca a la receta del producto (no se puede agregar ítems extras).
- `productSchema` mantiene `manual_supply` con `price = 0`.

### Servicios de aplicación

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" />:

- Permitir `manual_supply` y `service` en recetas con `autoDiscount = false`.
- Forzar `isOptional = false` y `autoDiscount = true` para `critical_supply`.
- Permitir `isOptional = true` o `false` para `manual_supply` y `service`, recomendando `true` por defecto.
- Exigir al menos un `critical_supply` con `autoDiscount = true`.
- Validar que `selectedByDefault = true` solo cuando `isOptional = true`.
- Validar que los insumos no estén eliminados (`deletedAt IS NULL`) y pertenezcan a la sucursal.

En <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />:

- `buildProductContext` y `buildAvailabilityContext` deben devolver recetas con los flags `isOptional` y `selectedByDefault`.
- `validateCartAvailability` debe permitir construir un snapshot parcial a partir de `selectedRecipeItemIds` para calcular stock crítico. Los manuales/servicios no afectan disponibilidad.
- Extender `ProductAvailability` para incluir `recipe` con todos los ítems de receta.

En <ref_file file="C:/developer/paginas/pancheria/src/lib/stock-helpers.ts" />:

- `collectStockProductIdsToLock` e `iterRecipeConsumptions` deben aceptar un `snapshot?: RecipeItemConfig[]`. Si se pasa snapshot, iteran solo ítems con `selected = true` y `autoDiscount = true`; si no, usan `recipesByProduct` actual.

En <ref_file file="C:/developer/paginas/pancheria/src/lib/summary-helpers.ts" />:

- `addItemToSummary` recibe el snapshot y suma:
  - `productsSummary`: producto vendido.
  - `criticalSuppliesSummary`: insumos con `selected = true` y `autoDiscount = true`.
  - `recipeSuppliesSummary`: todos los ítems del snapshot con `selected = true` por `supplyName`.
- Agregar `fillMissingRecipeSupplies` si se desea listar insumos con cantidad 0.

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" />:

- `calculateSummaryFromSales` debe cargar los snapshots de cada `sale_item` y pasarlos a `addItemToSummary`.
- `SaleWithItems` debe incluir `recipeSnapshot` en los ítems.
- `findRecipesForProducts` debe traer todos los ítems, incluyendo flags opcionales.

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />:

- Al construir el snapshot, marcar `selected = true` para todos los insumos críticos y para los manuales/servicios cuyo `supplyId` esté en `selectedRecipeItemIds`.
- Los manuales/servicios no presentes en `selectedRecipeItemIds` deben quedar en el snapshot con `selected = false`.
- `insertSaleAndUpdateCashRegister` debe insertar en `sale_item_recipes` para cada `sale_item` de producto `compound`, copiando el snapshot construido.
- `deductStockForItems` y `reintegrateStockForItems` deben usar el snapshot si existe; si no, usar receta actual.
- `updateCashRegisterSummary` debe acumular `recipeSuppliesSummary`.
- `cancelSale` debe leer `sale_item_recipes` para reintegrar stock correcto.

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />:

- `createOrder` debe insertar `order_item_recipes` para cada `order_item` de producto `compound`, usando `selectedRecipeItemIds` del pedido.
- `receiveOrder` debe generar/actualizar el snapshot (en caso de que la receta haya cambiado desde la creación del pedido) y usarlo para `buildReservationsForItems` y reservas.
- `convertOrderToSale` debe copiar snapshots de `order_item_recipes` a `sale_item_recipes`.
- `cancelOrder` en estado `in_process` debe usar el snapshot para liberar reservas.

En <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" />:

- `calculateCashRegisterSummary` y `generateClosure` deben devolver e incluir `recipeSuppliesSummary`.
- `parseCashRegisterSummary` debe exponer `recipeSuppliesSummary`.

### Repositorios

En <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" />:

- Agregar helpers para insertar/borrar snapshots (`insertSaleItemRecipes`, `insertOrderItemRecipes`, `findBySaleItemIds`, `findByOrderItemIds`).
- Asegurar que `findByCompoundProductId` traiga todos los ítems de la receta con `isOptional` y `selectedByDefault`.

### APIs

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/recetas/route.ts" />: la respuesta GET debe incluir todos los ítems de la receta (críticos, manuales y servicios) con `isOptional` y `selectedByDefault`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" />: recibir `selectedRecipeItemIds` por ítem, persistir snapshots; la respuesta puede incluir el detalle de preparación.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/recibir/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />: recibir, persistir y copiar snapshots con selección.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" />: el catálogo público debe devolver el detalle completo de recetas con flags de opcionales.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/disponibilidad/route.ts" />: no cambia la lógica de disponibilidad, pero puede devolver `recipe` para que el cliente renderice opcionales.

### Frontend

En <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />:

- Cargar todos los productos activos (`critical_supply`, `manual_supply`, `service`), no solo críticos.
- Separar la UI en dos secciones: "Insumos críticos" (obligatorios) y "Complementos / extras" (manuales y servicios).
- Para cada complemento, marcar por defecto:
  - "Opcional" (`isOptional = true`)
  - "Preseleccionado" (`selectedByDefault = true`) — el cliente/operador puede desmarcarlo al armar el pedido.
- Permitir al administrador desmarcar "Opcional" si quiere forzar el ítem, o desmarcar "Preseleccionado" si no quiere que venga por defecto.
- Validar que `critical_supply` siempre sea obligatorio con `autoDiscount = true`.
- Mostrar resumen de preparación con todos los insumos y su condición (obligatorio / opcional / preseleccionado).

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />:

- Al hacer clic en una promo con opcionales, abrir un diálogo para confirmar o quitar insumos.
- Mostrar los insumos críticos como no editables.
- Mostrar los insumos manuales/servicios como checkboxes, marcados según `selectedByDefault`; el cliente puede desmarcar para quitar.
- No permitir agregar ítems que no estén en la receta.
- Guardar la selección en el ítem del carrito (`selectedRecipeItemIds`).
- En el catálogo, mostrar en el desplegable "Ver insumos" la lista completa, indicando cuáles son opcionales.

En <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />:

- Al agregar una promo al carrito, si tiene opcionales, abrir el mismo diálogo de confirmación/quitar.
- Guardar `selectedRecipeItemIds` en el ítem del carrito.
- Actualizar `CartItem` y `useCart` para soportar la selección.

En <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />:

- Extender `CartItem` con `selectedRecipeItemIds?: number[]`.
- Actualizar `storedCartSchema` y `cartItemSchema` para persistir la selección en `localStorage`.
- `addItem` y `updateQuantity` deben manejar la selección.

En <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-history.tsx" />:

- Al ver detalle de una venta, mostrar para cada ítem su snapshot de receta, indicando qué insumos fueron incluidos (`selected = true`) y cuáles fueron quitados (`selected = false`).

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-items-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />:

- Mostrar el detalle de preparación de cada combo (snapshot o receta actual), incluyendo los ítems quitados tachados o en una sección aparte.

En <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-panel.tsx" />:

- Agregar una tarjeta "Insumos de recetas" con `recipeSuppliesSummary`.
- Actualizar la descarga CSV para incluir `recipeSuppliesSummary`.

### Experiencia de usuario recomendada (tipo Mostaza / Burger King / PedidosYa)

El objetivo es que el flujo sea rápido, claro y amigable tanto para el cliente público como para el operador del local.

#### Catálogo público (`/pedido`)

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />:

- Mostrar siempre un resumen visible de lo que incluye la promo (por ejemplo: "Incluye: pan, salchicha, vaso de coca, mayonesa, ketchup"). Usar los ítems de la receta con `isOptional = true` marcados como "se puede quitar".
- Si la promo tiene opcionales, el botón principal dice "Personalizar" o "Elegir opciones" en lugar de "Agregar" directamente.
- Al tocar, abrir un diálogo claro con:
  - Imagen y nombre de la promo.
  - Lista "Siempre incluye" con los críticos (deshabilitados).
  - Sección "Quitá lo que no querás" con los manuales/servicios como checkboxes, marcados según `selectedByDefault`.
  - Precio destacado: "Total: $XXX" (sin cambiar al marcar/desmarcar opcionales).
  - Botón primario "Agregar al pedido".

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />:

- Asegurar que el catálogo no se recargue ni pierda el scroll al abrir el diálogo.
- Agrupar promos visualmente separadas de bebidas y servicios individuales.

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-cart-section.tsx" />:

- Cada ítem del carrito que sea una promo debe mostrar un subtítulo con lo que incluye realmente (por ejemplo: "sin mayonesa" o "con ketchup").
- Permitir tocar el ítem para reabrir el diálogo y modificar la selección antes de confirmar el pedido.
- Si el cliente quitó algo, mostrarlo claramente: tachado o con un icono de "exclusión".

#### Terminal de ventas (`/ventas`)

En <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />:

- Si la promo no tiene opcionales, agregar al carrito con un solo toque, como hoy.
- Si tiene opcionales, abrir el diálogo inmediatamente sin pasos extra.
- Mostrar los críticos como no editables y los opcionales como toggles.
- Ofrecer atajo "Predeterminado" para marcar todos según `selectedByDefault`.
- En el carrito, mostrar la promo con su configuración y permitir editarla tocando el ítem.

#### Confirmación y chat del pedido

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" />:

- Mostrar el resumen del pedido con cada promo y su configuración.
- Para cada promo, listar:
  - Línea principal: `2x Promo 1 — $XXX`.
  - Sub-línea con lo incluido: `Incluye: pan, salchicha, vaso de coca, ketchup. Sin: mayonesa.`
- Si no se quitó nada, no mostrar "Sin: ...".

En el chat del pedido (componentes bajo `src/components/pedidos/chat/`):

- Al recibir o confirmar un pedido, el sistema puede enviar un mensaje automático con el detalle de preparación, incluyendo opcionales quitados.
- El operador debe ver la promo personalizada sin depender de WhatsApp.
- **WhatsApp está deprecado:** no agregar nuevas funcionalidades ni tests que dependan de `lib/whatsapp.ts` o `buildWhatsAppMessage`.

#### Panel de pedidos y cocina

En <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-items-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />:

- Mostrar cada promo como una "tarjeta de preparación".
- Críticos: lista fija.
- Opcionales incluidos: check verde o texto normal.
- Opcionales quitados: tachado o en gris claro, con etiqueta "no incluir".
- Destacar si la promo fue personalizada para que el operador/cocina lo note rápidamente.

#### Accesibilidad

- Usar `role="dialog"` y `aria-modal="true"` en el diálogo de opcionales.
- Cada checkbox debe tener `aria-label` del tipo "Incluir mayonesa en Promo 1".
- Mantener foco dentro del diálogo mientras esté abierto.
- Asegurar que el diálogo se cierre con `Escape` y se confirme con `Enter`.

### Tests

- Actualizar `recipeService.test.ts` para casos con `manual_supply` y `service` opcionales y preseleccionados.
- Actualizar `productService.test.ts` para validar que `manual_supply` sigue con `price = 0`.
- Actualizar `saleService.test.ts` y `orderService.test.ts` para verificar snapshots, resúmenes y reintegros con snapshots y selección de opcionales.
- Actualizar `summaryService.test.ts`, `cashRegisterService.test.ts` y `closureService.test.ts` para `recipeSuppliesSummary`.
- Actualizar `zod-schemas.test.ts` para `recipeItemSchema` y `saleItemSchema` con `selectedRecipeItemIds`.
- Actualizar `product-helpers.test.ts` y `stock-helpers.test.ts` para snapshots.
- Actualizar tests de componentes (`promo-form.test.tsx`, `product-card.test.tsx`, `sales-terminal.test.tsx`, `sales-history.test.tsx`, `pedido-detail.test.tsx`, etc.).
- Actualizar tests E2E de productos, recetas, ventas y pedidos, cubriendo quitar insumos manuales/servicios en el catálogo y terminal.

## Criterios de aceptación

- [ ] Se puede crear una promo con insumos críticos obligatorios, y manuales/servicios opcionales y preseleccionados por defecto.
- [ ] Los insumos manuales y servicios de una promo no descuentan stock al vender.
- [ ] La disponibilidad de una promo solo depende de los insumos críticos con `autoDiscount = true`.
- [ ] En el catálogo público y en el terminal de ventas, al agregar una promo con opcionales se abre un diálogo para confirmar o quitar insumos manuales/servicios.
- [ ] No se puede agregar a la promo ningún ítem que no esté en su receta.
- [ ] Los manuales/servicios preseleccionados (`selectedByDefault = true`) aparecen marcados por defecto en el diálogo y el cliente/operador puede quitarlos.
- [ ] El precio de la promo no cambia independientemente de los insumos quitados.
- [ ] Al vender un combo en `/ventas` se guarda el snapshot de receta en `sale_item_recipes`, con `selected = true` en los incluidos y `selected = false` en los quitados.
- [ ] Al crear un pedido público se guarda el snapshot en `order_item_recipes`.
- [ ] Al recibir un pedido (`in_process`) se usa el snapshot para reservar stock.
- [ ] Al convertir un pedido a venta se copian los snapshots.
- [ ] Al anular una venta o cancelar un pedido en reserva se reintegra stock según el snapshot.
- [ ] `cash_registers.recipeSuppliesSummary` y `dailyClosures.recipeSuppliesSummary` reflejan todos los insumos realmente incluidos en promos vendidas (`selected = true`).
- [ ] El historial de ventas y el detalle de pedidos muestran el detalle de preparación de cada combo, incluyendo los ítems quitados.
- [ ] El cierre diario incluye una sección de "Insumos de recetas".
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` pasan.
- [ ] Existe migración de Drizzle para el cambio de esquema.

## Restricciones

- No hardcodear credenciales, URLs ni parámetros sensibles.
- No modificar políticas de rate-limit, autenticación ni permisos de sucursal.
- Respetar transacciones (`executeInTransaction`) y bloqueos de caja.
- Mantener soft-delete y validación de registros eliminados.
- No cambiar el comportamiento de stock de insumos críticos ni bebidas.
- No permitir que `manual_supply` o `service` tengan `autoDiscount = true`.
- No permitir que `critical_supply` sea opcional.
- No permitir agregar ítems a la promo que no estén en su receta.
- No agregar precios variables a los opcionales en esta iteración; el precio del combo sigue siendo fijo.
- Documentar decisiones no triviales en `AGENTS.md` o `.devin/informes/lecciones-aprendidas.md` si aplica.

## Consideraciones de seguridad y entorno

- `DATABASE_URL` y `DATABASE_URL_UNPOOLED` deben apuntar a la base correcta. No usar producción para pruebas.
- `npm run test:e2e` y `npx drizzle-kit push` solo en base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`).
- No commitear `.env.local` ni `.env.e2e`.
- Respaldar la base de datos antes de empujar migraciones en producción (ver `.devin/informes/entornos.md`).
- La migración de snapshots históricos es aproximada; informar al usuario si las recetas cambiaron desde la venta original.

## Verificaciones

Antes de declarar terminado, ejecutar:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. `npx drizzle-kit check` (con base de prueba)
6. `npm run test:e2e` solo en base descartable y con confirmación.
