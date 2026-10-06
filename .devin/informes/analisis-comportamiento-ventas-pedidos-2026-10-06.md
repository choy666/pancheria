# Análisis del catálogo vendible y comportamiento del sistema ante ventas y pedidos — sucursal "Pancheria Popular Av. Los Minerales" (id 3)

**Estado:** abierto
**Fecha de ejecución:** 2026-10-06
**HEAD:** `796031aa69abac767912205fe42cd22d6e12fd90`
**Alcance:** análisis de solo lectura. El contraste se hizo contra la base de **producción** (`neondb`, credenciales vía `npx vercel env pull .env.production.local --environment=production`) con consultas `SELECT` únicamente, y contra los endpoints públicos de lectura de `https://pancheria-alpha.vercel.app`. No se ejecutaron escrituras, ni endpoints mutantes, ni tests E2E. La evidencia cita `archivo:líneas` contra el `HEAD` indicado. El prompt de origen es `.devin/prompts/analisis-catalogo-ventas-pedidos.md`.

---

## 0. Síntesis ejecutiva

- La sucursal 3 existe en producción, está activa y recién cargada: **76 productos, 76 recetas... ver §1**. Todavía **no operó**: 0 cajas, 0 ventas, 0 pedidos, 0 movimientos de stock. Todo el stock está en `0`.
- **Se pueden vender 35 ítems por el canal público** (`/pedido`): 11 compuestos, 20 bebidas y 4 servicios. En el terminal `/ventas` se venden los mismos 35 (más cualquier activo futuro que cumpla la misma regla de "vendible").
- **El stock solo se descuenta en un punto exacto**: la creación de la fila `sales` (venta directa en `/ventas` o conversión de un pedido en `/pedidos`), con movimientos `stock_movements.type = 'sale'` que decrementan `products.stock`. Los pedidos **nunca descuentan stock**: en `in_process` solo **reservan** (`order_stock_reservations` + movimientos `reserve` de auditoría), y la reserva se libera al convertirse o cancelarse.
- **Los reintegros ocurren solo por anulación de venta** (`cancelSale`, movimientos `cancellation`) y por eliminación definitiva de cajas. Cancelar un pedido `pending` no toca stock; cancelar uno `in_process` libera reservas (`reserve_release`) sin reintegrar nada; cancelar uno `paid` delega en `cancelSale`.
- **Hallazgo operativo:** el endpoint `GET /api/cron/expire-orders` existe y funciona. **`vercel.json` no lo agenda** (solo están `rate-limit-cleanup` y `chat-attachments-cleanup`, ambos `0 0 * * *` — y el plan Hobby no admite frecuencias menores a 1 día), pero **`.github/workflows/expire-orders.yml` lo dispara cada 5 minutos nominales** vía `Bearer CRON_SECRET` (cadencia real observada en `gh run list`: ~3–9 h, por throttling de schedules de alta frecuencia de GitHub Actions). A ello se suma la **expiración lazy** al leer pedidos (panel, seguimiento público, recepción y conversión). Detalle en §10.

---

## 1. Estado real de la sucursal en producción

Consultado el 2026-10-06 con `SELECT` sobre `neondb` (producción).

### 1.1 Fila `branches` (id = 3)

| Campo | Valor |
|---|---|
| `name` | `Pancheria Popular Av. Los Minerales` |
| `location` | URL de embed de Google Maps (Street View, Av. Los Minerales y C. Los Australes) |
| `is_active` | `true` |
| `opening_hours` | `19:30 → 03:00` los **7 días** (turno overnight: `close` < `open` cruza medianoche; ver `src/lib/branch-helpers.ts:248-297`) |
| `phones` | `[{ label: "Principal", number: "3834046923" }]` |
| `created_at` | `2026-10-05 15:30:43 UTC` |

Zona horaria aplicada: `NEXT_PUBLIC_BRANCH_TIMEZONE` con fallback `America/Argentina/Buenos_Aires` (`src/config/branch.ts:71-76`, usado por `isBranchOpen` en `src/lib/branch-helpers.ts:315-322`).

### 1.2 Estado operativo

| Recurso | Filas en producción (branch_id = 3) |
|---|---|
| `users` | 1 → `operador.minerales` (role `operator`, id 5) |
| `cash_registers` | 0 |
| `orders` | 0 |
| `sales` | 0 |
| `stock_movements` | 0 |
| `products` | 76 (todas `is_active = true`, `deleted_at IS NULL`, `stock = 0`, `min_stock = 0`) |
| `recipes` | filas para las 11 promos (ver §3) |

Implicancias del estado actual:

- **Sin caja abierta no se vende ni se reciben pedidos**: `confirmSale` exige caja abierta (`src/application/services/saleService.ts:426-436`), `convertOrderToSale` también (`src/application/services/orderService.ts:527-534`) y `createOrder` la exige para el canal público (`orderService.ts:300-303`).
- **Con stock 0 todo lo vendible con insumo está "sin insumos"**: la disponibilidad calculada de compuestos y bebidas es 0; solo los 4 `service` quedan disponibles (ilimitados). El canal público sigue abierto si hay caja abierta y horario vigente, pero cualquier `createOrder`/`confirmSale` con stock falla con `InsufficientStockError` (§8.1).
- Con `min_stock = 0` la flag `isLow` del panel de stock nunca se activa (`src/application/services/stockService.ts:13-20`): no hay alertas de stock bajo configuradas en esta sucursal.

---

## 2. Catálogo real de la sucursal 3 (76 productos)

Coincide 1:1 con `scripts/data/catalogo-pancheria-popular.ts` (fuente de carga). Clasificación:

| `type` | `critical_supply_type` | Cantidad | ¿Vendible al público? | ¿Descuenta stock? |
|---|---|---|---|---|
| `critical_supply` | `bread` | 1 | No (insumo interno) | Sí, vía receta |
| `critical_supply` | `sausage` | 1 | No (insumo interno) | Sí, vía receta |
| `critical_supply` | `beverage` | 20 | **Sí** (standalone) | Sí, directo (su propio `stock`) |
| `compound` | — | 11 | **Sí** | Indirecto: sus insumos `autoDiscount` |
| `manual_supply` | — | 39 | No | **Nunca** (ajuste manual) |
| `service` | — | 4 | **Sí** | **Nunca** (ilimitado) |

Regla de "vendible al público" en `src/lib/catalog.ts:21-31` (`isPublicSellableProduct`: `compound` + `service` + `critical_supply/beverage`) y replicada en SQL por `src/repositories/catalogRepository.ts:12-26`. El terminal `/ventas` usa el mismo filtro (`src/components/ventas/sales-terminal.tsx`, ver §6.1). Los `manual_supply` **no son vendibles** "porque no se descuentan automáticamente del stock" (comentario `catalog.ts:17-20`).

El panel `/productos` lista los **76 ítems** (incluidos los 41 no vendibles: pan, salchichas y los 39 `manual_supply`) vía `GET /api/productos` (`withAuth` + sucursal de sesión, `src/app/api/productos/route.ts`); fue la otra fuente de contraste del catálogo junto con el catálogo público y el SQL directo.

### 2.1 Insumos críticos no vendibles (2)

| id | Nombre | Precio | Unidad | Uso |
|---|---|---|---|---|
| 247 | Pan super pancho | $0 | unidad | Insumo de las 11 promos (×1, ×2, ×5 o ×9) |
| 248 | Salchichas | $0 | unidad | Insumo de las 11 promos (×2, ×4, ×10 o ×18) |

`critical_supply` no-beverage nunca aparece como producto standalone en ninguna superficie vendible.

### 2.2 Bebidas críticas vendibles (20)

Descuentan **su propio `products.stock`**, una unidad por unidad vendida (`saleService.deductStockForItems`, `src/application/services/saleService.ts:177-204`).

| id | Nombre | Precio | id | Nombre | Precio |
|---|---|---|---|---|---|
| 288 | Coca-Cola 1 L | $1.200 | 293 | Pritty 1 L | $1.000 |
| 289 | Coca-Cola 1,5 L | $1.600 | 305 | Pritty 500 cc | $800 |
| 290 | Coca-Cola chica | $600 | 296 | Agua de pera chica | $600 |
| 291 | Doble cola 1 L | $1.000 | 298 | Agua de pera 1 L | $900 |
| 292 | Doble cola chica | $500 | 297 | Agua de manzana chica | $600 |
| 306 | Doble Cola 2,25 L | $1.500 | 299 | Agua de manzana 1 L | $900 |
| 301 | Fanta 1,5 L | $1.400 | 300 | Agua de pomelo 1 L | $900 |
| 294 | Agua chica 500 ml | $500 | 304 | Cerveza chica 475 ml | $1.200 |
| 295 | Agua 1,5 L | $800 | 303 | Cerveza grande 700 ml | $1.800 |
| 307 | Jugo Tutti 200 cc | $500 | 302 | Jugo Tutti 475 ml | $700 |

Todas con `unit = 'botella'` salvo `Jugo Tutti 200 cc` (`unidad`).

### 2.3 Promos compuestas (11)

Cada promo descuenta los **insumos de su receta con `auto_discount = true` y `selected = true`**. La selección de opcionales queda congelada en el snapshot (`§4.3`). Dos familias de recetas en producción:

- **"Común"** (`max_optional_selections = 4`): 13 aderezos opcionales de los cuales el cliente elige hasta 4; vienen **preseleccionados por defecto** `Ketchup, Mayonesa, Mostaza, Salsa Golf`.
- **"Completa"** (`max_optional_selections = null`): los 18 aderezos+toppings opcionales vienen **preseleccionados todos**; el cliente puede quitar los que quiera, sin tope.

Opcionales = `manual_supply` (`auto_discount = false`, `is_optional = true`): no descuentan stock nunca; solo quedan registrados en el snapshot (`order_item_recipes` / `sale_item_recipes`) y en el resumen de caja por nombre.

| id | Nombre | Precio | Máx. opcionales | Insumos que SÍ descuentan (`auto_discount`) | Fijos no opcionales | Opcionales (cantidad/unidad de promo) |
|---|---|---|---|---|---|---|
| 312 | Súper Pancho | $1.000 | 4 | Pan super pancho ×1, Salchichas ×2 | — | 13 aderezos ×1 (4 preselec.) |
| 313 | Promo 1 | $1.500 | 4 | Pan super pancho ×1, Salchichas ×2 | Vaso de gaseosa ×1 | 13 aderezos ×1 (4 preselec.) |
| 314 | Promo 2 | $2.000 | — | Pan super pancho ×1, Salchichas ×2 | Vaso de gaseosa ×1 | 18 toppings ×1 (todos preselec.) |
| 315 | Promo Pritty 1 | $2.000 | 4 | Pan super pancho ×1, Pritty 500 cc ×1, Salchichas ×2 | — | 13 aderezos ×1 (4 preselec.) |
| 316 | Promo Pritty 2 | $2.500 | — | Pan super pancho ×1, Pritty 500 cc ×1, Salchichas ×2 | — | 18 toppings ×1 (todos preselec.) |
| 317 | Promo Amigos 1 | $2.500 | 4 | Pan super pancho ×2, Salchichas ×4 | Vaso de gaseosa ×2 | 13 aderezos ×2 (4 preselec.) |
| 318 | Promo Amigos 2 | $3.500 | — | Pan super pancho ×2, Salchichas ×4 | Vaso de gaseosa ×2 | 18 toppings ×2 (todos preselec.) |
| 319 | Promo Popular | $10.000 | — | Pan super pancho ×5, Salchichas ×10, Doble Cola 2,25 L ×1 | — | 18 toppings ×5 (todos preselec.) |
| 320 | Promo Familiar | $11.000 | 4 | Pan super pancho ×9, Salchichas ×18, Doble Cola 2,25 L ×1 | — | 13 aderezos ×9 (4 preselec.) |
| 321 | Promo Familiar Plus | $16.000 | — | Pan super pancho ×9, Salchichas ×18, Doble Cola 2,25 L ×1 | — | 18 toppings ×9 (todos preselec.) |
| 322 | Popu Kids | $2.000 | — | Pan super pancho ×1, Salchichas ×2, Jugo Tutti 200 cc ×1 | — | 18 toppings ×1 (todos preselec.) |

Notas:

- `Vaso de gaseosa` (id 310, `service`) aparece como **ingrediente fijo no opcional** en las promos 1, 2, Amigos 1 y Amigos 2: `auto_discount = false`, `is_optional = false` → queda siempre `selected = true` en el snapshot pero no consume stock.
- Los 13 aderezos de la versión "común": Aceituna, Barbacoa, Cheddar, Chimichurri, Fugazzeta, Ketchup*, Mayonesa*, Mostaza*, Parmesano, Picante, Roquefort, Salame, Salsa Golf* (`*` = `selected_by_default`). Los 18 de la "completa" agregan: Choclo en grano, Criollita, Huevo picado, Mayonesa provenzal, Papas Pay (todos `selected_by_default = true` en esa variante).
- **Limitante de disponibilidad real**: con `stock = 0` en Pan y Salchichas, toda promo da disponibilidad 0 (el cálculo toma `min(stock_insumo / qty_receta)` sobre los `autoDiscount`, §5).

### 2.4 Insumos manuales (39)

Todos `price = $0`, `stock = 0`, `min_stock = 0`. **Ninguno descuenta stock en venta ni pedido**: `manual_supply` está explícitamente excluido de `deductStockForItems` y `reintegrateStockForItems` (`src/application/services/saleService.ts:205-208`, `src/lib/stock-helpers.ts:193-195`). Su stock se mueve solo por `POST /api/stock/ajustar` (`manual_adjustment` / `restock`).

Aderezos/toppings de receta (18): Aceituna, Barbacoa, Cheddar, Chimichurri, Choclo en grano, Criollita, Fugazzeta, Huevo picado, Ketchup, Mayonesa, Mayonesa provenzal, Mostaza, Papas Pay, Parmesano, Picante, Roquefort, Salame, Salsa Golf.

Insumos operativos (21): Aceite, Ajo, Bolsas, Caja descartable chica, Caja descartable grande, Caldos, Cintas, Detergente, Folex, Gas, Lavandina, Líquido para piso, Morrones, Porta panchos super, Provenzal, Rollo de cocina, Sal gruesa, Sorbetes, Tomate, Vasos, Vinagre.

### 2.5 Servicios (4)

`service` = vendible, `stock` ignorado, disponibilidad ilimitada (`src/lib/product-helpers.ts` lo trata como tal en `calculateAvailabilityByProduct`, §5).

| id | Nombre | Precio | Rol |
|---|---|---|---|
| 308 | Postre Oreo | $800 | Vendible standalone |
| 309 | Flan | $700 | Vendible standalone |
| 310 | Vaso de gaseosa | $500 | Vendible standalone **e ingrediente fijo** de 4 promos |
| 311 | Agregado de toppings | $200 | Vendible standalone (extra cobrable) |

---

## 3. Reglas de descuento de stock por producto e insumo

### 3.1 Semántica de las flags de receta

`recipes` (`src/db/schema.ts:176-198`) define por fila `(compound_product_id, supply_id)`:

| Flag | Efecto |
|---|---|
| `quantity` | Unidades del insumo consumidas por **cada unidad** del compuesto vendido |
| `auto_discount` | `true` → el insumo entra al cálculo de disponibilidad, a reservas y al descuento de stock. `false` → solo documental |
| `is_optional` | `true` → el cliente/operador puede quitarlo. `false` → va siempre `selected = true` |
| `selected_by_default` | Preselección inicial del toggle en UI (quick-add y diálogo de opciones) |

El snapshot `RecipeItemConfig` (`src/domain/types.ts:161-170`) agrega `selected` (la elección efectiva del momento) y `supplyName`/`supplyType` (congelados).

### 3.2 Regla exacta de consumo

En `iterRecipeConsumptions` (`src/lib/stock-helpers.ts:64-90`), usado por deducción, reintegro y reservas:

> Un compuesto consume **solo** los ítems de receta con `autoDiscount = true` **y** `selected = true`.

Y `collectStockProductIdsToLock` (`src/lib/stock-helpers.ts:32-62`) decide qué filas de `products` se bloquean (`FOR UPDATE`) y se cuentan como stock:

| Tipo de producto en la línea | ¿Descuenta/reserva/bloquea? |
|---|---|
| `compound` | Sus insumos `autoDiscount && selected` (snapshot si existe; receta vigente si no) |
| `critical_supply` + `beverage` | Él mismo (`products.stock` propio) |
| `critical_supply` + `bread`/`sausage` | Solo como insumo de receta, nunca standalone |
| `service` | Nunca |
| `manual_supply` | Nunca |

Casos concretos del catálogo real:

- Vender 1 **Súper Pancho** con los 4 aderezos por defecto descuenta `Pan super pancho −1` y `Salchichas −2`. Los aderezos elegidos se registran pero no descuentan (todos son `manual_supply`/`autoDiscount = false`).
- Vender 1 **Promo Familiar** descuenta `Pan −9`, `Salchichas −18`, `Doble Cola 2,25 L −1`.
- Vender 1 **Coca-Cola chica** descuenta `Coca-Cola chica −1` (su propio stock).
- Vender 1 **Flan** o **Agregado de toppings** no mueve stock.
- Elegir/quitar aderezos **no cambia** qué se descuenta (ningún opcional es `autoDiscount` en este catálogo), pero sí cambia el snapshot registrado. Si en el futuro un insumo `autoDiscount` se marcara opcional, quitarlo sí evitaría su consumo.

### 3.3 Construcción del snapshot de receta

`buildRecipeSnapshot` (`src/lib/product-helpers.ts:75-106`) corre al crear la operación:

- Ítems **no opcionales** → `selected = true` siempre.
- Ítems **opcionales** → `selected = true` solo si su `supplyId` está en `selectedRecipeItemIds` del request.
- `assertValidSelectedRecipeItemIds` (`product-helpers.ts:46-73`) rechaza IDs desconocidos/no opcionales y **valida `maxOptionalSelections`** (máx. 4 en la familia "común").
- El snapshot se guarda por ítem en `order_item_recipes` / `sale_item_recipes` con los 8 campos congelados (§7).

En la UI, `useSellableCart` + `cart-helpers.getDefaultSelectedRecipeItemIds` (`src/lib/cart-helpers.ts:53-74`) aplican `selectedByDefault` al quick-add; el diálogo de opciones (`src/components/promo/promo-options-dialog.tsx:170-226`) bloquea toggles al llegar al tope y permite notas por línea (`ITEM_NOTE_MAX_LENGTH = 200`, `cart-helpers.ts:16`). Al enviar, `groupCartItemsForSubmit` (`cart-helpers.ts:76+`) agrupa líneas idénticas (mismo producto + mismas selecciones + mismas notas) en una sola línea con `quantity` sumada.

---

## 4. Cálculo de disponibilidad (qué "se puede vender" en cada momento)

### 4.1 Fórmula

`calculateAvailabilityForProductIds` / `calculateAvailabilityByProduct` (`src/lib/product-helpers.ts:287-392`, `606-644`):

| Tipo | Disponibilidad |
|---|---|
| `service` | Ilimitada (no se calcula contra stock) |
| `critical_supply` `beverage` | `floor((stock − reservado) / 1)` |
| `compound` | `min` sobre insumos `autoDiscount` de `floor((stock_insumo − reservado_insumo) / qty_receta)`; si la receta no tiene `autoDiscount`, la promo no puede venderse (0) |
| `manual_supply`, `bread`, `sausage` | No son vendibles standalone |

Las **reservas activas** (`order_stock_reservations`) se descuentan del disponible sin tocar `products.stock`: `applyReservationsToStock` (`product-helpers.ts:548-557`). Con `excludeOrderId` se ignora la propia reserva del pedido (usado en `convertOrderToSale`, `orderService.ts:652`).

Para la disponibilidad de las "comunes" (tope 4 aderezos) se computa además `cappedDefaultIds`: el `defaultSelectedIds` de la receta capado a `maxOptionalSelections` (`product-helpers.ts:347-360`), porque la disponibilidad se mide con la selección por defecto del quick-add.

### 4.2 Endpoints de disponibilidad

| Endpoint | Auth | Store de rate limit | Servicio |
|---|---|---|---|
| `POST /api/ventas/disponibilidad` | sesión (`withAuth`) | — | `validateCartAvailability` (re-export de `product-helpers`, `saleService.ts:44`) — `src/app/api/ventas/disponibilidad/route.ts:7-18` |
| `GET /api/productos/disponibilidad?productId=` | sesión | — | `calculateAvailability` — `src/app/api/productos/disponibilidad/route.ts:7-22` |
| `POST /api/public/disponibilidad` | público (`branchId` opcional) | **en memoria** (`availability_poll`) | `catalogService.validatePublicCart` — `src/app/api/public/disponibilidad/route.ts:22-59` |
| `GET /api/public/catalogo?includeAvailability=true` | público | — (CDN `s-maxage`) | `catalogService.listPublicCatalogWithAvailability` — `src/app/api/public/catalogo/route.ts:26-50` |

Los checks **no bloquean**: son lectura. El bloqueo real ocurre dentro de la transacción de `confirmSale`/`createOrder`/`receiveOrder`/`convertOrderToSale` (verificación + `assertNoStockShortage` + lock de insumos).

### 4.3 Uso en las tres superficies

- `/ventas`: el carrito llama `POST /api/ventas/disponibilidad` al cambiar líneas; las líneas con faltante se marcan "Sin insumos suficientes: falta {insumo} (disponible X, requerido Y)" y el botón Confirmar queda deshabilitado (`src/components/ventas/sales-cart.tsx:75-99,204-213`).
- `/pedido`: el catálogo SSR trae `includeAvailability`; el checkout revalida con `POST /api/public/disponibilidad` antes de enviar (`src/components/pedido/usePedidoClient.ts:308-340`). Al cliente **nunca** se le muestran insumos ni cantidades: `publicShortageMessage` reescribe el error (`src/lib/public-errors.ts:11-33`).
- `/pedidos`: la recepción (`receiveOrder`) revalida con la misma función bajo lock antes de reservar (`orderService.ts:769-777`).

---

## 5. Superficies y endpoints

### 5.1 `/ventas` — terminal POS (operador, sesión)

Página `src/app/(panel)/ventas/page.tsx` → `SalesTerminal` (`src/components/ventas/sales-terminal.tsx`). Muestra solo productos vendibles (mismo filtro que el público) con disponibilidad calculada; deshabilita el carrito si no hay caja abierta.

| Acción UI | Endpoint | Servicio | Auth |
|---|---|---|---|
| Pre-check de carrito | `POST /api/ventas/disponibilidad` | `validateCartAvailability` | `withAuth` |
| **Confirmar venta** | `POST /api/ventas` | `saleService.confirmSale` | `withAuth` (branchId de sesión; admin por cookie `activeBranchId`) |
| Historial | `GET /api/ventas?date=` / `?cashRegisterId=` | `listSalesByDateRange` / `listSalesByCashRegister` | `withAuth` |
| **Anular venta** | `POST /api/ventas/:id/anular` | `saleService.cancelSale` | `withAuth` |
| Ajuste/reposición de stock | `POST /api/stock/ajustar` | `stockService.adjustStock` | `withAuth` (cualquier rol) |

### 5.2 `/pedidos` — panel de pedidos (operador, sesión)

Página `src/app/(panel)/pedidos/page.tsx` → `PedidosList` (lista con poll configurable, `getPedidosRefreshIntervalMs`, default deshabilitado) + `src/app/(panel)/pedidos/[id]/page.tsx` → `PedidoDetail`.

`PedidoActions` (`src/components/pedidos/pedido-actions.tsx:45-50`) define los botones:

| Estado | Recibir | Confirmar (facturar) | Finalizar | Cancelar |
|---|---|---|---|---|
| `pending` | ✔ | ✔ (si hay caja abierta) | — | ✔ |
| `in_process` | — (idempotente) | ✔ (si hay caja abierta) | — | ✔ |
| `paid` | — | — | ✔ | ✔ |
| `finished` | — | — | — | — |
| `cancelled` | — | — | — | — |

| Acción | Endpoint | Servicio | Efecto de estado |
|---|---|---|---|
| Listar | `GET /api/pedidos?status=&search=` | `getOrders` (+ lazy expiration) | — |
| Detalle | `GET /api/pedidos/:id` | `getOrderById` (+ lazy expiration) | — |
| **Recibir** | `POST /api/pedidos/:id/recibir` | `receiveOrder` | `pending → in_process` + reserva |
| **Confirmar/facturar** | `POST /api/pedidos/:id/confirmar` | `convertOrderToSale` | `pending/in_process → paid` + venta + descuento |
| **Finalizar** | `POST /api/pedidos/:id/finalizar` | `finishOrder` | `paid → finished` |
| **Cancelar** | `POST /api/pedidos/:id/cancelar` | `cancelOrder` | `pending/in_process/paid → cancelled` |
| Chat | `GET/POST /api/pedidos/:id/chat`, `POST .../chat/leido`, `GET .../chat/stream` (SSE), `POST .../chat/upload` | `chatService` (`sendOperatorMessage`, `listOperatorMessages`, …) | mensajes en `order_messages` |
| Ubicación en chat | `POST /api/pedidos/:id/chat/ubicacion` | `chatService.sendBranchLocationMessage` | el **operador** envía la ubicación de la sucursal; rate limit `branch-location` — `src/app/api/pedidos/[id]/chat/ubicacion/route.ts:13-41` |
| Adjuntos | `GET /api/chat/attachment/[key]` | sirve el archivo del storage | los links públicos incluyen `?token=` del pedido |

Detalle de permisos: `GET /api/pedidos` permite `?branchId=` solo a `admin` (un `operator` que pida otra sucursal recibe `403`) — `src/app/api/pedidos/route.ts:29-46`. El `branchId` efectivo sale de la sesión (o de la cookie de sucursal activa del admin, `src/lib/auth.ts:114-127`).

### 5.3 `/pedido` — canal público (cliente, sin sesión)

Página `src/app/(public)/pedido/page.tsx` (`force-dynamic`): resuelve `branchId` (query param o sucursal por defecto), carga catálogo paginado con `listPublicCatalogWithAvailability` (página inicial por SSR, tamaño `getCatalogPageSize` = 48 default, `src/config/catalog.ts:24-32`) y lista de sucursales.

| Acción | Endpoint | Servicio | Guardas |
|---|---|---|---|
| Ver catálogo | `GET /api/public/catalogo?branchId=3&includeAvailability=true` | `listPublicCatalog(WithAvailability)` | CDN `s-maxage` 10s + `stale-while-revalidate` 30s (`src/config/catalog.ts:34-69`); sucursal inactiva → 404/error (`resolvePublicBranchId`, `src/lib/branch-resolver.ts:84+`) |
| Estado de sucursal | `GET /api/public/sucursal/estado?branchId=3` | — | `branchId` **obligatorio** |
| Pre-check carrito | `POST /api/public/disponibilidad` | `validatePublicCart` | rate limit **en memoria** `availability_poll` (240 req/min default) |
| **Crear pedido** | `POST /api/public/pedido?branchId=3` | `createOrder` | rate limit DB `order` (10 req/min/IP default); valida `orderSchema`; sucursal activa + en horario + caja abierta |
| **Cancelar pedido (cliente)** | `POST /api/public/pedido/:id/cancelar?branchId=3` | `cancelOrder` | rate limit DB `order-cancellation`; `token` en body obligatorio |
| Seguimiento | `POST /api/public/pedido/seguimiento` | `trackOrder` | rate limit DB `order-tracking`; número + nombre o teléfono |
| Estado (poll) | `GET /api/public/pedido/:id/estado?token=` | `getOrderChatStatus` | `token` **obligatorio** (sin él → 400); rate limit **en memoria** `pedido_poll` |
| Chat | `GET/POST /api/public/pedido/:id/chat`, `POST .../chat/leido`, `GET .../chat/stream` (SSE, `?token=` obligatorio), `POST .../chat/upload` | `chatService` | `token` del pedido; adjuntos por `GET /api/chat/attachment/[key]?token=` |

Características exclusivas del canal público:

- El **token de cancelación** se genera en `createOrder` (`generateCancellationToken`, `src/lib/order-helpers.ts:11-13`), se guarda en `orders.cancellation_token` (único, `schema.ts:370-372`) y se devuelve solo al creador del pedido (respuesta `201` con `cancellationToken`, `src/app/api/public/pedido/route.ts:87-111`). También vuelve en `trackOrder` mientras el pedido siga abierto.
- Los errores de stock llegan reescritos: `INSUFFICIENT_STOCK` + `productName` (`src/app/api/public/pedido/route.ts:57-71`) y `toPublicErrorMessage` oculta términos internos (`src/lib/public-errors.ts:41-66`).
- El botón de cancelación del cliente **solo existe en `PedidoSuccessDialog`** (inmediatamente después de crear el pedido, `src/components/pedido/pedido-success-dialog.tsx:253-272`). El `OrderTracker` y el `RecentOrdersBanner` **no** ofrecen cancelar: muestran estado; el banner solo oculta recordatorios (`localStorage`, `src/lib/recent-orders.ts`). El chat queda en solo lectura cuando el pedido está `finished`/`cancelled`.

### 5.4 Procesos sin UI

| Proceso | Endpoint | Efecto | Protección |
|---|---|---|---|
| **Expiración de pedidos** | `GET /api/cron/expire-orders` | `expirePendingOrders` — §10 | `withCronAuth` (`Authorization: Bearer CRON_SECRET`, timing-safe, `src/lib/cron-handler.ts:14-53`) — no agendado en `vercel.json`; lo dispara **GitHub Actions** (`expire-orders.yml`, `*/5` nominal) |
| Limpieza rate limits | `GET /api/cron/rate-limit-cleanup` | borra filas vencidas de `public_order_rate_limits` y `login_attempts` | `withCronAuth` — agendado `0 0 * * *` |
| Limpieza adjuntos chat | `GET /api/cron/chat-attachments-cleanup` | borra adjuntos viejos | `withCronAuth` — agendado `0 0 * * *` |
| Cierre automático de caja | — (lazy, en `getOpenCashRegister`) | cierra caja abierta > `CAJA_AUTO_CLOSE_HOURS` (default **deshabilitado**, `0`) | `src/application/services/cashRegisterService.ts:60-105` |
| **Lazy expiration** | dentro de `getOrderById`, `getPendingOrders`, `getOrders`, `trackOrder`, `receiveOrder`, `convertOrderToSale`, `getChatStreamState`/`pollChatStreamTick`/`listClientMessages` vía `isOrderExpired` | cancela `pending` vencidos al leerlos | `orderService.ts:863-911,1009-1082` |

---

## 6. Secuencias exactas por operación

### 6.1 Venta directa — `confirmSale` (`POST /api/ventas`)

`saleService.confirmSale` (`src/application/services/saleService.ts:396-486`):

1. Hash de idempotencia `sale.create` (items normalizados + pagos) y clave con scope `branchId:` (`idempotencyService.ts:33-58`).
2. Re-chequeo de clave existente → deduplicado o `409` si el payload difiere.
3. `getOpenCashRegister` → **sin caja abierta: `ValidationError`** ("No hay una caja abierta…"); también aplica el cierre automático lazy si `CAJA_AUTO_CLOSE_HOURS > 0` (`cashRegisterService.ts:60-105`).
4. Transacción (`executeInTransaction`):
   a. `prepareCart` con `shouldLock: true` (`src/lib/cart-pipeline.ts:53-108`): contexto de productos+recetas → `lockForUpdate` de los insumos a consumir → `validateProductsForOperation` (existen, activos, sucursal) → `validateCartAvailability` (stock − reservas) → `assertNoStockShortage` → `buildSaleItemValues` (precios congelados + snapshot de receta por ítem).
   b. `validatePaymentParts` (pagos no vacíos, método único por parte, suma exacta al total en centavos — `src/lib/payment-helpers.ts:66-100`).
   c. `insertSaleAndUpdateCashRegister` (`saleService.ts:273-394`):
      - `INSERT sales` (con `idempotencyKey`/`idempotencyHash`; colisión → recupera la existente, `saleRepository.insertSale` es *idempotent insert*).
      - `INSERT sale_items` (productId, quantity, **unitPrice, subtotal** históricos, notes).
      - `INSERT sale_item_recipes` (8 campos por línea de snapshot).
      - `INSERT sale_payments` (una fila por medio de pago).
      - **`deductStockForItems` (`saleService.ts:121-212`)**: lock de insumos → `decrementStock` de cada insumo `autoDiscount && selected` y de cada bebida → `INSERT stock_movements` con `type='sale'`, `quantity` negativa, `saleId`, `reason='Venta #<id>'`. Si un decremento no alcanza (`decrementStock` atómico con `stock >= qty`) → `InsufficientStockError` → rollback total.
      - Lock de la caja + verificación `open` → `updateCashRegisterSummary` 'add' (`saleService.ts:55-119`): `total`, `cashTotal`, `transferTotal`, `totalSales` y los tres JSONB de resumen (§7.4).

**Tablas escritas:** `sales`, `sale_items`, `sale_item_recipes`, `sale_payments`, `stock_movements`, `products` (stock), `cash_registers` (totales y resúmenes).

### 6.2 Creación de pedido público — `createOrder` (`POST /api/public/pedido`)

`orderService.createOrder` (`src/application/services/orderService.ts:261-408`):

1. Validaciones previas **fuera de transacción**: sucursal existe y `isActive` (`orderService.ts:267-276`), **horario** (`isBranchOpen` si hay `openingHours`, `292-298`), **caja abierta** (`300-303`).
2. Idempotencia `order.create` (items + cliente + delivery) — clave con scope `branchId:` (`140-149`, `278-286`).
3. Transacción:
   a. `prepareCart` **sin lock** (`310-315`): valida productos/disponibilidad y congela precios+snapshot. (Sin lock porque no consume nada todavía.)
   b. `generateOrderNumber(branchId)` + `generateCancellationToken()` (`src/lib/order-helpers.ts:7-13`).
   c. `INSERT orders` vía `insertOrderIdempotent` (`orderRepository.ts:400-432`) — status `pending`.
   d. `INSERT order_items` + `INSERT order_item_recipes` (snapshot por ítem, `orderService.ts:358-384`).
   e. Si hay receta con opcionales: `INSERT order_messages` con el mensaje de sistema "Sistema" que lista incluidos/quitados (`buildRecipeSnapshotMessageContent`, `src/lib/order-helpers.ts:81+`).
4. Respuesta `201` con `cancellationToken`, `expiresAt` (`createdAt + ORDER_EXPIRATION_MS`), ítems públicos y `deduplicated` si aplicaba.

**Tablas escritas:** `orders`, `order_items`, `order_item_recipes`, `order_messages` (condicional), `public_order_rate_limits` (por el rate limiter, fuera del servicio).

**Stock:** intacto. No hay reserva en `pending`.

### 6.3 Recepción — `receiveOrder` (`POST /api/pedidos/:id/recibir`)

`orderService.receiveOrder` (`orderService.ts:692-815`):

1. Chequeos: existe (404), `in_process` → idempotente, cualquier otro estado ≠ `pending` → `ValidationError`.
2. Transacción con `findByIdForUpdate`:
   a. Re-check de estado bajo lock + **detección de expiración** (`isExpiredPending` → `ExpiredPendingOrderError`; el `catch` externo la cancela con `cancelExpiredOrder` y devuelve `409`, `orderService.ts:806-813`).
   b. `ensureOrderRecipeSnapshots`: si un ítem perdió su snapshot (pedido viejo), lo reconstruye con la receta vigente y la selección guardada (`orderService.ts:103-123`).
   c. Lock de insumos a consumir → `validateCartAvailability` con `excludeOrderId = orderId` (defensivo: el pedido aún no tiene reservas propias, pero si existieran legadas no se auto-bloquearía) → `assertNoStockShortage`.
   d. Si no hay reservas previas: `INSERT order_stock_reservations` (`buildReservationsForItems`, `orderService.ts:214-259`: suma consumos por insumo — compuestos vía snapshot + bebidas directas) + `INSERT stock_movements` `type='reserve'` con `quantity` **negativa** y `orderId` (`insertStockReserveMovements`, `orderService.ts:189-212`).
   e. `UPDATE orders.status = 'in_process'`.

**Tablas escritas:** `order_stock_reservations`, `stock_movements` (tipo `reserve`), `orders` (status).

**Stock:** `products.stock` **no se toca**. La reserva baja la *disponibilidad* para otros, no el stock físico. Los movimientos `reserve`/`reserve_release` son de **auditoría**: suman/restan simbólicamente pero `stock` solo cambia con `sale`/`cancellation`/`manual_adjustment`/`restock`.

### 6.4 Conversión a venta — `convertOrderToSale` (`POST /api/pedidos/:id/confirmar`)

`orderService.convertOrderToSale` (`orderService.ts:497-690`):

1. Hash `sale.order-conversion` (orderId + pagos) + clave con scope `branchId:`; dedup igual que venta.
2. `getOpenCashRegister` → sin caja → `ValidationError` ("No hay una caja abierta. Abrí la caja para confirmar el pedido.").
3. Chequeos: existe (404); `paid`/`finished` → 400 ("ya fue pagado o finalizado"); `cancelled` → 400; `validatePaymentParts` contra `order.total`.
4. Transacción con lock de la orden:
   a. Re-check estado + expiración (misma guarda que `receiveOrder` → `409` tras cancelar afuera).
   b. Si `in_process`: `DELETE order_stock_reservations` + movimientos `reserve_release` (`orderService.ts:609-620`).
   c. Lock de insumos (`collectStockProductIdsToLock` + `lockForUpdate`).
   d. `prepareCart` con `buildItems` = ítems del pedido (unitPrice/subtotal/notes/snapshot **congelados del pedido**) y `excludeOrderId = orderId` → revalida disponibilidad ignorando la reserva propia (`orderService.ts:632-653`).
   e. `validatePaymentParts` contra `saleTotal` recalculado.
   f. `insertSaleAndUpdateCashRegister` — **acá se descuenta stock** (misma lógica de §6.1: `sales`, `sale_items`, `sale_item_recipes`, `sale_payments`, `stock_movements type='sale'`, resumen de caja 'add').
   g. `UPDATE orders`: `status='paid'`, `convertedSaleId = sale.id`.

**Tablas escritas:** `order_stock_reservations` (DELETE), `stock_movements` (`reserve_release` + `sale`), `sales`, `sale_items`, `sale_item_recipes`, `sale_payments`, `products` (stock), `cash_registers`, `orders` (status + `converted_sale_id`).

Nota de diseño: en la conversión los movimientos quedan `reserve_release` (liberación de la reserva) **seguidos de** `sale` (descuento real). El neto sobre `products.stock` es solo el `sale`.

### 6.5 Finalización — `finishOrder` (`POST /api/pedidos/:id/finalizar`)

`orderService.finishOrder` (`orderService.ts:817-861`): `paid → finished` bajo lock; idempotente si ya está `finished`; cualquier otro estado → `ValidationError`. **No escribe stock ni caja.**

### 6.6 Anulación de venta — `cancelSale` (`POST /api/ventas/:id/anular`)

`saleService.cancelSale` (`saleService.ts:488-610`):

1. `findByIdWithDetails` → 404 si no existe; si ya está `cancelled` → devuelve la venta (idempotente).
2. **Guarda de caja**: la caja de la venta debe estar `open`, no eliminada y de la misma sucursal → si no, `ValidationError` ("No se puede anular una venta de una caja cerrada o eliminada.", `saleService.ts:537-546`). **Las ventas de cajas cerradas/eliminadas no se pueden anular.**
3. `cancelIfActive` (lock + `UPDATE sales`: `status='cancelled'`, `cancelledAt`, `cancellationReason`).
4. `buildProductContext` con `includeDeleted: true` → la anulación funciona aunque el producto esté en papelera (`saleService.ts:585-592`).
5. `reintegrateStockAndUpdateCashRegister` (`saleService.ts:214-271`):
   - `reintegrateStockForItems` (`src/lib/stock-helpers.ts:127-199`): `incrementStock` de insumos `autoDiscount && selected` del **snapshot histórico** y de bebidas → `INSERT stock_movements` `type='cancellation'`, `quantity` positiva, `saleId`, `reason='Anulación de venta #<id>'`.
   - Lock de la caja + re-verificación `open` → `updateCashRegisterSummary` 'subtract' (resta total, montos por método, `totalSales` y los JSONB de resumen).

**Tablas escritas:** `sales` (status/cancelación), `stock_movements` (`cancellation`), `products` (stock +), `cash_registers` (resumen −).

### 6.7 Cancelación de pedido — `cancelOrder`

`orderService.cancelOrder` (`orderService.ts:410-495`). Dos superficies convergen:

| | Operador (`POST /api/pedidos/:id/cancelar`) | Cliente (`POST /api/public/pedido/:id/cancelar`) |
|---|---|---|
| Auth | sesión (`withAuth`) | **`token` en body** + rate limit `order-cancellation` |
| Motivo | obligatorio (`cancellationSchema`, min 3) | obligatorio por schema; la UI envía "Cancelado por el cliente" si se deja vacío |
| Estados permitidos | `pending`, `in_process`, `paid` | `pending`, `in_process` (`paid` → "ya fue pagado, comunicate con la sucursal", `orderService.ts:439-443`) |
| `finished` | 400 | 400 |
| Ya `cancelled` | idempotente (devuelve el pedido) | idempotente |

Efecto por estado (transacción con lock, `orderService.ts:445-494`):

- `pending`: libera reservas legadas si existieran (defensivo) → `status='cancelled'` + `cancelledAt` + `cancellationReason`. Sin stock ni caja.
- `in_process`: `DELETE order_stock_reservations` + movimientos `reserve_release` (positivos) → `cancelled`. Sin reintegro de stock (no se había descontado).
- `paid` con `convertedSaleId`: delega en `cancelSale` (§6.6: reintegro de stock + resta del resumen de caja + venta `cancelled`) → `cancelled`.

### 6.8 Expiración de `pending`

- **Cron** `GET /api/cron/expire-orders` → `expirePendingOrders` (`orderService.ts:919-994`): lotes de 200 (`findExpiredPendingIds` con `createdAt < now − ORDER_EXPIRATION_MS`), presupuesto de tiempo (`getExpireOrdersTimeBudgetMs` = 4 min default, `src/config/orders.ts:20-42`), cada pedido se cancela con `cancelExpiredOrder` en su propia transacción (lock + `status='pending'` re-verificado + liberación de reservas legadas + `cancelledAt` + motivo "Expiración automática por inactividad", `orderService.ts:1047-1082`). Reentrante: si agota el presupuesto, loguea lo que falta.
- **Lazy**: `expireStalePendingOrders` (`orderService.ts:1009-1040`) corre dentro de `getOrderById`, `getPendingOrders`, `getOrders`, `trackOrder`; `isExpiredPending` corta `receiveOrder`/`convertOrderToSale` con `409`. En lecturas del chat (`listClientMessages`, `getChatStreamState`) se expone `isExpired`/`expiresAt` (`chatService.ts:83-88,175-176,263-265`).

`ORDER_EXPIRATION_MS` default **1 hora**, mínimo 1 minuto (`src/config/orders.ts:7-18`). Solo `pending` expira; `in_process` no vence porque ya fue aceptado (`orderService.ts:1084-1094`).

---

## 7. Tablas escritas y snapshots históricos

### 7.1 Matriz comparativa: acción (botón/endpoint) × efecto en stock × tablas escritas × efecto en caja

| Operación (superficie → endpoint) | Efecto en stock | Tablas escritas | Efecto en caja |
|---|---|---|---|
| `confirmSale` — `/ventas` → `POST /api/ventas` | **Descuenta** insumos `autoDiscount && selected` + bebidas (`products.stock` −) | `sales`, `sale_items`, `sale_item_recipes`, `sale_payments`, `stock_movements`(`sale`), `products`, `cash_registers` (resumen +) | **Suma** total/métodos/`totalSales`/resúmenes |
| `createOrder` — `/pedido` → `POST /api/public/pedido` | Nada (ni descuento ni reserva) | `orders`, `order_items`, `order_item_recipes`, `order_messages`(opcional), `public_order_rate_limits`(por rate limit) | Nada |
| `receiveOrder` — `/pedidos` → `POST /api/pedidos/:id/recibir` | **Reserva** insumos/bebidas (baja disponibilidad, no `products.stock`) | `order_stock_reservations`, `stock_movements`(`reserve`), `orders.status` | Nada |
| `convertOrderToSale` — `/pedidos` → `POST /api/pedidos/:id/confirmar` | Libera reserva **y descuenta** stock real | `order_stock_reservations`(DELETE), `stock_movements`(`reserve_release` + `sale`), `sales`, `sale_items`, `sale_item_recipes`, `sale_payments`, `products`, `cash_registers`(resumen +), `orders`(`status`, `converted_sale_id`) | **Suma** igual que venta directa |
| `finishOrder` — `/pedidos` → `POST /api/pedidos/:id/finalizar` | Nada | `orders.status` | Nada |
| `cancelSale` — `/ventas` → `POST /api/ventas/:id/anular` | **Reintegra** stock según snapshot (`products.stock` +) | `sales`(status+reason), `stock_movements`(`cancellation`), `products`, `cash_registers`(resumen −) | **Resta** total/métodos/`totalSales`/resúmenes |
| `cancelOrder` `pending` — ambas cancelaciones de pedido | Nada | `orders`(status+reason) | Nada |
| `cancelOrder` `in_process` | **Libera reserva** (no reintegra: nunca se descontó) | `orders`, `order_stock_reservations`(DELETE), `stock_movements`(`reserve_release`) | Nada |
| `cancelOrder` `paid` (solo operador) | **Reintegra** vía `cancelSale` | `orders` + todo lo de `cancelSale` | **Resta** vía `cancelSale` |
| Expiración `pending` — cron `GET /api/cron/expire-orders` (vía GitHub Actions, ~3–9 h real) + lazy | Nada (o libera reservas legadas si existieran) | `orders`(cancelled+reason), `order_stock_reservations`(DELETE si hubiera), `stock_movements`(`reserve_release` si hubiera) | Nada |
| Ajuste manual — `/stock` → `POST /api/stock/ajustar` | **Suma o resta** `products.stock` | `products`, `stock_movements`(`manual_adjustment`\|`restock`) con `reason` + `performed_by` | Nada |
| Apertura de caja — `/caja` | Nada | `cash_registers` (fila nueva `open`) | Inicia la caja |
| Cierre de caja — `/caja` | Nada | `cash_registers` (status, `closedAt`, `closedBy`, resúmenes finales, arqueo opcional) | Cierra y congela resumen |
| Vaciar papelera / baja definitiva de cajas — `/caja/eliminadas` | **Reintegra** stock de cada venta activa | `cash_registers`(DELETE), `sales`+hijas (DELETE en `hardDelete`), `stock_movements`(`cancellation`) — `cashRegisterService.ts:418-486,508-548` | La caja y sus ventas desaparecen |
| Chat (panel y público) | Nada | `order_messages` (+ `delivered_at`/`read_at` en polls) | Nada |

### 7.2 `orders` — columnas relevantes (`schema.ts:328-381`)

`order_number` (único por sucursal), `total`, `status` (`pending→in_process→paid→finished` / `cancelled`), `customer_name`, `customer_phone`, `delivery_type` (`delivery`/`pickup`), `address`, `notes`, `cancellation_token` (único), `converted_sale_id` → `sales.id`, `idempotency_key`/`idempotency_hash` (único por sucursal), `created_at`, `cancelled_at`, `cancellation_reason`, `deleted_at`.

### 7.3 Snapshots históricos (qué queda congelado vs. recalculado)

| Dato | Dónde queda | ¿Se recalcula? |
|---|---|---|
| Precio por ítem | `sale_items.unit_price/subtotal`, `order_items.unit_price/subtotal` | Congelado al crear (la conversión reutiliza los del pedido, `orderService.ts:633-640`) |
| Receta elegida | `order_item_recipes` / `sale_item_recipes`: `supplyId, supplyName, supplyType, quantity, autoDiscount, isOptional, selected, selectedByDefault` | Congelado: el reintegro usa el snapshot, no la receta vigente (`saleService.ts:557-569`) |
| Notas por ítem | `order_items.notes`, `sale_items.notes` | Congeladas |
| Notas del pedido | `orders.notes` | Congeladas |
| Pagos | `sale_payments` (method+amount por parte); `sales.payment_method` = primer método | Congelados |
| Composición para cocina | `order_messages` (mensaje "Sistema" con incluidos/quitados/nota) | Congelado al crear |
| Disponibilidad | — | **Recalculada** siempre (stock − reservas) |
| Resumen de caja | `cash_registers.{total,cashTotal,transferTotal,totalSales,productsSummary,criticalSuppliesSummary,recipeSuppliesSummary}` | Incremental (+/− por venta/anulación); al cerrar se **recalcula** desde las ventas activas (`calculateCashRegisterSummary`, `cashRegisterService.ts:155-181`) |

### 7.4 Resumen de caja — qué acumula cada contador

`addItemToSummary` (`src/lib/summary-helpers.ts:17-70`) por ítem vendido/anulado:

- `productsSummary`: unidades vendidas por **nombre de producto** (incluye servicios y bebidas sueltas; para compuestos cuenta la promo).
- `criticalSuppliesSummary`: unidades consumidas por **nombre de insumo crítico** (`autoDiscount` del snapshot — pan, salchichas, bebidas en promo y sueltas).
- `recipeSuppliesSummary`: unidades de **todos** los insumos `selected` del snapshot por `supplyName` — incluye aderezos `manual_supply` y el `Vaso de gaseosa` fijo (consumo unificado derivado: `buildSuppliesSummary`, `summary-helpers.ts:91+`; el parse del panel rellena faltantes con los críticos activos, `cashRegisterService.ts:188-227`).

`total`, `cashTotal`, `transferTotal`, `totalSales`: plata y conteo de la caja (la anulación resta en todos). `closing*` guardan el arqueo opcional del cierre.

### 7.5 `stock_movements` — ledger de auditoría (`schema.ts:514-546`)

`type`: `sale` (−, con `saleId`), `cancellation` (+, con `saleId`), `manual_adjustment` (±, `reason`+`performedBy` obligatorios), `restock` (+), `reserve` (− simbólico, `orderId`), `reserve_release` (+ simbólico, `orderId`). **Solo `sale`, `cancellation`, `manual_adjustment` y `restock` modifican `products.stock`**; `reserve`/`reserve_release` documentan la reserva sin tocarlo (el descuento real sigue siendo el `sale` posterior). Razones generadas por `buildStockMovementReason` (`src/lib/stock-helpers.ts:92-120`).

### 7.6 `public_order_rate_limits` (`schema.ts:747-761`)

PK `(scope, ip)`, `count`, `reset_at`. La escribe `createRateLimiter` (store DB atómico — `src/lib/public-order-rate-limit-store.ts:162+`, provider `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` = `db`|`memory`; `db` por defecto en producción) en: `order` (crear pedido), `order-cancellation`, `order-tracking`, `login_ip`. Los polls (`pedido_poll`, `availability_poll`) usan el store **en memoria** por instancia y **no** escriben esta tabla (`src/lib/rate-limit.ts:123-137`). Purga diaria por cron `rate-limit-cleanup`.

---

## 8. Cancelaciones — verificación cruzada UI ↔ endpoint ↔ servicio

### 8.1 Matriz de opciones de cancelación

| # | Quién / dónde | UI | Endpoint | Servicio | Guardas | Stock | Registros | Caja |
|---|---|---|---|---|---|---|---|---|
| 1 | Operador anula venta | `SalesHistory` botón "Anular" solo si `status='active'` y `allowCancel` (caja no eliminada) — `src/components/ventas/sales-history.tsx`; motivo ≥3 chars | `POST /api/ventas/:id/anular` | `cancelSale` | sesión; venta `active`; **caja abierta** | Reintegra insumos/bebidas del **snapshot** (`incrementStock`, `cancellation`) | `sales.status/cancelledAt/reason`; `stock_movements`; resumen caja − | Resta total, métodos, `totalSales`, resúmenes |
| 2 | Operador cancela pedido | `PedidoActions`/`PedidosList` botón "Cancelar" en `pending`/`in_process`/`paid`; motivo obligatorio — `pedido-actions.tsx:49-50,127-136` | `POST /api/pedidos/:id/cancelar` | `cancelOrder` | sesión; sin token | `pending`: nada · `in_process`: `reserve_release` · `paid`: `cancelSale` completo | `orders.status/cancelledAt/reason` (+ reservas/movimientos según estado) | Solo en `paid` (resta vía `cancelSale`) |
| 3 | Cliente cancela pedido | `PedidoSuccessDialog` "¿Necesitás cancelar el pedido?" (solo tras crear) — `pedido-success-dialog.tsx:253-272` | `POST /api/public/pedido/:id/cancelar` | `cancelOrder` | `token` en body (obligatorio) + rate limit `order-cancellation`; `paid`/`finished` rechazados | `pending`: nada · `in_process`: `reserve_release` | `orders.status/cancelledAt/reason` | Nunca (no puede cancelar `paid`) |
| 4 | Expiración automática | sin UI | `GET /api/cron/expire-orders` (GitHub Actions, ~3–9 h real) + lazy en lecturas | `cancelExpiredOrder` | solo `pending` vencido | Libera reservas legadas si existieran (`reserve_release`); normalmente ninguna | `orders.cancelledAt/reason='Expiración automática por inactividad'` | Ninguna |
| 5 | Vaciar papelera de cajas | Panel caja (admin/operador) — no es "cancelar venta" pero borra ventas | `DELETE /api/caja/eliminadas` / `POST .../[id]/permanente` | `emptyTrash`/`permanentlyDeleteCashRegister` | sesión | **Reintegra** stock de cada venta activa (`cancellation` con razón "Eliminación de caja #N (venta #M)") | borrado físico de `cash_registers` + `sales` + hijas | Desaparece con la caja |

### 8.2 Cobertura — ¿hay caminos sin control?

- **Sin acciones de UI huérfanas**: los tres botones de cancelación encontrados (`SalesHistory`, `PedidoActions`/`PedidosList`, `PedidoSuccessDialog`) mapean 1:1 a endpoint + servicio con guardas server-side. El listado `OrderTracker`/`RecentOrdersBanner` **no** permite cancelar (decisión de producto: el token solo se muestra tras crear el pedido; si el cliente pierde ese diálogo debe llamar al local).
- **Sin endpoints sin guardas**: los dos endpoints de cancelación de pedido convergen en `cancelOrder` con la misma máquina de estados bajo `FOR UPDATE`; la pública además exige `cancellation_token` único. Anular venta exige sesión + caja abierta. El cron exige `CRON_SECRET`.
- **Estados sin cancelación**: `finished` nunca se cancela (ni operador ni cliente); una venta `cancelled` y un pedido `cancelled` son idempotentes (no duplican efectos).
- El "ocultar recordatorio" del `RecentOrdersBanner` no es una cancelación: solo quita el item de `localStorage` (`src/lib/recent-orders.ts`).

### 8.3 Detalle por tipo de producto al cancelar

| Tipo en la línea | Anulación de venta (`cancelSale`) | Cancelación `in_process` | Cancelación `pending` |
|---|---|---|---|
| `compound` | `incrementStock` de cada insumo `autoDiscount && selected` del snapshot | `reserve_release` de las cantidades reservadas | nada |
| `beverage` | `incrementStock` directo | `reserve_release` | nada |
| `service` | sin efecto (no hay stock) | nada | nada |
| `manual_supply` | sin efecto | nada | nada |

El reintegro **respeta las flags del snapshot** (qué estaba `selected` al vender), no la receta actual: si la receta cambió después de la venta, el reintegro sigue siendo fiel a lo descontado.

---

## 9. Idempotencia

| Flujo | Clave | Hash (`createIdempotencyHash` scope) | Comportamiento |
|---|---|---|---|
| Venta | `idempotencyKey` del cliente con prefijo `branchId:` | `sale.create` (ítems + pagos normalizados) | `sales_idempotency_branch_unique_idx` (schema:284-287); misma clave+mismo payload → devuelve la venta (`deduplicated: true`); misma clave+payload distinto → `409` |
| Pedido | idem | `order.create` (ítems + cliente + delivery) | `orders_idempotency_branch_unique_idx` (schema:373-376); el `INSERT` es `insertOrderIdempotent` (`orderRepository.ts:400-432`) → colisión recupera el existente |
| Conversión | idem | `sale.order-conversion` (orderId + pagos) | misma venta devuelta; el pedido queda `paid` una sola vez |

Cliente: `useSubmitIdempotencyKey` (`src/hooks/use-submit-idempotency-key.ts`) conserva la clave entre reintentos del mismo payload y la rota al cambiar la firma (`checkoutSignature`, `saleSignature`, `orderConfirmationSignature`). `serializeCanonical` ordena claves → el hash es estable (`idempotencyService.ts:16-37`). Ventas/pedidos antiguos sin `idempotencyHash` se re-derivan desde los ítems guardados (`getLegacySaleHash`, `idempotencyService.ts:87-151`); si no puede derivarse → `409` "No se pudo validar…".

---

## 10. Expiración: cron externo vs. lazy (hallazgo)

- `src/app/api/cron/expire-orders/route.ts:1-11` existe, está protegido con `withCronAuth` y `maxDuration = 300`.
- **`vercel.json` solo agenda `rate-limit-cleanup` y `chat-attachments-cleanup` (ambos `0 0 * * *`)**: `expire-orders` no tiene schedule de Vercel — y sería inútil ahí: el plan Hobby solo admite crons con frecuencia ≤ 1 vez/día y precisión por hora (±59 min).
- **Sí hay scheduler externo**: `.github/workflows/expire-orders.yml` (`schedule: '*/5 * * * *'` + `workflow_dispatch`) llama al endpoint con `Authorization: Bearer ${{ secrets.CRON_SECRET }}` sobre `https://${{ vars.VERCEL_PRODUCTION_URL }}/api/cron/expire-orders`. Verificado con `gh run list --workflow=expire-orders.yml` (2026-10-06): todas las corridas `success`, pero la **cadencia real observada es ~3–9 h** entre ejecuciones — GitHub Actions retrasa schedules de alta frecuencia bajo carga; el `*/5` es nominal, no real (el repo es público: los minutos no se facturan).
- La **expiración lazy** sigue siendo el mecanismo de corrección inmediata: cualquier lectura del pedido (panel `/pedidos`, seguimiento, recepción, confirmación, listados) cancela `pending` vencidos al momento (`orderService.ts:863-911,1009-1040`). Un `pending` que nadie lee queda `pending` en la base hasta que pase el workflow o alguien lo lea — pero **no puede** recibirse ni convertirse (409 al operarlo) ni aparece como vigente al consultarlo.
- Consecuencia operativa: `orders.status` puede mostrar `pending` con `createdAt` viejo en una lectura SQL cruda entre pasadas del cron — no es un bug, es lazy expiration pendiente de barrido. Con el workflow a ~3–9 h reales, el rezago típico es de horas, no indefinido.
- Documentado en el código: "el cron puede demorar horas" (`orderService.ts:870-871`, `1002-1004`), consistente con la cadencia real observada.
- Riesgo residual: si el repo quedara **60 días sin actividad**, GitHub deshabilita los workflows agendados (hay que reactivarlos a mano) y la expiración quedaría solo a cargo de la lazy — sigue siendo correcta, solo más lenta en barrer.

---

## 11. Rate limiting y seguridad por endpoint

| Endpoint | Rate limit | Store | IP | Otros guards |
|---|---|---|---|---|
| `POST /api/public/pedido` | `order`: 10 req/60s | `public_order_rate_limits` (DB) | `x-vercel-forwarded-for` en Vercel (`rate-limit.ts:41-83`) | sucursal activa + horario + caja abierta + `orderSchema` |
| `POST /api/public/pedido/:id/cancelar` | `order-cancellation`: 10/60s | DB | idem | `token` obligatorio |
| `POST /api/public/pedido/seguimiento` | `order-tracking`: 10/60s | DB | idem | número + nombre o teléfono |
| `GET /api/public/pedido/:id/estado` | `pedido_poll`: 240/60s | memoria (instancia) | idem | `token` query obligatorio |
| `POST /api/public/disponibilidad` | `availability_poll`: 240/60s | memoria | idem | `cartAvailabilitySchema` |
| Chat público (mensajes/stream/upload/leido) | `pedido_poll`/límites propios | memoria | idem | `token` |
| Endpoints de panel | — | — | — | `withAuth` (sesión + sucursal; admin vía cookie `activeBranchId`, `src/lib/auth.ts:97-139`; `requireAdmin` para rutas admin) |
| Cron | — | — | — | `withCronAuth` Bearer `CRON_SECRET` timing-safe (`cron-handler.ts:14-53`) |
| Login | `login_ip` 20/15min + usuario 5/15min | DB | idem | NextAuth credentials + `login_attempts` |

Bypass: en `NODE_ENV=test` salvo `E2E_ENABLE_RATE_LIMIT`, y en desarrollo salvo `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` (`rate-limit.ts:85-98`). Sin IP confiable en producción → `RateLimitConfigError` → 500 (fail-closed).

---

## 12. Errores y códigos HTTP (`withApiErrorHandling`, `src/lib/api-handler.ts:76-198`)

| Error | HTTP | Cuándo |
|---|---|---|
| `UnauthorizedError` | 401 | sin sesión; `BRANCH_REMOVED`/`USER_REMOVED` viajan con `code` en 403 |
| `ForbiddenError` | 403 | operador pidiendo otra sucursal; sin `branchId` en sesión; cierre de caja ajeno sin admin |
| `ZodError` | 400 | payload inválido (locales es) |
| `NotFoundError` | 404 | pedido/venta/producto/caja inexistente o de otra sucursal |
| `InsufficientStockError` | 409 | faltante en confirmación (en `/api/public/pedido` se reescribe a `{error amigable, code:'INSUFFICIENT_STOCK', productName}`) |
| `ConflictError` | 409 | idempotencia con payload distinto; `pending` expirado al recibir/convertir |
| `DomainError` (incluye `ValidationError`) | 400 | reglas de negocio (sin caja, estado inválido, token inválido, motivo corto…) |
| Rate limit | 429 | por scope (mensajes propios) |
| DB caída | 503 | `isDatabaseConnectionError` |
| Cliente aborta | 499 | ECONNRESET/aborted |
| Otro | 500 | genérico ("Error interno del servidor") |

---

## 13. Casos borde y riesgos operativos

1. **Stock insuficiente**: verificado dos veces — pre-check de UI (`*/disponibilidad`) y dentro de la transacción con lock de insumos (`assertNoStockShortage` + `decrementStock` atómico `WHERE stock >= qty`). Entre el pre-check y el POST puede agotarse → `409` al confirmar; el pedido/venta no se crea parcialmente (rollback total).
2. **Reserva fantasma**: `receiveOrder` solo crea reservas si no hay existentes (`orderService.ts:779-798`) — un doble recibo no duplica; si un `pending` legado tuviera reservas huérfanas, `cancelExpiredOrder`/`cancelOrder` las libera defensivamente.
3. **Venta sin caja**: imposible (`ValidationError` antes de la transacción). Pedido público sin caja abierta o fuera de horario: `400` con mensaje de horario calculado (`getCurrentOrNextOpening`, `branch-helpers.ts:324-349`).
4. **Conversión con stock movido entre recibo y facturación**: se revalida dentro de la transacción excluyendo la reserva propia (`excludeOrderId`); si el stock ya no alcanza → `InsufficientStockError` (409) y el pedido queda `in_process` con reserva intacta (el operador puede reintentar cuando haya stock o cancelar y liberar).
5. **Anular venta de caja cerrada**: bloqueado por diseño (`saleService.ts:537-546`). La única forma de "deshacer" una venta de caja cerrada es eliminar la caja a papelera + eliminarla definitivamente (restituye stock pero borra el historial). Riesgo operativo: no hay anulación con trazabilidad para cajas cerradas.
6. **Pedido `paid` con venta**: cancelarlo anula la venta asociada (reintegro + resta de caja). Si la caja de esa venta ya cerró, `cancelSale` lanza `ValidationError` → el pedido `paid` de caja cerrada **no se puede cancelar** desde el panel tampoco.
7. **`paid` sin `converted_sale_id`** (dato legado): `cancelOrder` lo marca `cancelled` sin tocar caja/stock — camino defensivo que deja dinero cobrado sin venta viva; documentado como rama rara (`orderService.ts:483-485`).
8. **Producto eliminado tras la venta**: la anulación sigue funcionando (`includeDeleted: true` en el contexto, `saleService.ts:588-592`; lo mismo al vaciar papelera de cajas, `cashRegisterService.ts:455-459`).
9. **`maxOptionalSelections` cambiado después**: el carrito persistido recorta selecciones excedentes al restaurar (`src/hooks/useCart.ts:124-141`); el servidor siempre valida contra el tope vigente.
10. **`getOrderChatStatus` (poll `/estado`) no aplica lazy expiration**: devuelve `isExpired: true` sin cancelar — el pedido queda `pending` en DB hasta que una lectura mayor lo barra. El banner/`OrderTracker` lo interpretan como vencido (consistente para el cliente).
11. **Movimientos `reserve`/`reserve_release` no alteran `products.stock`**: quien lea `stock_movements` como ledger puro verá entradas negativas de `reserve` sin decremento asociado — es por diseño (auditoría de reservas); el ledger de stock real es `sale`+`cancellation`+`manual_adjustment`+`restock`.
12. **`manual_supply` no descuenta nunca**: su stock solo se mueve por `POST /api/stock/ajustar` → `stockService.adjustStock` (`src/application/services/stockService.ts:54-119`), validado por `stockAdjustmentSchema` (`src/lib/zod-schemas.ts:246-253`): `productId` entero positivo, `quantity` entero ≠ 0, `reason` de 3–500 caracteres, `type` ∈ {`manual_adjustment` (default), `restock`}; el servicio rechaza stock final negativo y registra el movimiento con `performed_by` de la sesión y `orderId`/`saleId` nulos. En el catálogo real, los 39 insumos y los 2 críticos internos arrancan en `stock = 0` → **la operación depende 100% de cargar stock manualmente** (p. ej. `restock` "Carga inicial") o nada se venderá.
13. **`products_summary` vs `recipe_supplies_summary`**: el `Vaso de gaseosa` suelto cuenta en `productsSummary`, el que va dentro de una promo cuenta en `recipeSuppliesSummary` — el total unificado sale de `suppliesSummary` (derivado en lectura, `cashRegisterService.ts:207-219`). Mismo detalle para contar toppings.
14. **Horario overnight** 19:30→03:00: `isBranchOpen` construye intervalos UTC cruzando medianoche (`branch-helpers.ts:248-297`) — un pedido a las 02:00 del martes cuenta dentro del turno que abrió lunes 19:30.
15. **`orderService.createOrder` rechaza fuera de horario aunque la UI oculte el formulario**: la guarda es server-side (`orderService.ts:288-298`), igual que `isActive` y caja abierta.

---

## 14. Síntesis pedida: "qué se puede vender / qué descuenta stock / qué se registra"

### `/ventas` (POS operador)

- **Vende**: los 35 ítems vendibles (11 promos, 20 bebidas, 4 servicios) + cualquier activo futuro `compound`/`service`/`beverage`.
- **Descuenta en `confirmSale`**: bebidas (−1 c/u propia) e insumos `autoDiscount && selected` de cada compuesto (pan/salchichas/bebidas de receta). Servicios y `manual_supply` nunca.
- **Registra**: `sales`, `sale_items` (precios), `sale_item_recipes` (snapshot 8 campos), `sale_payments` (por método), `stock_movements`(`sale`), `products.stock` −, resumen de caja +. Anulación → `cancellation` (+ stock, − caja), solo con caja abierta.
- **Requiere**: sesión + caja abierta.

### `/pedidos` (panel operador)

- **Gestiona**: los pedidos creados por `/pedido` (pendientes → en proceso → pagados → finalizados / cancelados).
- **Descuenta**: nada directamente. `recibir` **reserva** insumos (`order_stock_reservations` + `reserve`); `confirmar` libera la reserva y **descuenta** vía la venta creada; `cancelar` libera reserva (`in_process`) o anula la venta (`paid`); `finalizar` solo cierra el ciclo.
- **Registra**: `orders` (status/motivos), `order_stock_reservations`, `stock_movements`(`reserve`/`reserve_release`/`sale`/`cancellation`), y en `paid` toda la familia `sales*` + caja.
- **Requiere**: sesión; `confirmar` exige además caja abierta.

### `/pedido` (público cliente)

- **Vende/crea**: pedidos sobre los 35 ítems públicos con nombre, teléfono, delivery/pickup, dirección si delivery, notas.
- **Descuenta**: **nunca** — el pedido nace `pending` sin reserva; la reserva llega al `recibir` del operador y el descuento al `confirmar`.
- **Registra**: `orders`+`order_items`+`order_item_recipes`+mensaje "Sistema", `public_order_rate_limits` por cada POST limitado; token de cancelación devuelto una sola vez (diálogo de éxito).
- **Requiere**: sucursal activa + en horario (si hay `openingHours`) + caja abierta + rate limit.

### Cron / lazy

- **Hace**: cancela `pending` con `createdAt > ORDER_EXPIRATION_MS` (1 h default). El cron no está en `vercel.json` pero lo dispara **GitHub Actions** (`expire-orders.yml`, `*/5` nominal, ~3–9 h real); el lazy expiration cubre las lecturas.
- **Descuenta**: nada (los `pending` no tienen reserva; si hubiera reservas legadas las libera con `reserve_release`).
- **Registra**: `orders.status='cancelled'` + `cancelledAt` + `cancellationReason='Expiración automática por inactividad'`.

---

## 15. Mapa de archivos consultados (referencia rápida)

| Tema | Archivos |
|---|---|
| Esquema | `src/db/schema.ts` (products 122-174, recipes 176-198, cash_registers 200-254, sales 256-289, sale_payments 291-305, sale_items 307-326, orders 328-381, order_items 383-402, sale_item_recipes 404-427, order_item_recipes 429-452, order_stock_reservations 454-478, order_messages 480-512, stock_movements 514-546, public_order_rate_limits 747-761) |
| Servicios | `src/application/services/saleService.ts`, `orderService.ts`, `catalogService.ts`, `chatService.ts`, `stockService.ts`, `cashRegisterService.ts`, `productService.ts` |
| Lógica compartida | `src/lib/product-helpers.ts`, `stock-helpers.ts`, `cart-pipeline.ts`, `cart-helpers.ts`, `sale-helpers.ts`, `order-helpers.ts`, `payment-helpers.ts`, `summary-helpers.ts`, `catalog.ts`, `branch-helpers.ts`, `rate-limit.ts`, `public-order-rate-limit-store.ts`, `api-handler.ts`, `with-auth.ts`, `cron-handler.ts`, `public-errors.ts`, `idempotencyService.ts` (`src/application/`) |
| Config | `src/config/api.ts`, `orders.ts`, `rate-limit.ts`, `catalog.ts`, `branch.ts`, `vercel.json` |
| Rutas | `src/app/api/**` (§5) |
| UI | `src/components/ventas/*`, `src/components/pedidos/*`, `src/components/pedido/*`, `src/components/promo/promo-options-dialog.tsx`, `src/hooks/useSellableCart.ts`, `useCart.ts`, `use-submit-idempotency-key.ts` |
| Datos | `scripts/data/catalogo-pancheria-popular.ts` (contrastado 1:1 con producción) |

---

**Notas de cierre del análisis:** el archivo `.env.production.local` usado para las consultas `SELECT` se eliminó al terminar, junto con el script temporal de consulta; no quedan credenciales ni artefactos sensibles en el repositorio. Ningún dato de producción fue modificado durante el análisis.
