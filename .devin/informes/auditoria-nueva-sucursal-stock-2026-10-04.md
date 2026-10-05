# Auditoría de factibilidad — nueva sucursal: inventario de 59 ítems + menú vendible + trazabilidad + facturación

**Estado:** abierto
**Fecha de ejecución:** 2026-10-04
**HEAD:** `73f3073a3f35c76717ffbc3c3a4e8b98924785ba`
**Alcance:** auditoría de solo lectura. No se modificó código, esquema, migraciones, seeds ni datos; no se conectó a ninguna base; no se ejecutaron tests E2E ni seeds. La evidencia cita `archivo → función/export/tabla` contra el `HEAD` indicado. El prompt de origen es `.devin/prompts/auditoria-nueva-sucursal-stock.md`.

**Decisiones del usuario incorporadas (2026-10-04):** las 6 decisiones del §7 ya fueron respondidas y se recibió el menú real completo (11 promos, 13 aderezos, 5 toppings, 2 extras); el mapeo (§3), las brechas (§5) y el plan (§6) quedaron ajustados en consecuencia. El tope quedó confirmado: el pancho común lleva **4 aderezos elegidos por el cliente entre los 13** — requiere la feature `maxOptionalSelections` (B-13 → PR-8, ya no condicional).

**Implementación (2026-10-04):** PR-8 quedó **implementado y verificado** en esta rama de trabajo (sin commit): `products.max_optional_selections` (migración `drizzle/0036_max_optional_selections.sql`, CHECK `> 0` o NULL), validación server-side en `assertValidSelectedRecipeItemIds` (aplica a snapshots, disponibilidad, consumo, ventas y pedidos), contador/bloqueo en `PromoOptionsDialog`, input del tope en `promo-form` (solo compuestos) y clamp en `useCart`/`useSellableCart`. Al cambiar el tipo efectivo fuera de `compound`, `updateProduct` limpia el campo a NULL.

PR-1 quedó **implementado y verificado** en la misma rama: `scripts/cargar-catalogo.ts` (dry-run por defecto, `--apply`, `--branch <id|nombre>` o `CARGA_BRANCH`, transacción única, dedup por `(branchId, nombre)` case-insensitive con diff informativo, recetas vía `saveRecipe`, stock inicial opcional vía `adjustStock restock` solo en productos nuevos) + `scripts/data/catalogo-pancheria-popular.ts` (76 productos versionados + 11 recetas). Cambio mínimo de soporte: `productRepository.create`/`findById` ahora respetan la transacción ambiental. Probado end-to-end en base descartable: 41 creados + 35 omitidos + 11 recetas, re-ejecución 100% idempotente. **Decisión de carga:** bebidas y postres sin precio en el inventario se crean `isActive=false` (no se publican a $0); el operador fija precio y activa en una edición. Verificación completa en verde: lint, `tsc --noEmit`, 2048 tests, build, knip, `drizzle-kit check`. Pendiente: commitear; aplicar migración 0036 en producción (`npx drizzle-kit migrate` con `DATABASE_URL_UNPOOLED` + backup).

---

## 1. Veredicto

| Bloque | Veredicto | Síntesis |
|---|---|---|
| **A. Inventario (59 ítems)** | **PARCIALMENTE PREPARADO** | El modelo de 4 tipos cubre los 59 ítems sin tocar el esquema (críticos → `critical_supply`, resto → `manual_supply`, postres → `service`, decisión D-5). La creación de sucursal existe (panel + seed), pero **no hay carga masiva** (ni UI bulk ni script idempotente), el stock es entero ("½ bolsa" no es representable) y falta unicidad `(branchId, nombre)` para dedup confiable. |
| **B. Menú vendible (11 promos + extras)** | **PARCIALMENTE PREPARADO** | Las 11 promos son modelables hoy como `compound` con receta: críticos con `autoDiscount` + aderezos/toppings como `manual_supply` opcionales + vasos como `service` opcional. Los extras existen como `service` standalone con precio. Definiciones resueltas con el menú real (D-1: 4 aderezos por defecto; D-2: completo = 13 aderezos + 5 toppings; D-3: tamaños reales al crear el producto). Queda crear 4 productos fuera de los 59 (Pritty 500 cc, Doble Cola 2,25 L, Jugo Tutti 200 cc, Mayonesa provenzal) y cargar las recetas. Los opcionales quedan siempre quitables por el cliente sin cambiar precio (aceptado). El común tiene **tope de 4 aderezos elegibles de los 13** (confirmado) → requiere la feature `maxOptionalSelections` (B-13/PR-8). |
| **C. Trazabilidad por promo** | **PARCIALMENTE PREPARADO** | La cadena pedido→reserva→venta→snapshot→caja→historial→chat→anulación/reintegro es completa y transaccional. Brecha: el total de vasos queda partido en dos contadores (`productsSummary` para sueltos, `recipeSuppliesSummary` para los incluidos en promo) sin vista unificada; lo mismo aplica al conteo de toppings/aderezos por nombre. |
| **D. Registrar y facturar** | **PARCIALMENTE PREPARADO** | "Registrar venta" está **PREPARADO** (venta atómica, pagos mixtos, caja, cierre con arqueo, historial). "Facturación fiscal" está **NO PREPARADO** (no existe comprobante, ticket, PDF, impresión ni integración ARCA/AFIP en `src/` ni en `package.json`), pero el usuario redefinió "facturar" como **registros contables internos para el administrador** (D-6): los datos ya existen (`sales`, `sale_payments`, `cash_registers` con totales por método y arqueo) y falta la vista consolidada por período + exportación. |

---

## 2. Tabla de requisitos

| # | Requisito | Estado | Severidad | Evidencia (archivo → función) | Esfuerzo |
|---|---|---|---|---|---|
| 1 | Crear sucursal (nombre, horarios, contactos, ubicación) | **OK** | — | `src/application/services/branchService.ts → createBranch`; `src/app/(panel)/sucursales/` (UI); `src/db/seeds.ts → seedOptionalBranch` | — |
| 2 | Crear operador para la sucursal | **OK** | — | `src/app/(panel)/usuarios/` (UI); `seeds.ts → seedOptionalBranch` (`NEW_BRANCH_USERNAME/PASSWORD`); `users.branchId` NOT NULL | — |
| 3 | Que la sucursal nueva no aparezca vacía en `/pedido` antes de estar lista | **Riesgo** | menor | `src/lib/branch-resolver.ts → listPublicBranches`: no hay flag de activo; toda sucursal existente aparece en el selector público | M |
| 4 | Validar horarios y caja al pedir (server, no solo UI) | **OK** | — | `src/application/services/orderService.ts → createOrder` (líneas 285–296): rechaza fuera de horario si hay `openingHours` y exige caja abierta siempre; consistente con `src/app/api/public/sucursal/estado/route.ts` | — |
| 5 | Tipos de producto para los 59 ítems | **OK** | — | `src/db/schema.ts → productTypeEnum` (`critical_supply`/`compound`/`manual_supply`/`service`), `criticalSupplyTypeEnum` (`bread`/`sausage`/`beverage`) | — |
| 6 | Postres vendibles | **OK** (decisión D-5: como `service` con precio, sin stock) | menor | `src/lib/catalog.ts → isPublicSellableProduct`: `manual_supply` no es vendible y `service` no descuenta stock → vendible sin stock. Si se quisiera stock de postres falta el tipo "vendible con stock propio" | — / M si se quiere stock |
| 7 | Unidades no enteras ("½ bolsa", "a raspar") | **Falta** | mayor | `src/db/schema.ts`: `products.stock`, `recipes.quantity`, `stock_movements.quantity` son `integer` | L |
| 8 | Unicidad `(branchId, nombre)` para carga dedup | **Falta** | mayor | `src/db/schema.ts → products`: solo índice no-unique `products_name_idx`; `productService.createProduct` no chequea duplicados | S (migración) |
| 9 | Carga masiva de catálogo (CSV/JSON/script) | **Falta** | crítico | No existe `csv`/`xlsx`/bulk en `src/` ni `scripts/` (solo `dev-e2e.ts`, `drizzle-baseline.ts`); `src/db/catalog-copy.ts → copyCatalogToBranch` es inadecuada (copia stock >0, pierde `isOptional`/`selectedByDefault`, no copia imágenes, no-op si el destino tiene ≥1 producto) | M |
| 10 | Carga masiva de recetas/promos | **Falta** | crítico | Mismo punto: `copyCatalogToBranch` copia recetas pero **degrada** los opcionales a obligatorios (no copia `isOptional`/`selectedByDefault`, defaults `false`) | M (incluido en #9) |
| 11 | Reglas de receta (≥1 crítico, sin duplicados, tipos coherentes) | **OK** | — | `src/application/services/recipeService.ts → saveRecipe`; `src/lib/zod-schemas.ts → recipeSchema/recipeItemSchema` | — |
| 12 | Opcionales configurables (aderezos/toppings quitables) | **OK** | — | `schema.ts → recipes.isOptional/selectedByDefault`; `PromoOptionsDialog` (secciones "A tu gusto"/"Sumale"); `src/lib/product-helpers.ts → buildRecipeSnapshot/assertValidSelectedRecipeItemIds` | — |
| 13 | Opcional **obligatorio** no-quitable en receta (vasos incluidos) | **Riesgo** | mayor | `src/lib/zod-schemas.ts → recipeItemSchema`: rechaza `isOptional:false` en `manual_supply`/`service` cuando `supplyType` viene informado; `saveRecipe` defaultea `isOptional = !autoDiscount` → por API los vasos/aderezos son **siempre quitables** (DB sí admite `false` si se inserta directo) | S |
| 14 | Precio por opcional (topping extra cobrable dentro de promo) | **Falta** | menor | `RecipeItemConfig` no tiene `price`; el precio de la promo es fijo. Alternativa vigente: `service` standalone como línea separada del carrito | M |
| 15 | Extras como servicio con precio (`Vaso de gaseosa` $500, `Agregado de toppings` $200) | **OK** | — | `schema.ts → products.type='service'` con `price`; `src/components/ventas/sales-terminal.tsx`: filtra con `isPublicSellableProduct` y da disponibilidad ilimitada; `useSellableCart`: línea propia con `notes` | — |
| 16 | Identificar QUÉ topping extra se vendió | **Riesgo** | menor | Un único producto "Agregado de toppings" solo cuenta unidades; el topping concreto viaja en `order_items.notes`/`sale_items.notes` (`src/lib/sale-helpers.ts → buildSaleItemValues`); alternativa: un `service` por topping (conteo fino, §9.2) | S |
| 17 | Disponibilidad de promos = solo críticos `autoDiscount` | **OK** | — | `src/lib/availability-helpers.ts → calculateCompoundAvailability` (filtra `autoDiscount`; sin críticos → 0); opcionales manuales NO afectan; stock 0 de pan/salchicha → todas las promos no disponibles | — |
| 18 | Reserva de stock al recibir pedido | **OK** | — | `orderService.ts → receiveOrder` (`order_stock_reservations` + movimiento `reserve`, idempotente, bloquea `findByIdForUpdate`) | — |
| 19 | Conversión pedido→venta con snapshots e histórico | **OK** | — | `orderService.ts → convertOrderToSale` (libera reservas, `buildItems` conserva `unitPrice`/`subtotal` del pedido, copia snapshot a `sale_item_recipes`); `saleService.ts → insertSaleAndUpdateCashRegister` | — |
| 20 | Anulación con reintegro de stock | **OK** | — | `saleService.ts → cancelSale` (exige caja **abierta**; `reintegrateStockForItems` + movimientos `cancellation`); `orderService.ts → cancelOrder` (`reserve_release` en `in_process`, `cancelSale` en `paid`) | — |
| 21 | Anular venta de una caja ya cerrada | **Falta** | menor | `saleService.ts → cancelSale` líneas 537–546: `ValidationError` si la caja está cerrada/eliminada. Las ventas de cajas cerradas no se pueden anular | M |
| 22 | Conteo de vasos (sueltos + dentro de promos) en un solo lugar | **Falta** | mayor | `src/lib/summary-helpers.ts → addItemToSummary`: sueltos → `productsSummary`; en promo → `recipeSuppliesSummary` (por `supplyName`). Tarjeta separada en `cash-register-summary.tsx` (línea 304+) | S |
| 23 | Conteo de toppings/aderezos consumidos | **OK** (parcial) | menor | `recipeSuppliesSummary` acumula todos los ítems `selected` por `supplyName` (incluye manuales y servicios) | — |
| 24 | Ocultar bebidas sueltas sin romper recetas | **No aplica** (decisión D-5: todo se publica) | menor | `isActive=false` oculta de `/pedido`, `/ventas`, `/api/productos` y `/stock` (`productRepository.findActive*`); pero la receta sigue consumiéndola (`findByIds` no filtra `isActive`) y **deja de poder reponerse por UI y de emitir alertas de stock bajo**. Si a futuro se quiere ocultar algo sin borrarlo, la vía limpia es el flag de visibilidad (PR-4) | M (opcional) |
| 25 | Mensaje automático del chat con composición | **OK** | — | `orderService.ts → createOrder` + `src/lib/order-helpers.ts → buildRecipeSnapshotMessageContent` (incluidos/quitados + aclaración por línea) | — |
| 26 | Historial de ventas con precios y snapshot | **OK** | — | `sale_items.unitPrice/subtotal` + `sale_item_recipes`; `src/components/ventas/sales-history.tsx → formatRecipeSummary` | — |
| 27 | Pagos mixtos y exactitud monetaria | **OK** | — | `sale_payments`; `src/lib/payment-helpers.ts → validatePaymentParts` (suma exacta en centavos, métodos únicos) | — |
| 28 | Idempotencia en pedidos/ventas | **OK** | — | `sales.idempotencyKey/idempotencyHash`, `orders.idempotencyKey/idempotencyHash`; `idempotencyService` | — |
| 29 | Aislamiento por sucursal | **OK** | — | `branchId` en todas las consultas; `findRecipesForProducts` filtra `supply.branchId`; E2E `caja-aislamiento-y-trazabilidad`, `roles-y-sucursales` | — |
| 30 | Reportes contables consolidados para el admin (período, método, sucursal, exportación) — alcance redefinido por D-6 | **Falta** | mayor | Los datos existen (`sales`/`sale_payments`/`cash_registers`); `/api/caja/historial` filtra por rango pero devuelve **cajas sueltas** sin totales agregados del período; `/api/ventas` filtra por `cashRegisterId` o un solo `date`. No hay exportación CSV/PDF en `src/` (la referencia "+ CSV" del prompt no existe en código). Comprobante fiscal ARCA/AFIP: fuera de alcance | M |
| 31 | Cobertura de tests del dominio | **OK** | — | Unitarios: `orderService` (64), `saleService` (42), `branchService` (33), `zod-schemas` (29), `product-helpers` (23), `recipeService` (13), `summaryService` (12), `summary-helpers` (11), `availability-helpers` (9), `branch-helpers`, `cash-register-helpers`, `catalog`, `recipe-helpers`, `sale-helpers`, `stockService`, `cart-pipeline`, `selected-branch`, `server-cache`. E2E: 47 specs (reservas, aislamiento, concurrencia, cierres, promos, opcionales) | — |
| 32 | Tope de 4 aderezos en el pancho común (elegibles de los 13) | **Falta** | mayor | No hay límite de opcionales seleccionables: `assertValidSelectedRecipeItemIds` (`src/lib/product-helpers.ts`) valida IDs, no cantidad. El workaround "solo 4 en receta" quedó descartado: el cliente elige cuáles 4 → requiere `maxOptionalSelections` | M (PR-8) |

---

## 3. Mapeo propuesto de los 59 ítems y de las 11 promos + extras

### 3.1 Inventario (59 ítems) → `products`

Convenciones propuestas: `stock` siempre entero y en la **unidad mínima consumible**; la presentación de compra ("paquete", "fardo", "tira", "bolsa") va en `unit` como etiqueta informativa o en el nombre entre paréntesis. No existe conversión de unidades: lo que la receta consume es lo que `unit` describe.

| Ítem del inventario | Tipo propuesto | `criticalSupplyType` | `unit` sugerida | Observaciones |
|---|---|---|---|---|
| Pan super pancho | `critical_supply` | `bread` | `unidad` | No vendible standalone: `critical_supply` no-beverage nunca es público — solo insumo de combos (confirmado) |
| Salchichas (paquete de 6 u.) | `critical_supply` | `sausage` | `unidad` | **Por unidad** (D-4; stock = 6×paquetes); recetas consumen 1–18 u. No vendible standalone — solo insumo de combos; "paquete de 6" solo referencia de compra |
| Caja descartable chica | `manual_supply` | — | `unidad` | |
| Caja descartable grande | `manual_supply` | — | `unidad` | |
| Porta panchos super | `manual_supply` | — | `unidad` | |
| Sorbetes | `manual_supply` | — | `unidad` | stock = unidades; el "paquete" solo describe compra |
| Vasos | `manual_supply` | — | `unidad` | stock = vasos individuales; "tira" es presentación |
| Bolsas | `manual_supply` | — | `unidad` | |
| Folex | `manual_supply` | — | `paquete` | o `unidad` según cómo se cuente |
| Rollo de cocina | `manual_supply` | — | `rollo` | |
| Cintas | `manual_supply` | — | `unidad` | |
| Gas | `manual_supply` | — | `garrafa` | |
| Aceite | `manual_supply` | — | `litro` | "½ botella" no es representable → contar por litro o botella entera |
| Vinagre | `manual_supply` | — | `botella` | |
| Sal gruesa | `manual_supply` | — | `paquete` | |
| Ajo | `manual_supply` | — | `bolsa` | |
| Provenzal | `manual_supply` | — | `bolsita` | insumo del topping "Mayonesa provenzal" (producto propio, ver tabla siguiente) |
| Caldos | `manual_supply` | — | `unidad` | |
| Líquido para piso | `manual_supply` | — | `bidón` | |
| Lavandina | `manual_supply` | — | `bidón` | |
| Detergente | `manual_supply` | — | `litro` | |
| Mayonesa | `manual_supply` | — | `sachet` | aderezo del pancho común |
| Ketchup | `manual_supply` | — | `sachet` | aderezo del pancho común |
| Mostaza | `manual_supply` | — | `sachet` | aderezo del pancho común |
| Salsa golf | `manual_supply` | — | `sachet` | aderezo del pancho común |
| Barbacoa | `manual_supply` | — | `sachet` | aderezo del completo |
| Chimichurri | `manual_supply` | — | `sachet` | aderezo del completo |
| Picante | `manual_supply` | — | `sachet` | aderezo del completo |
| Cheddar | `manual_supply` | — | `sachet` | aderezo del completo (inventario lo agrupa como "topping") |
| Parmesano | `manual_supply` | — | `sachet` | idem |
| Fugazzeta | `manual_supply` | — | `sachet` | idem; nombre sugerido "Fugazzeta" (normalizar con el seed "Fugazeta") |
| Aceituna | `manual_supply` | — | `sachet` | idem |
| Roquefort | `manual_supply` | — | `sachet` | idem |
| Salame | `manual_supply` | — | `sachet` | idem |
| Choclo (lata) | `manual_supply` | — | `porción` | topping; nombre sugerido del producto "Choclo en grano" (nombre del menú — es lo que ven cliente y cocina en el toggle/snapshot); stock en porciones y la lata como referencia |
| Huevos | `manual_supply` | — | `unidad` | topping; nombre sugerido "Huevo picado" (nombre del menú) |
| Tomate | `manual_supply` | — | `unidad` | |
| Cebolla | `manual_supply` | — | `unidad` | topping; nombre sugerido "Criollita" (nombre del menú) |
| Morrones | `manual_supply` | — | `unidad` | |
| Papas | `manual_supply` | — | `porción` | topping; nombre sugerido "Papas pay" (nombre del menú) |
| Coca-Cola 1 L | `critical_supply` | `beverage` | `botella` | **aparece públicamente** si `isActive=true` |
| Coca-Cola 1,5 L | `critical_supply` | `beverage` | `botella` | idem |
| Coca-Cola chica | `critical_supply` | `beverage` | `botella` | idem |
| Doble cola 1 L | `critical_supply` | `beverage` | `botella` | el menú pide 2,25 L → ver inconsistencia I-2 |
| Doble cola chica | `critical_supply` | `beverage` | `botella` | |
| Pritty 1 L | `critical_supply` | `beverage` | `botella` | el menú pide 500 cc → ver I-2 |
| Agua chica 500 ml | `critical_supply` | `beverage` | `botella` | |
| Agua 1,5 L | `critical_supply` | `beverage` | `botella` | |
| Agua de pera chica | `critical_supply` | `beverage` | `botella` | |
| Agua de manzana chica | `critical_supply` | `beverage` | `botella` | |
| Agua de pera 1 L | `critical_supply` | `beverage` | `botella` | |
| Agua de manzana 1 L | `critical_supply` | `beverage` | `botella` | |
| Agua de pomelo 1 L | `critical_supply` | `beverage` | `botella` | |
| Fanta 1,5 L | `critical_supply` | `beverage` | `botella` | |
| Jugo Tutti 475 ml | `critical_supply` | `beverage` | `botella` | el menú pide 200 cc → ver I-2 |
| Cerveza grande 700 ml | `critical_supply` | `beverage` | `botella` | alcohol: publicada (D-5: todo se publica) |
| Cerveza chica 475 ml | `critical_supply` | `beverage` | `botella` | idem |
| Postre Oreo | `service` | — | `unidad` | Decisión D-5: se publica como servicio con precio (vendible, **sin** descuento de stock) |
| Flan | `service` | — | `unidad` | idem |

**Postres (decisión D-5):** se publican como `service` con precio — vendibles sin control de stock. Solo haría falta un tipo "vendible con stock" si el negocio quisiera descontar stock de postres (ver brecha B-4, ahora condicionada).

**Productos que el menú necesita y no están en los 59:** las bebidas se cargan con su tamaño real de compra (D-3, confirmado: el tamaño se determina al crear el producto) y "Mayonesa provenzal" entra como topping propio:

| Producto del menú | Tipo propuesto | `criticalSupplyType` | `unit` sugerida | Observaciones |
|---|---|---|---|---|
| Pritty 500 cc | `critical_supply` | `beverage` | `botella` | Necesario para Promo Pritty 1 y 2 — el inventario lista Pritty 1 L; confirmar contra compra real |
| Doble Cola 2,25 L | `critical_supply` | `beverage` | `botella` | Necesario para Promo Popular / Familiar / Familiar Plus — el inventario lista 1 L y chica |
| Jugo Tutti 200 cc | `critical_supply` | `beverage` | `unidad` | Necesario para Popu Kids — el inventario lista Jugo Tutti 475 ml |
| Mayonesa provenzal | `manual_supply` | — | `porción` | Topping propio (confirmado: "sería un topping"); producto con el nombre del menú para que llegue así al toggle/snapshot. El inventario tiene Mayonesa y Provenzal por separado (insumos de su preparación, sin receta) |

Si los tamaños del inventario también existen físicamente, coexisten como productos aparte (todos publicables, decisión D-5). Confirmar con el dueño qué tamaños compra antes de cargar.

### 3.2 Mapeo de las 11 promos → `compound` + `recipes`

Convención (con D-1/D-2 ya decididas): en cada receta, los críticos van con `autoDiscount=true, isOptional=false`; los aderezos/toppings son `manual_supply` con `autoDiscount=false, isOptional=true` y `selectedByDefault` según el set — **común = los 13 aderezos como opcionales con tope 4 elegibles** (confirmado: el cliente elige cuáles 4) → `maxOptionalSelections=4` en el producto compuesto (PR-8), con los 4 clásicos como `selectedByDefault`; y **sin toppings en la receta** (en el común se cobran vía "Agregado de toppings" o pasando a completo); **completo = 13 aderezos + 5 toppings, todos por defecto**; los vasos son el `service` "Vaso de gaseosa" con `isOptional=true, selectedByDefault=true` (el cliente puede quitarlos sin cambiar precio — comportamiento aceptado con precio fijo, ver §9.5).

> Nota sobre "cantidad de ítem de receta" para servicios/manuales: `recipes.quantity` registra cuántas unidades del insumo entran por unidad de promo (p. ej. 2 vasos en Amigos 1). El diálogo activa/desactiva el ítem completo, no por unidad.

| Promo | Precio | Receta propuesta (críticos `autoDiscount` + opcionales) | Comentarios |
|---|---|---|---|
| Pancho Popular ($1.000) | 1000 | Pan ×1, Salchichas ×2 + aderezos comunes: los 13 como `manual_supply` opcionales, 4 clásicos `selectedByDefault`, **tope 4 elegibles** vía `maxOptionalSelections=4` (PR-8, D-1) | El "Súper Pancho" no existe como producto: la promo ES el pancho |
| Promo 1 ($1.500) | 1500 | Pan ×1, Salchichas ×2 + aderezos comunes + `Vaso de gaseosa` (service) ×1 | |
| Promo 2 ($2.000) | 2000 | Pan ×1, Salchichas ×2 + 13 aderezos + 5 toppings (D-2: incluidos) + `Vaso de gaseosa` ×1 | completo |
| Promo Pritty 1 ($2.000) | 2000 | Pan ×1, Salchichas ×2 + aderezos comunes + `Pritty` (beverage) ×1 | requiere el producto "Pritty 500 cc" (D-3: por tamaño real en ml) |
| Promo Pritty 2 ($2.500) | 2500 | Pan ×1, Salchichas ×2 + 13 aderezos + 5 toppings + `Pritty` ×1 | idem (Pritty 500 cc, D-3) |
| Promo Amigos 1 ($2.500) | 2500 | Pan ×2, Salchichas ×4 + aderezos comunes ×2 sets + `Vaso de gaseosa` ×2 | los opcionales manuales se cuentan por unidad de promo; si la receta lleva cada aderezo ×2 quedan "dos sets" indivisibles por toggle — alternativa: quantity por pancho y aceptar que el toggle quita los dos sets |
| Promo Amigos 2 ($3.500) | 3500 | Pan ×2, Salchichas ×4 + 13 aderezos + toppings (×2) + `Vaso de gaseosa` ×2 | idem |
| Promo Popular ($10.000) | 10000 | Pan ×5, Salchichas ×10 + completos (×5) + `Doble Cola` (beverage) ×1 | requiere "Doble Cola 2,25 L" (D-3) |
| Promo Familiar ($11.000) | 11000 | Pan ×9, Salchichas ×18 + aderezos comunes (×9) + `Doble Cola` ×1 | traza end-to-end en §4.2; Doble Cola 2,25 L (D-3) |
| Promo Familiar Plus ($16.000) | 16000 | Pan ×9, Salchichas ×18 + completos (×9) + `Doble Cola` ×1 | Doble Cola 2,25 L (D-3) |
| Popu Kids ($2.000) | 2000 | Pan ×1, Salchichas ×2 + completo + `Juguito Tutti` (beverage) ×1 | requiere "Jugo Tutti 200 cc" (D-3) |

### 3.3 Extras

| Extra | Tipo | Precio | Unidad | Uso |
|---|---|---|---|---|
| Vaso de gaseosa | `service` | 500 | `unidad` | Línea standalone en `/pedido` y `/ventas`; además ítem opcional `selectedByDefault` dentro de las recetas que lo incluyen |
| Agregado de toppings | `service` | 200 | `unidad` | Línea standalone en `/pedido` y `/ventas` (nombre del menú real); el topping elegido se indica en `notes` de la línea — o un `service` por topping si se quiere conteo fino (ver §5 B-6 y §9.2) |

**"Paquete" — descartado:** no figura en el menú real (los únicos extras son Agregado de toppings y Vaso de gaseosa); la mención previa probablemente se refería a los combos/promos en sí ("paquetes"). Reincorporar solo si el dueño confirma que existe como producto aparte (precio y alcance — §9.3).

### 3.4 Inconsistencias menú ↔ inventario (resueltas con el menú real)

| # | Inconsistencia | Impacto | Propuesta |
|---|---|---|---|
| I-1 | Menú dice "+5 aderezos" pero el pancho común tiene 4 definidos | El set de aderezos por defecto queda ambiguo | **Resuelto por D-1 (corregido):** el tope real es **4 aderezos elegidos por el cliente de los 13** — requiere `maxOptionalSelections=4` en el compuesto (B-13/PR-8); los 4 clásicos quedan como `selectedByDefault` |
| I-2 | El menú pide Pritty **500 cc**, Doble Cola **2,25 L** y Tutti **200 cc**; el inventario tiene Pritty **1 L**, Doble cola **1 L / chica** y Jugo Tutti **475 ml** | Los productos exactos de las promos no existen en el inventario | **Resuelto por D-3:** cargar los ítems del menú con su tamaño real como `critical_supply beverage` (§3.1) — confirmado: el tamaño se determina al crear el producto |
| I-3 | Papas pay↔Papas, Criollita↔Cebolla, Huevo picado↔Huevos, Mayonesa provenzal↔Provenzal+Mayonesa | El `supplyName` del snapshot y la etiqueta que ve el operador deben coincidir con el producto cargado | **Resuelto:** los productos llevan el nombre del menú (es lo que ven cliente y cocina en el toggle/snapshot): "Choclo en grano", "Huevo picado", "Papas pay", "Criollita", "Mayonesa provenzal" — esta última como `manual_supply` propio (es un topping, confirmado) |
| I-4 | El inventario agrupa Cheddar/Parmesano/Fugazzeta/Aceituna/Roquefort/Salame como "Toppings y aderezos", pero el menú los trata como aderezos del completo y sus toppings son otros 5 | Solo nomenclatura; el tipo `manual_supply` es el mismo | Mantener nombres de producto únicos y claros; la distinción aderezo/topping se expresa solo en las recetas |
| I-5 | Bebidas sueltas, cerveza y postres no están en el menú | 17 `critical_supply beverage` activas aparecerían en `/pedido` y `/ventas` aunque no se vendan sueltas | **Resuelto por D-5:** todo se publica (bebidas sueltas, cerveza, postres, promos y servicios) → `isActive=false` ya no se necesita; el flag de visibilidad queda como mejora opcional (PR-4) |
| I-6 | El vaso descartable y la gaseosa servida no se descuentan por el servicio | El consumo real de `Vasos` (manual) queda solo como conteo de servicio | Aceptado como riesgo informativo por el dueño; documentar |

---

## 4. Matriz de trazabilidad por promo

### 4.1 Pipeline verificado (aplica a las 11 promos y a los extras)

| Etapa | Qué pasa | Evidencia |
|---|---|---|
| Catálogo `/pedido` | Muestra `compound`/`service`/bebidas activas con `availability` (solo críticos `autoDiscount` menos reservas activas) y `recipe` (opcionales con `isOptional`/`selectedByDefault`) | `catalogRepository.findPublicProducts` → `catalogService.listPublicCatalogWithAvailability` → `product-helpers.calculateAvailabilityForProductIds` |
| Creación de pedido | Guarda horario + caja abierta → `prepareCart` (existe, activo, vendible, disponibilidad) → `orders` `pending` + `order_items` + `order_item_recipes` (snapshot) + mensaje auto del chat. **No reserva stock** | `orderService.createOrder`; `cart-pipeline.prepareCart`; `order-helpers.buildRecipeSnapshotMessageContent` |
| Recepción | `pending`→`in_process` bajo lock; valida de nuevo; inserta `order_stock_reservations` + movimientos `reserve` (negativos) por insumo crítico seleccionado y bebidas | `orderService.receiveOrder`; `stock-helpers.collectStockProductIdsToLock/iterRecipeConsumptions` |
| Confirmación de pago | Requiere caja abierta → lock del pedido → `reserve_release` de reservas → lock de insumos → `prepareCart` con `buildItems` (precios del pedido) → `sales` + `sale_items` + `sale_item_recipes` + `sale_payments` + movimientos `sale` (descuento atómico `decrementStock`) → actualiza resúmenes de la caja → pedido `paid` con `convertedSaleId` | `orderService.convertOrderToSale`; `saleService.insertSaleAndUpdateCashRegister` |
| Finalización | `paid`→`finished` (solo marca de entrega, sin efectos de stock) | `orderService.finishOrder` |
| Anulación (panel) | `in_process`→`reserve_release`; `paid`→`cancelSale` (caja abierta exigida): `cancellation` + reintegro de insumos y resta de resúmenes | `orderService.cancelOrder`; `saleService.cancelSale`; `stock-helpers.reintegrateStockForItems` |
| Cancelación pública | Solo `pending`/`in_process` con `cancellationToken`; `paid` exige contacto con la sucursal | `orderService.cancelOrder` (token), `/api/public/pedido/[id]/cancelar` |
| Expiración | `pending` vencido (default 1 h, `ORDER_EXPIRATION_MS`) → cancelado lazy + cron `expire-orders` | `orderService.expirePendingOrders/cancelExpiredOrder`; `config/orders.ts` |

### 4.2 Matriz por promo y extra

Columnas: **Descuenta** = insumos con movimiento `sale`/`reserve`; **Informa** = ítems solo registrados (snapshot + resúmenes); **Registro** = dónde queda persistido.

| Promo / extra | Descuenta stock (movimiento) | No descuenta pero queda informado | Registro |
|---|---|---|---|
| Pancho Popular | Pan ×1 (`critical_supply`), Salchichas ×2 | Aderezos seleccionados/quitados (`manual_supply`) | `order_item_recipes`/`sale_item_recipes` (por `selected`), `stock_movements` (`reserve`→`sale`), `cash_registers.productsSummary` ("Pancho Popular" +1), `criticalSuppliesSummary` (Pan +1, Salchichas +2), `recipeSuppliesSummary` (aderezos +n por nombre), `order_messages` (mensaje auto), historial `/ventas` |
| Promo 1 | Pan ×1, Salchichas ×2 | Aderezos + `Vaso de gaseosa` ×1 (service, contado en `recipeSuppliesSummary["Vaso de gaseosa"]`) | idem + service en `recipeSuppliesSummary` |
| Promo 2 | Pan ×1, Salchichas ×2 | 13 aderezos + 5 toppings + `Vaso de gaseosa` | idem |
| Promo Pritty 1 | Pan ×1, Salchichas ×2, Pritty ×1 (`beverage`) | Aderezos | idem + `criticalSuppliesSummary` Pritty +1 |
| Promo Pritty 2 | Pan ×1, Salchichas ×2, Pritty ×1 | 13 aderezos + toppings | idem |
| Promo Amigos 1 | Pan ×2, Salchichas ×4 | Aderezos (×2 sets) + `Vaso de gaseosa` ×2 | `recipeSuppliesSummary["Vaso de gaseosa"]` +2 |
| Promo Amigos 2 | Pan ×2, Salchichas ×4 | Completos + `Vaso de gaseosa` ×2 | idem |
| Promo Popular | Pan ×5, Salchichas ×10, Doble Cola ×1 | Completos (×5 sets) | idem + `criticalSuppliesSummary` Doble Cola +1 |
| Promo Familiar | Pan ×9, Salchichas ×18, Doble Cola ×1 | Aderezos (×9 sets) | idem |
| Promo Familiar Plus | Pan ×9, Salchichas ×18, Doble Cola ×1 | Completos (×9 sets) | idem |
| Popu Kids | Pan ×1, Salchichas ×2, Tutti ×1 | Completo | idem |
| **Vaso de gaseosa (suelto)** | nada (`service` sin stock) | — | `sale_items` (línea propia con `unitPrice` 500), `productsSummary["Vaso de gaseosa"]` +1, **NO** en `recipeSuppliesSummary` |
| **Agregado de toppings (suelto)** | nada (`service`) | topping elegido en `notes` de la línea | `sale_items.notes` + `productsSummary["Agregado de toppings"]` +1 |

**Respuesta específica (punto 4 del encargo):** el total de vasos vendidos **no** se obtiene en un solo lugar hoy: sueltos → `productsSummary["Vaso de gaseosa"]`; dentro de promos → `recipeSuppliesSummary["Vaso de gaseosa"]`. La suma total requiere mirar dos tarjetas del cierre y sumarlas a mano (no hay exportación). Lo mismo aplica a cada topping/aderezo: solo existe `recipeSuppliesSummary` por nombre (sí cubre manuales; no hay separación por producto origen ni vista unificada con sueltos). **Cambio mínimo propuesto:** en `getOpenCashRegisterSummary`/`calculateCashRegisterSummary` agregar una tercera vista consolidada (`suppliesSummary` = merge por nombre de `criticalSuppliesSummary` + `recipeSuppliesSummary` + servicios vendidos sueltos) o, más simple, que la tarjeta "Insumos de recetas" del cierre sume también las líneas de servicios sueltos del mismo nombre (cambio de UI únicamente en `cash-register-summary.tsx`, sin migración).

### 4.3 Trazas end-to-end solicitadas

**Promo Familiar ($11.000: Pan ×9, Salchichas ×18, Doble Cola ×1, aderezos opcionales):**
1. `/pedido`: `availability = min(⌊stockPan/9⌋, ⌊stockSalchichas/18⌋, ⌊stockDobleCola/1⌋)` menos reservas activas (`calculateAvailabilityForProductIds` + `applyReservationsToStock`).
2. `createOrder`: valida horario (si configurado) y caja abierta → `orders.pending`, `order_items` (unitPrice 11000 histórico), `order_item_recipes` con aderezos `selected`/`selectedByDefault`, mensaje auto en `order_messages` ("Detalle de preparación: … Incluye: Pan (9), Salchichas (18), … Sin: Picante").
3. `receiveOrder` → `in_process`: `order_stock_reservations` Pan+9, Salchichas+18, DobleCola+1; `stock_movements.reserve` −9/−18/−1.
4. `convertOrderToSale`: caja abierta exigida → `reserve_release` (+9/+18/+1) → `sale` (−9/−18/−1), `sales` + `sale_items` + `sale_item_recipes` (copia del snapshot) + `sale_payments` (cash/transfer mixto) + `orders.paid` con `convertedSaleId`.
5. Resumen de caja: `productsSummary["Promo Familiar"]+1`, `criticalSuppliesSummary` Pan+9/Salchichas+18/DobleCola+1, `recipeSuppliesSummary` por cada aderezo seleccionado.
6. Anulación con caja abierta: `cancelSale` → movimientos `cancellation` +9/+18/+1, reintegro de stock y resta de los tres resúmenes; el pedido queda `cancelled`.

**Promo Amigos 1 ($2.500: 2 panchos + 2 vasos):** idéntica, con `recipeSuppliesSummary["Vaso de gaseosa"]+2`. El servicio dentro de la promo **no suma su `price` al total** (el precio de la promo es fijo; el `price` del service solo se cobra cuando se vende como línea propia).

---

## 5. Brechas bloqueantes ordenadas por impacto

| # | Brecha | Impacto | Severidad | Esfuerzo |
|---|---|---|---|---|
| B-1 | **No existe carga masiva** de productos/recetas (ni CSV, ni JSON, ni script idempotente; `copyCatalogToBranch` copia stock>0, pierde `isOptional`/`selectedByDefault` y no es parcial) | Sin esto, cargar 59 ítems + 11 recetas es 100 % manual vía UI (error-prone, no repetible, no auditable) | **crítico** | M |
| B-2 | **Datos finales del archivo de carga** (todo decidido con el menú real): volcar nombres/precios/unidades al archivo de datos del script — tamaños confirmados al crear el producto (D-3), "Mayonesa provenzal" = `manual_supply` propio, "Paquete" descartado (no está en el menú) | Nada bloquea el modelado; el script solo necesita el archivo de datos completo | **menor** (era crítico) | S (datos) |
| B-3 | **Sin flag de visibilidad por producto** (`isActive=false` tiene efecto colateral en `/stock` y alertas aunque las recetas siguen consumiéndolas) | **No aplica hoy** (D-5: todo se publica); queda como mejora opcional para ocultar ítems de temporada sin borrarlos | **menor** (era mayor) | M (PR-4 opcional) |
| B-4 | **Postres publicados sin control de stock** (D-5: como `service` con precio) | Aceptable si se compran de a poco; si se quiere stock de postres falta el tipo "vendible con stock" | **menor** (condicionada) | M solo si se quiere stock |
| B-5 | **Los opcionales de receta son siempre quitables** (vía API/UI): los "2 vasos incluidos" de Amigos 1/2 el cliente los puede desmarcar sin cambiar precio | Diferencia entre "incluye" y "a elección"; el negocio debe aceptarlo o se requiere insert directo `isOptional:false` (o feature) | **mayor** | S |
| B-6 | **"Agregado de toppings" no identifica el topping**: como producto único solo cuenta unidades; la elección viaja en `notes` libre | Conteo fino por topping imposible de manera estructurada (mitigación posible: un `service` por topping, §9.2) | **menor** | S |
| B-7 | **Vasos sueltos vs. en promo en contadores separados** sin vista unificada | El conteo total pedido por el dueño requiere sumar dos tarjetas | **mayor** | S |
| B-8 | **Stock fraccionado no representable** ("½ bolsa", "a raspar") | Cierres/arqueos de insumos aproximados; mitigación: contar en unidad mínima o ajustes enteros | **mayor** | L si se quiere exactitud |
| B-9 | **Sin unicidad `(branchId, nombre)`**: un reintento de carga o un alta manual puede duplicar productos | Dedup frágil para el script y para la operación | **mayor** | S (migración + script) |
| B-10 | **Ventas de caja cerrada no anulables** | Errores descubiertos post-cierre no tienen vía de corrección in-app | **menor** | M |
| B-11 | **Sin flag de visibilidad de sucursal**: la nueva aparece en `/pedido` apenas existe, aunque esté vacía | Una sucursal en preparación se expone al público | **menor** | S |
| B-12 | **Sin reportes contables consolidados para el admin** (D-6 redefinió "facturar" como registros contables internos, no fiscal): no hay vista de período con totales agregados ni exportación; los datos sí existen | El administrador no obtiene el registro contable consolidado (ingresos por día/método/sucursal) sin revisar caja por caja | **mayor** | M (PR-7 redefinido) |
| B-13 | **Tope de 4 aderezos elegibles de los 13 — confirmado y no implementable hoy**: `selectedRecipeItemIds` valida que los IDs sean ítems opcionales, no la cantidad elegida | Sin `maxOptionalSelections` un común podría salir con los 13 aderezos gratis; el workaround "solo 4 en receta" quedó descartado porque el cliente elige cuáles 4 | **mayor** (bloquea modelado correcto del común) | M (PR-8) |

---

## 6. Plan de implementación en PRs chicos

Orden sugerido; cada PR es independiente y revertible. **Orden efectivo:** PR-8 (tope de opcionales, requerido por D-1) debe landear **antes** de PR-1 — las recetas del común dependen de `maxOptionalSelections`—; luego PR-1 → PR-2 → PR-3 → PR-6, con PR-7 en paralelo (PR-4 y PR-5 diferidos). Verificación estándar de cada PR: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`, `npx drizzle-kit check`; E2E solo en base descartable (`.env.e2e`, nombre terminado en `test`/`e2e`/`testing`/`qa`/`staging`). Para producción seguir `entornos.md`: migración con `npx drizzle-kit migrate` usando `DATABASE_URL_UNPOOLED` de Vercel (o aplicación manual + fila `__drizzle_migrations` con hash SHA-256, convención de `0031`/`0035`), **con backup previo** (branch de Neon / point-in-time restore) antes de aplicar.

### PR-1 — Script idempotente de carga de catálogo (sin migración) — **implementado 2026-10-04**

- **Contenido:** `scripts/data/catalogo-pancheria-popular.ts` (datos versionados: 59 ítems + 4 productos del menú fuera del inventario (Pritty 500 cc, Doble Cola 2,25 L, Jugo Tutti 200 cc como `critical_supply beverage`; Mayonesa provenzal como `manual_supply`) + 11 recetas + extras: Vaso de gaseosa $500, Agregado de toppings $200; postres incluidos como `service`) y `scripts/cargar-catalogo.ts` (ejecutable con `npx tsx`).
- **Contrato:** `--branch <id|nombre>` o `CARGA_BRANCH`; dry-run por defecto (imprime plan), `--apply` explícito para escribir; transacción única; clave lógica `(branchId, nombre)` con detección de duplicados (skip/report); crea productos con `stock=0` y opcionalmente aplica stock inicial vía `stockService.adjustStock` (`restock`, `performedBy='Script'`) desde el archivo de datos; crea/actualiza recetas respetando `isOptional`/`selectedByDefault` (llama a `saveRecipe` o replica sus reglas); idempotente y reentrante.
- **Sin migración.** Cache: documentar que escrituras directas no invalidan `public-catalog`/`branches` —el script debe finalizar con aviso "esperar `DATA_CACHE_REVALIDATE_S` o redeploy"—; opcionalmente exponer `POST /api/admin/revalidate` (admin) que llame `invalidatePublicCatalogCache()`/`invalidateBranchesCache()`.
- **Tests:** unitario del plan-dry-run (diff/duplicados) con mocks; E2E opcional en base descartable corriéndolo contra una sucursal nueva.
- **Archivos:** `scripts/cargar-catalogo.ts`, `scripts/data/catalogo-pancheria-popular.ts`, `src/lib/` helpers compartidos solo si se reutilizan (`saveRecipe` ya es servicio reutilizable).

### PR-2 — Unicidad `(branchId, nombre)` y/o validación en `createProduct` (migración) — **implementado 2026-10-04**

- **Implementado:** índice único parcial `(branch_id, lower(btrim(name)))` `WHERE deleted_at IS NULL` (`0037_products_branch_name_unique.sql`, aplicado en dev y E2E); `productRepository.findByNameCaseInsensitive`; validación amigable en `createProduct`/`updateProduct`/`restoreProduct` con traducción del error 23505 vía `isUniqueViolationError` (`src/lib/db-errors.ts`) para la ventana de carrera; `restoreProduct` ahora valida que el nombre no lo use otro producto activo. Verificado end-to-end en la base E2E (rechazo case-insensitive con espacios, insert directo rechazado por el índice, no-duplicados insertan).
- **Migración pendiente:** producción según `entornos.md` con backup.

### PR-3 — Vista unificada de insumos en cierre (sin migración) — **implementado 2026-10-04**

- **Implementado:** `buildSuppliesSummary` (`src/lib/summary-helpers.ts`) fusiona por nombre `recipeSuppliesSummary` + entradas no-compuestas de `productsSummary` (servicios y bebidas críticas vendidas sueltas); los compuestos se excluyen porque su consumo ya está desagregado por insumo. `suppliesSummary` es **derivado, no persistido** (sin columna nueva): `summaryService.finalizeSummary` lo computa con los tipos vistos en las ventas y `cashRegisterService.parseCashRegisterSummary` con `productRepository.findAll(branchId, true)` — los productos con ventas nunca se borran permanentes, así que el nombre siempre resuelve. Tarjeta "Consumo total por insumo" nueva en `cash-register-summary.tsx` (visible en caja abierta e historial de cierres).
- **Tests:** `summary-helpers.test.ts` (merge, exclusión de compuestos, sin mutación), `summaryService.test.ts`, `cashRegisterService.test.ts` (fusión con compuestos excluidos), `cash-register-summary.test.tsx` nuevo.
- **Archivos:** `src/lib/summary-helpers.ts`, `src/application/services/summaryService.ts`, `src/application/services/cashRegisterService.ts`, `src/components/caja/cash-register-summary.tsx`.

### PR-4 — Visibilidad pública separada de `isActive` (migración, opcional — diferido: D-5 publica todo)

- **Contenido:** nuevo flag `isPubliclyListed` (o `showInCatalog`, default `true`) en `products`: el catálogo público y `/ventas` filtran por él; `isActive` queda como switch operativo completo (stock, recetas, alertas lo siguen usando). Los `manual_supply` siguen sin ser vendibles por tipo — el flag solo aplica a bebidas/servicios/compuestos. **Diferido:** con D-5 todo el catálogo se publica, así que no bloquea la carga; sigue siendo la mejora correcta si a futuro se quieren ocultar ítems de temporada sin borrarlos.
- **Migración:** `generate` + `migrate` (+ backfill `is_publicly_listed = is_active`).
- **Tests:** `catalogRepository`, `publicSellableConditions`, `/api/productos`, E2E `/pedido` con bebida no listada pero en receta (sigue descontando).
- **Archivos:** `schema.ts`, `catalogRepository.ts`, `catalog.ts`, `sales-terminal.tsx` (filtro), `product-form.tsx` (toggle), `productService.ts`, migración.

### PR-5 — Decisión de "incluidos fijos" en recetas (sin migración, condicional)

- **Contenido:** el usuario no se pronunció sobre quitables — el comportamiento actual (quitables, precio fijo) queda aceptado salvo indicación contraria (§9.5). Si el negocio quiere que "2 vasos incluidos" no sean quitables, permitir `isOptional:false` en `manual_supply`/`service` desde `saveRecipe` (hoy el schema de DB ya lo soporta; solo relaja `recipeItemSchema` y `PromoForm`); la UI muestra esos ítems como "Incluye" fijo.
- **Tests:** `zod-schemas`/`recipeService` (aceptar `isOptional:false` en no-críticos), snapshot con `isOptional:false`.
- **Archivos:** `src/lib/zod-schemas.ts`, `src/components/productos/promo-form.tsx`, `src/lib/recipe-helpers.ts` (formato).

### PR-6 — Operación de la nueva sucursal (sin código, checklist) — **implementado 2026-10-04**

- **Implementado:** runbook `informes/runbook-nueva-sucursal.md` — checklist operativo completo: datos previos (precios pendientes de 22 ítems inactivos, stock en unidad mínima), alta de sucursal (panel o seed), operador, carga del catálogo con `cargar-catalogo.ts` (dry-run → `--apply`), activación de precios, stock inicial, apertura de caja, verificación de punta a punta en descartable (incluye tope de 4 aderezos y reintegro de stock en cancelación), nota de caché y reintentos.
- **Sin migración ni tests** (runbook documental).

### PR-7 — Reportes contables para el administrador (sin migración, según D-6) — **implementado 2026-10-04**

- **Implementado:** `GET /api/reportes/ventas?start&end` (solo admin): consolida por `sales.createdAt` en el rango (incluye ventas huérfanas de cajas eliminadas), totales por método con pagos mixtos, conteo de anuladas aparte, desglose por día en timezone de sucursal y por producto (cantidad + subtotal), y listado de cajas del rango con diferencias de arqueo. `end` `YYYY-MM-DD` es inclusivo (se desplaza al día siguiente). Vista `/reportes` (admin, en el nav): rango con default 30 días, tarjetas de totales + tablas por día/producto/caja, **exportación CSV client-side** (`buildSalesReportCsv`, `;` es-AR, BOM UTF-8, Blob + download, sin dependencias).
- **Sin migración:** todas las fuentes ya existen.
- **Tests:** `reportService.test.ts` (totales, pagos mixtos, anuladas, por día en TZ, por producto, huérfanas de caja, paginación, arqueo), `route.test.ts` (403 no-admin, 400 rangos inválidos, default 30 días), `report-csv.test.ts` (secciones, escaping).
- **Archivos:** `src/application/services/reportService.ts`, `src/app/api/reportes/ventas/route.ts`, `src/app/(panel)/reportes/page.tsx`, `src/components/reportes/reportes-client.tsx`, `src/lib/report-csv.ts`, `src/config/api.ts`/`routes.ts`, `src/components/panel/panel-header.tsx` (nav).
- **Fuera de alcance:** egresos/gastos — no hay registro monetario de compras de stock (los movimientos solo tienen cantidades); si "contable" debe incluir gastos es una tabla/feature aparte (ver §9.16). Comprobante fiscal ARCA/AFIP: proyecto propio si algún día se requiere.

### PR-8 — Tope de opcionales seleccionables en receta (migración, **requerido por D-1**) — **implementado 2026-10-04**

- **Contenido:** el cliente elige **cuáles** 4 aderezos de los 13 en el común — el workaround "solo 4 en receta" quedó descartado porque impediría la sustitución. Campo `maxOptionalSelections` (nullable) en `products` para compuestos — a nivel promo, no por ítem: validación server-side en `assertValidSelectedRecipeItemIds` (rechazar selección > tope) y contador en `PromoOptionsDialog` (deshabilitar toggles restantes al llegar al tope, con mensaje). Idealmente antes de la carga del catálogo (PR-1), porque las recetas del común dependen de la regla.
- **Migración:** `npx drizzle-kit generate` + `migrate` (columna `integer` nullable en `products`).
- **Tests:** `product-helpers`/`zod-schemas` (rechazo al superar el tope; el tope cuenta solo ítems opcionales `selected`), `PromoOptionsDialog` (bloqueo al llegar a 4 + mensaje), E2E opcional en descartable.
- **Archivos:** `src/db/schema.ts` (+ migración), `src/lib/product-helpers.ts` (`assertValidSelectedRecipeItemIds`), `src/components/promo/promo-options-dialog.tsx` (contador), `src/components/productos/promo-form.tsx` (input del tope), `src/lib/recipe-helpers.ts` (formato).
- **Workaround descartado:** cargar solo los 4 clásicos en la receta garantiza el tope pero impide elegir cuáles 4 — no cumple D-1. Solo sirve como degradación temporal si el lanzamiento fuera urgente.

### Requisitos transversales por PR (según `checklist-pre-push.md`)

- Sin `.env` tocado; sin secretos; tests nuevos donde aplica; `npm run knip` limpio; migraciones con `drizzle-kit generate` + `check`; E2E solo descartable; actualizar `reporte-estado.md` al mergear y archivar este informe cuando el plan esté implementado.

---

## 7. Decisiones del usuario (respondidas el 2026-10-04)

| # | Decisión | Respuesta | Implicación para el plan |
|---|---|---|---|
| D-1 | ¿El pancho común lleva 4 o 5 aderezos? | **4 aderezos, es el tope, y el cliente elige cuáles** (de los 13; el "+5" del menú era error) | Requiere `maxOptionalSelections=4` en los compuestos del común (PR-8, requerido): los 13 aderezos van como opcionales, los 4 clásicos (Mayonesa, Ketchup, Salsa golf, Mostaza) como `selectedByDefault`; el cliente sustituye/agrega hasta el tope. Los toppings NO van en la receta del común — se cobran vía "Agregado de toppings" o pasando a completo |
| D-2 | ¿El completo incluye los 5 toppings? | **Sí** | Recetas "completas" = 13 aderezos + 5 toppings, todos `selectedByDefault: true` |
| D-3 | Nombres/tamaños menú↔inventario | **Los productos se definen por sus ml reales** | Las promos referencian el producto del tamaño exacto que se compra: `Pritty 500 cc`, `Doble Cola 2,25 L`, `Jugo Tutti 200 cc` como `critical_supply beverage` nuevos si no existen (§3.1). Los ítems del inventario (Pritty 1 L, Doble cola 1 L/chica, Tutti 475 ml) se cargan con su tamaño real también si coexisten físicamente. **Confirmado:** el tamaño se determina al crear el producto |
| D-4 | Salchichas: ¿unidad o paquete? | **Por unidad** | `unit='unidad'`, stock = unidades (6×paquetes); recetas consumen 1–18 u.; "paquete de 6" solo referencia de compra en el nombre/descripción |
| D-5 | ¿Qué se publica? | **Todo**: bebidas sueltas (las del inventario + las nuevas por ml), cerveza, postres, promos y servicios (vaso de gaseosa, "paquete") | No se usa `isActive=false` → B-3/PR-4 quedan diferidos. Postres y extras se cargan como `service` con precio (vendibles, sin stock). **"Paquete" descartado:** no figura en el menú real (probablemente se refería a los combos); reincorporar solo si el dueño lo confirma como producto (§9.3). Incluidos quitables: no se pronunció → se mantiene el comportamiento actual (quitables) |
| D-6 | Alcance de "facturar" | **Registros contables internos para el administrador** (venta por operador o pedido del cliente ya válida) | No es comprobante fiscal: PR-7 redefinido como reporte consolidado por período + exportación CSV (sin migración). Egresos fuera de alcance salvo pedido expreso. Si algún día se requiere comprobante legal (ARCA/AFIP), es proyecto aparte |

---

## 8. Riesgos y elementos no probados

| Tema | Estado | Motivo |
|---|---|---|
| Comportamiento real con datos en base (pedido→venta→cierre con las 11 promos cargadas) | **No probado** | Auditoría de solo lectura; requiere base descartable y autorización (regla 4 del prompt). La lógica está verificada en código y cubierta por tests unitarios/E2E existentes del dominio |
| `isActive=false` en bebida referenciada por receta activa | Verificado en código, no probado en runtime | `findByIds`/`findRecipesForProducts`/`decrementStock` no filtran `isActive` → la receta sigue consumiéndola y limitando disponibilidad; el efecto UI (`/stock`, alertas) está verificado en código |
| Carga masiva con datos reales (59 ítems + recetas) | **No existe implementación** | El script propuesto es diseño, no código; dry-run/apply/transacción quedan por implementar |
| Concurrencia extrema de reservas con el menú completo | Parcialmente probado | E2E `concurrencia-stock.spec.ts` cubre oversell/reserva única/carreras, pero no con el catálogo de 59 ítems |
| El cliente puede desmarcar "vasos incluidos" sin efecto en precio | Verificado en código | `recipeItemSchema` fuerza `isOptional=true` en no-críticos; `PromoOptionsDialog` renderiza toggles para todos los opcionales |
| `copyCatalogToBranch` corregida para este caso | **No aplicable** | Se descarta como herramienta de carga por las limitaciones verificadas; la vía es el script PR-1 |
| Migración `unique(branchId, lower(name))` sobre datos existentes | **No probado** | Requiere revisar duplicados reales en producción antes de aplicar |
| `productsSummary`/`recipeSuppliesSummary` en cajas cerradas históricas al agregar vista unificada | Verificado estructura JSONB | Las cajas cerradas persisten los tres mapas; la vista unificada puede computarse on-read sin backfill |
| Cron `expire-orders` en la nueva sucursal | Heredado | Es global/por sucursal; `pending` vencido se cancela lazy (1 h default) — sin verificación runtime |
| Caché público tras escrituras directas del script | Verificado | `invalidatePublicCatalogCache`/`invalidateBranchesCache` solo se llaman desde rutas/actions; un script `tsx` externo no los dispara → documentado como riesgo operativo con mitigación (TTL `DATA_CACHE_REVALIDATE_S` o endpoint de revalidación) |

---

### Anexo — respuestas directas a las verificaciones pendientes del prompt

- **`calculateCompoundAvailability`** (`src/lib/availability-helpers.ts → calculateCompoundAvailability`): filtra `autoDiscount` (línea 27); sin ítems críticos devuelve 0 (línea 28); opcionales manuales/servicios no influyen. Con Pan=0 o Salchichas=0 → `Math.min(...)=0` → las 11 promos no disponibles en `/pedido`, `/ventas` y `/api/public/disponibilidad`. Confirmado.
- **Pedir con caja cerrada o sin horarios:** `createOrder` rechaza si (a) hay horarios y `!isBranchOpen` (ValidationError "En este momento no podemos recibir pedidos. Horario de atención: …") y (b) no hay caja abierta, **incluso sin horarios configurados** (líneas 285–296). `/api/public/sucursal/estado` aplica la misma regla (`open = cashRegister && (!hasOpeningHours || isBranchOpen)`). `receiveOrder` no exige caja; `convertOrderToSale` sí. Las alertas `getCashRegisterShiftStatus`/`resolveCashRegisterAlert` son informativas, nunca bloquean. Confirmado.
- **`convertOrderToSale`:** copia el snapshot `order_item_recipes` → `sale_item_recipes` vía `recipeSnapshot` en `saleItemValues` (líneas 625–646 y `saleService.insertSaleAndUpdateCashRegister` líneas 326–345); conserva `unitPrice`/`subtotal` del pedido (`buildItems`); reintegro al anular: `in_process`→`reserve_release`, `paid`→`cancelSale` con `cancellation` + reintegro solo si la caja sigue abierta. Confirmado.
- **Cobertura:** listada en requisito #31. Gaps detectados: no hay E2E específico de multi-sucursal para copia de catálogo (`copyCatalogToBranch` solo se ejerce en helpers), ni test que cubra `isOptional:false` en no-críticos por path directo (fuera del schema).
- **`isActive=false`:** oculta de `/pedido` (`publicSellableConditions`), `/ventas` (`findActivePage` + filtro client), `/api/productos` (incluye `PromoForm` supplies), `/stock` (`findActiveSuppliesPage`) y alertas (`findActive`/`findActiveCriticalSupplies`); **no** afecta `findByIds`/`findRecipesForProducts`/`decrementStock`/`incrementStock` ni la visibilidad en `/productos` (`findAll`, badge "Vendible"=X). La receta la sigue consumiendo y limitando disponibilidad. Confirmado.
- **Carga masiva:** confirmada la inexistencia de importación; la vía UI manual existe (formularios de producto y `PromoForm`); `seeds.ts` tiene `SEED_SAMPLE_CATALOG` (apagado por defecto, catálogo de ejemplo distinto al real) y `copyCatalogToBranch` queda descartada por sus limitaciones. La propuesta es el script PR-1.
- **Exportación:** no existe CSV/PDF/descarga en `src/` (la referencia "+ CSV" del prompt no existe en código); las únicas vistas de totales son las tarjetas de `cash-register-summary.tsx` y la tabla de `caja-history.tsx`. Confirmado.

---

## 9. Consejos y recomendaciones

### Sobre el modelado (antes de cargar)

1. **Nombres = verdad física.** El `supplyName` del snapshot y lo que ve el operador es el `name` del producto: cargar cada producto con su nombre real de compra, incluida la medida cuando importa ("Pritty 500 cc" ≠ "Pritty 1 L"). Documentar el alias del menú en `description` cuando difiera (Papas pay→Papas, Criollita→Cebolla, Huevo picado→Huevos). **"Mayonesa provenzal"** se carga como `manual_supply` propio con el nombre del menú (resuelto: es un topping); Mayonesa y Provenzal quedan como insumos de su preparación, sin receta.
2. **Servicios genéricos con `notes`.** "Agregado de toppings" ($200) como `service` único con precio: la variante elegida viaja en `notes` de la línea (soportado en pedidos y ventas). Si se quiere **conteo por variante**, crear un `service` por topping ("Agregado — Choclo", etc.): más productos pero resumen exacto por nombre. Recomendación: empezar genérico con `notes`; pasar a por-variante solo si el conteo fino se vuelve necesario.
3. **"Paquete" — descartado.** No figura en el menú real (extras: solo Agregado de toppings y Vaso de gaseosa); la mención previa probablemente se refería a los combos/promos en sí. Reincorporar solo si el dueño confirma que existe como producto aparte — si es combo a precio fijo iría como `compound` con receta.
4. **Toppings solo en la receta del completo; común con tope de 4 aderezos.** En el común **no** van toppings en la receta: si fueran opcionales, el cliente los activaría gratis y la completa perdería sentido — se cobran vía "Agregado de toppings" o pasando a completo. El tope del común quedó confirmado en **4 aderezos elegidos por el cliente de los 13** → hace falta `maxOptionalSelections` (B-13/PR-8, requerido); el workaround "solo 4 en receta" no permite sustitución y quedó descartado.
5. **Incluidos quitables (aceptado por defecto).** Con precio fijo de promo, que el cliente desmarque vasos/aderezos incluidos es operable: el cocinero ve lo seleccionado en el snapshot y en el mensaje automático del chat. Solo si el negocio lo sufre → PR-5.
6. **Postres como `service`.** Publicarlos con precio y sin stock alcanza si se compran de a poco; si el volumen crece y se quiere controlar stock, hace falta el tipo "vendible con stock" (feature nueva).

### Sobre la operación de la sucursal nueva

7. **Orden seguro de alta:** crear sucursal + operador → cargar productos (stock 0) → cargar recetas → ajustar stock inicial → probar punta a punta en base descartable antes de producción. La sucursal aparece en `/pedido` apenas existe (sin flag de visibilidad, B-11): hacer el alta cuando el catálogo ya esté listo o aceptar unos minutos de exposición con catálogo vacío.
8. **`minStock` desde el día 1** en Pan, Salchichas y bebidas de promo: activa las alertas de stock bajo (`stockService.listStockAlerts` cubre críticos y manuales con `minStock > 0`) y evita que una promo quede no disponible sin aviso.
9. **Stock inicial entero.** Para "½ bolsa"/"a raspar" registrar el entero más cercano o elegir la unidad mínima consumible al cargar (porción/unidad); los ajustes posteriores se hacen por `/stock` con motivo y quedan auditados (`performedBy`).
10. **Una caja por turno.** Cerrar caja al terminar el turno deja los registros contables alineados a días — es la granularidad con la que hoy se agrupan los totales y la que usará el reporte de PR-7.
11. **Tras correr el script de carga:** las escrituras directas no invalidan el caché público (`public-catalog`/`branches`); esperar `DATA_CACHE_REVALIDATE_S` o redeploy antes de verificar `/pedido` (documentado en PR-1 y §8).
12. **No usar `isActive=false`** sobre productos referenciados en recetas: siguen descontando stock y limitando disponibilidad pero desaparecen de `/stock` y de las alertas (efecto verificado en §8).

### Sobre registros contables (D-6)

13. **Empezar por la agregación existente:** `/api/caja/historial` ya filtra por rango; el reporte consolidado suma `total`/`cashTotal`/`transferTotal`/`totalSales` y diferencias de arqueo sobre esas cajas — todo server-side, sin migración (PR-7).
14. **CSV client-side** (`Blob` + `download`, sin dependencias nuevas) sobre el mismo payload: suficiente para llevar a Excel o al contador.
15. **Definir con el admin qué columnas necesita** (¿por día? ¿por producto? ¿por método de pago? ¿comparación entre sucursales?) antes de diseñar la pantalla — la granularidad por producto sale de `sale_items` (`unitPrice` × `quantity` agregando por producto/nombre).
16. **Egresos quedan fuera:** no hay registro monetario de compras de stock (los movimientos solo tienen cantidades, sin costo). Si "contable" debe incluir gastos, es una tabla/feature nueva — decidirlo cuando el reporte de ingresos ya esté en uso.
17. **Cajas eliminadas permanentemente:** sus ventas asociadas se borran con ellas a nivel app (`sales.cashRegisterId` tiene `onDelete: 'set null'` como red de seguridad). El agregador debe ir por `sales.createdAt` en el rango, no por join a `cash_registers`, para no distorsionar el registro contable.
