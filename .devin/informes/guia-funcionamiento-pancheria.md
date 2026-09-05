# Guía de funcionamiento y manejo de la aplicación — Panchería

**Fecha:** 2026-08-23  
**Proyecto:** `pancheria`  
**Basada en:** código actual, `AGENTS.md`, `README.md`, <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />.

---

## 1. ¿Se puede pasar a producción con el estado actual?

**Respuesta corta:** la aplicación es funcional, el build de producción es exitoso y el suite de tests unitarios está verde. Los flujos críticos de ventas, pedidos, reservas, pagos mixtos, imágenes de productos y panel de control están implementados y documentados.

Antes de pasar a producción conviene completar el checklist de configuración manual (URLs, secretos, base de datos, storage) y, si se espera alta concurrencia con múltiples instancias, configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` y `RATE_LIMIT_STORE_PROVIDER=db`.

---

## 2. Conceptos fundamentales

### 2.1 Multi-sucursal

- Todo dato de negocio (productos, usuarios, ventas, pedidos, cajas, movimientos, cierres, videos) está aislado por `branchId`.
- La tabla `branches` tiene las sucursales, incluyendo `opening_hours` (horarios de apertura en formato JSON).
- Los horarios se crean/editan desde `/sucursales` y se usan para mostrar el próximo horario de atención cuando la caja está cerrada.
- Los usuarios pertenecen a una única sucursal (`users.branchId`).
- El `admin` puede cambiar de sucursal activa desde el panel; la selección se guarda en la cookie `activeBranchId`.
- El `operator` siempre opera en su sucursal asignada.
- Los productos y recetas se copian a una nueva sucursal cuando se crea con `NEW_BRANCH_NAME`/`NEW_BRANCH_USERNAME`/`NEW_BRANCH_PASSWORD` vía seed.

### 2.2 Roles

- **admin**: puede crear/editar/eliminar productos, recetas, stock, usuarios, sucursales; abrir/cerrar caja; ver historial; cambiar de sucursal activa.
- **operator**: puede vender, gestionar stock, abrir/cerrar su caja asignada, ver historial, confirmar/cancelar pedidos. No puede crear productos ni usuarios.

### 2.3 Tipos de producto

Cada producto en `products` tiene uno de estos tipos:

- `critical_supply`: insumo crítico. Tiene un `criticalSupplyType`: `bread` (pan), `sausage` (salchicha) o `beverage` (bebida). Los críticos con `autoDiscount: true` en una receta son los únicos que descuentan stock automáticamente al vender una promo. Son obligatorios y nunca opcionales.
- `manual_supply`: insumo manual (salsas, condimentos, cajas, etc.). Puede incluirse en la receta de una promo como complemento opcional. **No descuenta stock automáticamente**. El cliente u operador puede quitarlo antes de confirmar y el precio de la promo no cambia.
- `compound`: producto compuesto/promo. Tiene una receta (`recipes`) que indica qué insumos incluye (críticos, manuales y/o servicios), sus cantidades, si son opcionales y si vienen preseleccionados por defecto.
- `service`: servicio adicional (toppings, vasos de gaseosa, etc.). Puede incluirse en la receta de una promo como complemento opcional. No tiene stock ni receta; es ilimitado.

Solo los productos `compound`, `service` o `critical_supply` con `criticalSupplyType === 'beverage'` son **vendibles al público**.

<ref_file file="C:/developer/paginas/pancheria/src/lib/catalog.ts" />

### 2.4 Panel de control

La raíz autenticada `/` (`<ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/page.tsx" />`) es el panel de control. Muestra un resumen operativo de la sucursal activa en tiempo real:

- **Estado de la caja**: abierta o cerrada, monto total, desglose de efectivo y transferencia, cantidad de ventas y tiempo restante antes del cierre automático.
- **Pedidos**: cantidad de pedidos por estado (`pending`, `in_process`, `paid`, `finished`, `cancelled`), destacando los activos.
- **Alertas de stock**: cantidad de insumos con stock bajo.
- **Contexto de sucursal**: nombre de la sucursal activa y usuario logueado.
- **Accesos rápidos**: tarjetas con atajos a Ventas, Productos, Stock, Caja y cierre, Pedidos, Videos, Sucursales, Usuarios, Catálogo y Perfil, filtrados por rol.

Los datos se cargan desde `<ref_file file="C:/developer/paginas/pancheria/src/app/api/panel/resumen/route.ts" />` a través del hook `<ref_file file="C:/developer/paginas/pancheria/src/hooks/useDashboard.ts" />` y se refrescan automáticamente cada 30 segundos (configurable en el cliente). El componente visual es `<ref_file file="C:/developer/paginas/pancheria/src/components/panel/dashboard-client.tsx" />`.

La navegación superior refleja ahora la distinción entre caja y cierres:

- **Historial de cajas** (`/ventas/historial`): historial de cajas cerradas y sus ventas.
- **Caja y cierre** (`/cierre`): apertura, cierre y resumen de la caja actual.

El tour interactivo (`<ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />`) cubre el panel, pagos mixtos, pedidos con sus estados, reservas, chat, imágenes de promos, videos, perfil y selector de sucursal.

---

## 3. Productos y recetas

### 3.1 Creación de productos

- Todo producto se crea con `stock = 0` por defecto, excepto si el tipo es `compound` o `service`, que siempre tienen `stock = 0` y `minStock = 0`.
- El stock inicial se carga con un movimiento de tipo `restock` a través de `/stock/ajustar` o el seed.
- Los productos `manual_supply` no pueden tener precio (`price` debe ser `0`). Los demás sí.
- Los productos `critical_supply` deben tener un `criticalSupplyType`.
- Los productos (en especial las promos `compound`) pueden tener una imagen ilustrativa (`imageUrl`, `imageKey`, `imageMimeType`, `imageSize`). El administrador la sube o ingresa una URL externa (`https://`) desde el formulario de promo; la imagen se muestra en el catálogo público (`/pedido`). El almacenamiento, validación de tamaño/MIME y dominios permitidos usan `src/config/product-images.ts` y `src/lib/product-image-storage.ts`, con el mismo `STORAGE_PROVIDER` de videos/chat.
- El soft delete evita perder el historial de ventas y pedidos.

### 3.2 Recetas

- Una receta vincula un producto `compound` con varios insumos (`critical_supply`, `manual_supply` o `service`).
- Solo los insumos críticos pueden tener `autoDiscount: true`. Eso indica que al vender/comprometer una promo, se descuenta stock del insumo automáticamente.
- Los insumos manuales y servicios son siempre `autoDiscount: false`. Pueden configurarse como opcionales (`isOptional: true`) y preseleccionados (`selectedByDefault: true`).
- Los insumos críticos son siempre obligatorios (`isOptional: false`).
- No puede haber insumos duplicados ni un compuesto usándose a sí mismo.
- Una promo debe tener al menos un insumo crítico con `autoDiscount: true`.
- Si se elimina un insumo crítico usado en una promo activa, no se permite; hay que eliminar o inactivar la promo primero.

### 3.3 Disponibilidad de un producto

- Para `service`: disponibilidad infinita.
- Para `critical_supply` tipo `beverage`: `stock` del producto.
- Para `compound`: la mínima cantidad de veces que se puede armar considerando el stock de todos sus insumos críticos con `autoDiscount`. Los insumos manuales y servicios opcionales no afectan la disponibilidad.
- Ejemplo: si una promo "Promo 1" requiere `1 Pan` y `2 Salchichas`, y hay `32 Pan` y `10 Salchichas`, la disponibilidad es `min(32/1, 10/2) = 5`.

<ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" /> (función `calculateCompoundAvailability`).

---

## 4. Stock — ¿qué es y cuándo cambia?

### 4.1 Campo `stock` en `products`

- Es la cantidad física disponible de un producto en la sucursal.
- Se actualiza directamente mediante `UPDATE` dentro de transacciones.
- Cada cambio genera un registro en `stock_movements`.

### 4.2 Tipos de movimiento de stock

| Tipo | Significado | ¿Quién lo genera? | ¿Modifica `products.stock`? |
| ---- | ----------- | ----------------- | --------------------------- |
| `restock` | Carga inicial o reposición de stock | Operador desde `/stock` o seed | Sí (`+quantity`) |
| `manual_adjustment` | Ajuste manual por pérdida, rotura, etc. | Operador desde `/stock` | Sí (`+quantity`) |
| `sale` | Venta confirmada desde el terminal o conversión de un pedido | Automático al confirmar venta o pedido | Sí (`-quantity`) |
| `cancellation` | Anulación de una venta | Automático al anular venta | Sí (`+quantity`, reintegro) |
| `reserve` | Reserva de stock al crear un pedido (`pending`) | Automático al crear pedido desde el catálogo público | No (reserva lógica en `order_stock_reservations`) |
| `reserve_release` | Liberación de una reserva al pagar o cancelar un pedido `pending` o `in_process` | Automático al confirmar pago o cancelar pedido en reserva | No |

<ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> (`StockMovementType`).

### 4.3 ¿Cuándo se descuenta stock automáticamente?

1. **Venta directa (`/ventas`)**
   - El operador arma el carrito y confirma.
   - Si la promo tiene insumos opcionales, se abre `PromoOptionsDialog` para elegir qué complementos incluir.
   - Se valida caja abierta y disponibilidad.
   - Se inserta la venta (`sales` + `sale_items`).
   - Se persiste el snapshot de receta en `sale_item_recipes` (`selected`/`selectedByDefault`/`isOptional` de cada insumo).
   - Se descuenta stock solo de los insumos críticos con `autoDiscount` que estén seleccionados en el snapshot, y de las bebidas (`critical_supply` tipo `beverage`) vendidas.
   - Se insertan movimientos `sale`.

2. **Pedido público (`/pedido`)**
   - El cliente puede armar el carrito en cualquier momento, incluso si la caja está cerrada.
   - Al enviar (`POST /api/public/pedido`) se valida que la caja de la sucursal esté abierta (`cashRegisterService.getOpenCashRegister`).
   - Si la caja está cerrada, el sistema responde con `400` y el mensaje incluye el horario de apertura correspondiente; el carrito permanece editable.
   - Se valida disponibilidad de stock en el momento (`validateCartAvailability`) y **se reserva stock**.
   - Se inserta el pedido en estado `pending` con reservas en `order_stock_reservations` y movimientos `reserve` en `stock_movements`.
   - El stock reservado no se descuenta físicamente, pero deja de estar disponible para otros pedidos o ventas hasta que se confirme, cancele o finalice.

3. **Recibir y reservar (`/pedidos/[id]/recibir`)**
   - El operador revisa el pedido `pending` y presiona **Recibir y reservar**.
   - Se bloquean productos e insumos con `SELECT ... FOR UPDATE`.
   - Se valida disponibilidad considerando reservas ajenas (`validateCartAvailability`). La reserva propia no se cuenta contra sí misma gracias a `excludeOrderId`.
   - No se crean reservas duplicadas: la reserva ya existe desde la creación del pedido.
   - El pedido pasa a `in_process`. El stock físico aún no se descuenta, pero la disponibilidad futura ya considera la reserva.

4. **Confirmar pago (`/pedidos/[id]/confirmar`)**
   - El operador confirma la forma de pago (`cash` o `transfer`) y presiona **Confirmar pago**.
   - Se revalida disponibilidad considerando reservas ajenas.
   - Se liberan las reservas propias (`reserve_release`) y se descuenta stock físico una sola vez (`deductStockForItems` con `movementType: 'sale'`).
   - Se crea la venta (`sales` + `sale_items`) con los precios históricos de `order_items` y se actualiza el resumen de caja.
   - El pedido pasa a `paid` y se vincula con `convertedSaleId`.

5. **Finalizar pedido (`/pedidos/[id]/finalizar`)**
   - El operador marca el pedido como entregado/retirado.
   - El pedido pasa a `finished`. No se modifica stock ni caja.

### 4.4 ¿Cuándo se reintegra stock automáticamente?

1. **Anulación de venta (`/ventas/[id]/anular`)**
   - La venta debe ser de una caja abierta.
   - Se reintegra stock de los insumos críticos a partir del snapshot guardado en `sale_item_recipes` (`reintegrateStockForItems` con `movementType: 'cancellation'`).
   - Se resta la venta del resumen de caja.
   - La venta pasa a `cancelled`.

2. **Cancelación de pedido público (`/pedido/[id]/cancelar` o panel `/pedidos/[id]/cancelar`)**
   - El pedido puede estar `pending`, `in_process` o `paid`.
   - El cliente puede cancelar con el `cancellationToken`; el operador cancela desde el panel sin token.
   - Si está `pending` o `in_process`, se liberan las reservas (`reserve_release`) y se borra `order_stock_reservations`.
   - Si está `paid`, se anula la venta vinculada (`cancellation`) y se reintegra stock.
   - El pedido pasa a `cancelled`.

### 4.5 Ajustes manuales

- Desde el panel `/stock` el operador puede ajustar o reponer stock.
- Requiere motivo de al menos 3 caracteres.
- La cantidad puede ser positiva (restock/ajuste a favor) o negativa (pérdida/ajuste en contra).
- Nunca deja el stock negativo.
- Se registra en `stock_movements` con `type` correspondiente.

<ref_file file="C:/developer/paginas/pancheria/src/application/services/stockService.ts" /> (`adjustStock`).

### 4.6 Alertas de stock bajo

- `listStockAlerts` devuelve productos `critical_supply` y `manual_supply` cuyo `stock <= minStock`.
- Sirve para saber qué insumos conviene reponer.

---

## 5. Caja

### 5.1 Concepto

- Una caja (`cashRegisters`) representa un turno de ventas en una sucursal.
- Solo puede haber una caja abierta por sucursal.
- La caja lleva un resumen de ventas: `total`, `cashTotal`, `transferTotal`, `totalSales`, `productsSummary`, `criticalSuppliesSummary`, `recipeSuppliesSummary`.

### 5.2 Ciclo de vida

1. **Apertura**
   - Desde `/caja` el operador/admin abre la caja indicando usuario.
   - Se inserta un registro con `status = 'open'`.
   - No se requiere monto inicial; todos los totales comienzan en `0`.
   - El monto inicial, si se ingresa, es un valor entero en pesos (sin centavos), igual que los pagos en el terminal de ventas.

2. **Ventas**
   - Cada venta confirmada incrementa `totalSales`, `total`, `cashTotal` o `transferTotal` según medio de pago.
   - `productsSummary` cuenta unidades vendidas por nombre de producto.
   - `criticalSuppliesSummary` cuenta unidades de bebidas y, para promos, las cantidades de insumos críticos consumidos.
   - `recipeSuppliesSummary` cuenta, para cada insumo incluido en promos, la cantidad consumida considerando los snapshots (`Insumos de recetas` en el cierre).

3. **Cierre manual**
   - El operador/cierra la caja.
   - El monto contado en efectivo se ingresa como pesos enteros; el sistema calcula la diferencia contra el efectivo esperado.
   - Se calcula el resumen final y se graba en el registro (`status = 'closed'`, `closedAt`, `closedBy`).

4. **Cierre automático**
   - Si la caja lleva abierta más de `CAJA_AUTO_CLOSE_HOURS` (12 horas por defecto, configurable en <ref_file file="C:/developer/paginas/pancheria/src/config/caja.ts" />), al consultarla se cierra automáticamente (`autoClosed = true`, `closedBy = 'Sistema'`).

5. **Papelera**
   - Las cajas cerradas pueden eliminarse (soft delete).
   - Desde la papelera se pueden restaurar o eliminar permanentemente.
   - No se puede eliminar una caja abierta.

### 5.3 Restricciones

- No se puede confirmar una venta sin caja abierta.
- No se puede anular una venta de una caja cerrada o eliminada.
- No se puede confirmar un pedido sin caja abierta.

---

## 6. Ventas

### 6.1 Flujo normal

1. El operador abre la caja.
2. Navega a `/ventas`.
3. El terminal carga productos vendibles con disponibilidad.
4. El operador agrega productos al carrito.
5. El cliente selecciona medio de pago (`cash` o `transfer`).
6. Confirma la venta.
7. El sistema:
   - Valida caja abierta.
   - Valida disponibilidad.
   - Inserta `sales` + `sale_items`.
   - Descuenta stock de insumos críticos y bebidas.
   - Actualiza el resumen de caja.

### 6.2 Anulación

1. Desde el historial de ventas o la venta en sí, el operador anula.
2. Requiere motivo.
3. El sistema:
   - Valida que la caja siga abierta.
   - Reintegra stock.
   - Resta la venta del resumen de caja.
   - Marca la venta como `cancelled`.

### 6.3 Idempotencia

- Tanto ventas como pedidos usan `idempotencyKey`.
- En ventas, el `idempotencyKey` es `branchId:key` y se guarda en `sales.idempotencyKey`.
- Si se reenvía la misma request, se devuelve la venta existente o se rechaza según corresponda.

---

## 7. Pedidos públicos

### 7.1 Flujo del cliente

1. El cliente entra a `/pedido`.
2. Si no hay `?branchId`, se redirige a la sucursal por defecto (`DEFAULT_BRANCH_NAME`).
3. Si hay más de una sucursal, puede elegir otra desde un selector.
4. Al cambiar de sucursal se limpia el carrito y se recarga el catálogo de esa sucursal.
5. El cliente agrega productos al carrito. Si el producto es una promo con complementos opcionales, se abre `PromoOptionsDialog` para elegir qué insumos incluir.
6. El carrito se guarda en `localStorage` (`pancheria-cart-v1`) vinculado a la `branchId`, incluyendo los `selectedRecipeItemIds` de cada promo.
7. El cliente completa nombre, tipo de entrega (`delivery`/`pickup`) y notas.
8. Al confirmar:
   - Se valida disponibilidad.
   - Se crea el pedido con estado `pending`.
   - Se persiste el snapshot de receta en `order_item_recipes` (`selected`/`isOptional`/`selectedByDefault`).
   - **Se reserva stock** en `order_stock_reservations` y se registra un movimiento `reserve` en `stock_movements`.
   - El sistema muestra un resumen del pedido (incluyendo insumos incluidos y quitados) y un botón para ir al chat de pedidos (`/pedido/{id}/chat?token=...`).
   - Se inserta un mensaje automático en el chat con el detalle de preparación de cada promo.
   - Si `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado, también se genera un mensaje de WhatsApp con el resumen y un enlace a `wa.me/{NUMERO}` como fallback.
9. El cliente coordina con la sucursal por el chat (texto e imágenes). El pedido queda `pending` hasta que el operador actúe.
10. Si prefiere, el cliente puede abrir WhatsApp y enviar el mensaje. El navegador no puede verificar la entrega.
11. El cliente puede cancelar el pedido desde el mismo diálogo usando el `cancellationToken`.

### 7.2 Flujo del operador

1. El operador/admin ve los pedidos `pending` de su sucursal en `/pedidos`; el listado muestra `unreadCount` de mensajes sin leer. Si se configura `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` con un valor mayor a 0, el listado hace polling automático; de lo contrario, el operador actualiza manualmente con el botón "Actualizar".
2. Al abrir un pedido, ve detalle, el chat con el cliente, un enlace para abrir el WhatsApp del cliente (fallback), el detalle de preparación de cada promo (insumos incluidos y quitados) y las acciones de confirmar o cancelar.
3. **Recibir y reservar**
   - No requiere caja abierta.
   - Valida disponibilidad considerando reservas ajenas (la propia reserva no se cuenta doble).
   - No crea una reserva adicional; la reserva activa fue generada al crear el pedido.
   - El pedido pasa a `in_process`.
4. **Confirmar pago**
   - Requiere caja abierta.
   - Valida disponibilidad, libera la reserva propia (`reserve_release`), descuenta stock físico una vez y crea la venta.
   - El pedido pasa a `paid` y se vincula con `convertedSaleId`.
5. **Finalizar pedido**
   - Marca el pedido como entregado/retirado.
   - El pedido pasa a `finished`.
6. **Cancelar**
   - Requiere motivo.
   - Si el pedido está `in_process`, libera la reserva; si está `paid`, anula la venta y reintegra stock.
   - El pedido pasa a `cancelled`.

### 7.3 Rate limiting

- `POST /api/public/pedido` y los endpoints del chat público (`GET/POST /api/public/pedido/[id]/chat`) limitan por IP.
- El proveedor de almacenamiento se configura con `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`:
  - `memory`: usa un `Map` en el proceso de Node.
  - `db`: usa PostgreSQL (`public_order_rate_limits`) y es recomendado para producción con múltiples instancias.
  - En producción, si `DATABASE_URL` o `POSTGRES_URL` están definidas y no se especifica lo contrario, se usa `db`; en desarrollo/test y sin base de datos disponible, `memory`.
- Ventana y máximo de pedidos configurables por `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` y `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`.
- Ventana y máximo de chat configurables por `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS` y `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`.

### 7.4 Eliminación de una sucursal

Eliminar una sucursal ahora es un **archivo (soft delete)**: se marca `deletedAt` en `branches` y en las entidades operativas asociadas, pero se conservan los datos históricos.

1. El `admin` va a `/sucursales`, selecciona eliminar y confirma escribiendo el nombre exacto.
2. El sistema muestra un resumen con: productos, recetas, ventas, cajas, movimientos de stock, usuarios, pedidos y videos.
3. Al confirmar, en una sola transacción se archivan (`deletedAt` = ahora):
   - `products` (e `imageKey` de sus imágenes).
   - `recipes` asociadas a esos productos.
   - `orders`, `order_items`, `order_messages`, `order_stock_reservations` y `order_item_recipes` (por cascada).
   - `cash_registers`.
   - `videos`.
   - `users` no se borran, pero quedan asociados a una sucursal archivada y no pueden iniciar sesión.
   - Finalmente la sucursal (`branches`).
4. **No se eliminan** físicamente para conservar historial:
   - `sales` y `sale_items`.
   - `stock_movements`.
   - Archivos asociados (imágenes, adjuntos, videos): permanecen accesibles a través de las URLs históricas.
5. El cliente (`/pedido`) detecta si la sucursal guardada en `localStorage` fue archivada y limpia:
   - `pancheria-branch-id`
   - `pancheria-cart-v1`
   - Pedidos recientes (`pancheria-recent-orders-v1`)
   - Claves del tour asociadas a esa sucursal.

> **Regla de historial:** el archivo de una sucursal conserva ventas y movimientos para trazabilidad. Productos, cajas, pedidos y videos archivados desaparecen de los listados normales pero pueden consultarse en las vistas de papelera. El nombre de una sucursal archivada puede reutilizarse gracias a un índice parcial único.

---

## 8. Cierres diarios

### 8.1 Propósito

- Generar una foto de las ventas de un día determinado.
- Sirve para cuadrar caja y conocer totales por día.

### 8.2 Flujo

1. El operador/admin abre la caja correspondiente a la jornada desde `/ventas` o `/cierre` (`POST /api/caja/abrir`).
2. Durante la jornada se registran ventas (`POST /api/ventas` o desde el terminal `/ventas`).
3. Al finalizar, desde `/cierre` el operador presiona **Cerrar caja**, ingresa el efectivo contado y notas opcionales (`POST /api/caja/cerrar`).
4. El sistema:
   - Valida que la caja esté abierta.
   - Calcula totales y resúmenes de la caja (efectivo, transferencia, total de ventas, diferencia).
   - Cierra la caja (`status = 'closed'`), conservándola en `cash_registers`.
5. Desde `/ventas/historial/[id]` se puede consultar el cierre y las ventas asociadas.

> Nota: no existe una tabla `dailyClosures`; el cierre diario se materializa en cada registro de `cash_registers` cerrado.

### 8.3 Relación con caja

- El cierre no modifica stock; es un resumen informativo.
- Las ventas anuladas después del cierre sí reintegran stock, pero el cierre conserva el total original (la anulación genera su propio registro con `sale.isCancelled = true`).

---

## 9. Multi-sucursal en operación

### 9.1 Crear una nueva sucursal

1. El `admin` va a `/sucursales` y crea la sucursal.
2. Va a `/usuarios` y crea un usuario `operator` asignado a esa sucursal.
3. Va a `/productos` y crea o copia productos manualmente.

Alternativa: configurar `NEW_BRANCH_NAME`, `NEW_BRANCH_USERNAME`, `NEW_BRANCH_PASSWORD` y ejecutar `npx tsx src/db/seeds.ts`. Esto copia productos, recetas y stock inicial desde la sucursal por defecto.

### 9.2 Cambio de sucursal activa

- El `admin` usa el selector del panel.
- La sucursal seleccionada se guarda en la cookie `activeBranchId`.
- El `operator` no puede cambiar; siempre opera en `users.branchId`.

### 9.3 Catálogo público por sucursal

- `/pedido?branchId=X` muestra el catálogo de la sucursal `X`.
- Cada sucursal tiene su propio stock y precios.
- El carrito se invalida al cambiar de sucursal.

---

## 10. Tabla de casos: ¿se modifica el stock y quién lo hace?

| Acción | Stock modificado | Tipo de movimiento | Entidad afectada | Observaciones |
| ------ | ---------------- | ------------------ | ---------------- | ------------- |
| Crear producto | No | — | `products` | Stock inicia en `0` |
| Carga inicial de stock (seed) | Sí | `restock` | `products`, `stock_movements` | Se carga vía `adjustStock` |
| Reposición manual | Sí | `restock` | `products`, `stock_movements` | Operador desde `/stock` |
| Ajuste manual positivo | Sí | `manual_adjustment` | `products`, `stock_movements` | Operador desde `/stock` |
| Ajuste manual negativo | Sí | `manual_adjustment` | `products`, `stock_movements` | No permite stock negativo |
| Confirmar venta | Sí | `sale` | `products`, `sale_items`, `sale_item_recipes`, `sales`, `stock_movements`, `cashRegisters` | Descuenta insumos críticos con `autoDiscount` seleccionados en el snapshot |
| Anular venta | Sí | `cancellation` | `products`, `sales`, `sale_items`, `sale_item_recipes`, `stock_movements`, `cashRegisters` | Reintegra insumos críticos seleccionados en el snapshot; requiere caja abierta |
| Crear pedido público | No* | `reserve` | `order_items`, `order_item_recipes`, `orders`, `order_stock_reservations`, `stock_movements` | Valida stock; reserva stock lógico; persiste snapshot de receta; estado `pending`. |
| Recibir y reservar pedido | No* | `reserve` | `order_stock_reservations`, `stock_movements` | Valida disponibilidad; reserva stock lógico solo si no existía; pedido pasa a `in_process` |
| Confirmar pago de pedido | Sí | `reserve_release`, `sale` | `products`, `sale_items`, `sales`, `stock_movements`, `orders`, `cashRegisters`, `order_stock_reservations` | Libera reserva propia, descuenta stock y crea venta |
| Finalizar pedido | No | — | `orders` | Pedido pasa a `finished`; no modifica stock |
| Cancelar pedido público (`pending`) | No* | `reserve_release` | `orders`, `order_stock_reservations`, `stock_movements` | Libera la reserva creada al crear el pedido |
| Cancelar pedido público (`in_process`) | No* | `reserve_release` | `orders`, `order_stock_reservations`, `stock_movements` | Libera la reserva |
| Cancelar pedido público (`paid`) | Sí | `cancellation` | `products`, `sales`, `stock_movements`, `cashRegisters`, `orders` | Anula la venta y reintegra stock |
| Eliminar producto | No | — | `products` (soft delete) | No si está en recetas activas |
| Eliminar caja | No | — | `cashRegisters` (soft delete) | No si está abierta |
| Eliminar sucursal | No* | — | `branches` (soft delete) en cascada | Se archivan `products`, `cashRegisters`, `orders`, `videos` y se conservan ventas, recetas, stock y pedidos como historial. No se pueden crear pedidos ni ventas nuevas en una sucursal archivada. |
| Cierre diario | No | — | `dailyClosures` | Resumen informativo |

---

## 11. Flujo compartido entre ventas y pedidos

Tanto `confirmSale` como `createOrder` usan los mismos helpers compartidos:

- `buildProductContext(branchId, productIds)` (`src/lib/product-helpers.ts`): carga productos y recetas.
- `validateProductsForOperation(...)` (`src/lib/product-helpers.ts`): valida que los productos sean vendibles, activos y de la sucursal.
- `validateCartAvailability(...)` (`src/lib/product-helpers.ts`): calcula disponibilidad y shortage.
- `buildSaleItemValues(productById, items)` (`src/lib/sale-helpers.ts`): calcula `unitPrice`, `subtotal` y `recipeSnapshot` para cada ítem.
- `buildOrderValues(...)` y `buildOrderItemValues(...)` (`src/lib/order-helpers.ts`): construyen los registros de `orders` y `order_items`, incluyendo el snapshot de receta.
- `deductStockForItems(...)` (`src/application/services/saleService.ts`): descuenta stock con lock pesimista (`SELECT ... FOR UPDATE`).
- `lockOpenCashRegister(...)` y `lockCashRegisterById(...)` (`src/lib/cash-register-helpers.ts`): lockean la caja abierta para actualizarla.

La diferencia es:

- **Venta directa**: `deductStockForItems` con `movementType: 'sale'`.
- **Pedido público nuevo**: no genera movimiento de stock; queda `pending`.
- **Recibir pedido**: reserva stock con movimiento `reserve` en `stock_movements` y registros en `order_stock_reservations`.
- **Confirmar pago de pedido**: libera reservas propias (`reserve_release`) y descuenta stock físico una sola vez con `deductStockForItems` (`movementType: 'sale'`); inserta venta y actualiza resumen de caja.
- **Finalizar pedido**: no modifica stock ni caja; cambia el estado a `finished`.
- **Cancelar pedido `in_process`**: libera reservas (`reserve_release`); no descuenta stock.

---

## 12. Cálculo de disponibilidad

### 12.1 Producto compuesto

La disponibilidad de un producto `compound` es la cantidad máxima de unidades que se pueden armar dado el stock actual de cada insumo crítico con `autoDiscount`.

Fórmula (simplificada):

```
disponibilidad = min( floor( stock_insumo_i / cantidad_requerida_i ) )
```

Si se están pidiendo varios productos que comparten insumos, el cálculo considera el consumo acumulado de todo el carrito.

### 12.2 Bebida

Disponibilidad = `stock` del producto `critical_supply` tipo `beverage`.

### 12.3 Servicio

Disponibilidad = infinita.

### 12.4 Manual, servicios y otros críticos

- Los insumos manuales y los servicios no son vendibles por sí solos, por lo que no aparecen en catálogo ni terminal de ventas como productos independientes.
- Sí pueden aparecer como complementos opcionales dentro de la promo (`PromoOptionsDialog`).
- Su selección no afecta la disponibilidad ni el precio de la promo.

---

## 13. Configuración relevante

| Variable / Config | Dónde se usa | Valor por defecto |
| ----------------- | ------------ | ----------------- |
| `DEFAULT_BRANCH_NAME` | Seed y resolución de sucursal por defecto | `Sucursal por defecto` |
| `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` | Refresco del estado de caja en panel | `5000` ms |
| `CAJA_AUTO_CLOSE_HOURS` / `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS` | Cierre automático de caja | `12` h |
| `CAJA_AUTO_CLOSED_BY` | Label de cierre automático de caja | `'Sistema'` |
| `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` | Refresco del catálogo público | `30000` ms |
| `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` | Refresco del listado de pedidos del operador | `0` (deshabilitado; definir > 0 para habilitar) |
| `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` | Refresco del chat del pedido | `5000` ms |
| `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` | Longitud máxima de mensaje de chat | `1000` caracteres |
| `NEXT_PUBLIC_CHAT_PAGE_SIZE` | Mensajes de chat por página | `50` (máximo `100`) |
| `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` | Tamaño máximo de imagen en chat | `5` MB |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Timeout por defecto de requests al API | `30000` ms |
| `PUBLIC_CHAT_RATE_LIMIT_*` | Rate limit del chat público | `60s`, `60` req |
| `PUBLIC_ORDER_RATE_LIMIT_*` | Rate limit de pedidos y chat | `60s`, `10` req |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp para pedidos (fallback) | — |
| `ORDER_EXPIRATION_MS` | Expiración automática de pedidos `pending` | `3600000` ms |
| `CRON_SECRET` | Protección de endpoints de cron | — |

---

## 14. Limitaciones y comportamientos a tener en cuenta

### Resueltos recientemente

1. ~~**Cambio de precio entre pedido y venta**~~: resuelto. `convertOrderToSale` conserva los precios históricos de `order.items` usando `buildSaleItemValues` con `unitPrice` y `subtotal`.
2. ~~**Pedido `pending` infinito**~~: resuelto. `expirePendingOrders` cancela pedidos `pending` cuya antigüedad supere `ORDER_EXPIRATION_MS` (default 1 hora) e integra en `GET /api/pedidos`.
3. ~~**Cambio de sucursal en panel sin `branchId` explícito**~~: resuelto. `PedidosList` envía `branchId` en query string y `GET /api/pedidos` lo valida contra `getCurrentBranchId(session)`, rechazando accesos cruzados de `operator`.
4. ~~**Pedido exclusivo por WhatsApp sin coordinación**~~: resuelto. El flujo vigente crea el pedido en la app, ofrece un chat de pedidos (`/pedido/[id]/chat`) como canal principal y mantiene WhatsApp como fallback. Se agregaron `order_messages`, adjuntos con `attachmentKey`, `unreadCount` y limpieza de adjuntos huérfanos.

### Limitaciones vigentes

5. **Rate limit en una sola instancia**: `POST /api/public/pedido` y el chat comparten el mismo store. En una sola función serverless `memory` funciona; para escalar horizontalmente en Vercel, configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` (usa `public_order_rate_limits` en PostgreSQL).
6. **Tipos `reserve` y `reserve_release` en `stock_movements`**: el flujo vigente genera movimientos `reserve` al recibir un pedido (`in_process`) y `reserve_release` al confirmar el pago o cancelar un pedido en reserva. Los valores legacy `order` y `order_cancellation` permanecen en el enum por compatibilidad, pero no se generan en el flujo actual.
7. **Stock de productos `compound`**: el campo `products.stock` de un producto compuesto no se usa para calcular disponibilidad; se usa el stock de sus insumos críticos con `autoDiscount`. `products.stock` se mantiene en `0` y puede servir como referencia si se ajusta manualmente.
8. **Productos `manual_supply` en recetas**: son informativos; no afectan disponibilidad ni se descuentan.
9. **Soft delete y hard delete**: al eliminar un producto, video, venta o caja, el registro permanece en base con `deletedAt` y puede restaurarse desde la papelera. La eliminación permanente de productos y videos se hace individualmente desde `/productos/eliminados` y `/videos/eliminados`; libera la imagen o el archivo asociado y respeta las dependencias históricas. La eliminación de una sucursal sigue siendo hard delete de todo el branch, sin conservar historial.

---

## 15. Buenas prácticas operativas

1. **Antes de abrir el local**
   - Verificar que el `admin` y `operator` existan.
   - Verificar stock de insumos críticos y bebidas.
   - Abrir la caja del día.

2. **Durante la operación**
   - Usar `/ventas` para ventas presenciales.
   - Reponer stock inmediatamente cuando llegue mercadería (movimiento `restock`).
   - Ajustar stock por rotura/pérdida con movimiento `manual_adjustment` y motivo claro.
   - Revisar alertas de stock bajo periódicamente.

3. **Pedidos públicos y chat**
   - El cliente arma el pedido desde `/pedido` y lo confirma en la app.
   - Si `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado, la app también ofrece un mensaje de WhatsApp como fallback.
   - El cliente coordina con la sucursal por el chat del pedido (`/pedido/[id]/chat`) o, si prefiere, por WhatsApp.
   - El operador recibe el pedido (`/pedidos/[id]/recibir`) para reservar stock, confirma el pago (`/pedidos/[id]/confirmar`) cuando la caja esté abierta y finaliza (`/pedidos/[id]/finalizar`) al entregar/retirar.
   - Si el cliente u operador cancela, se liberan reservas o anula la venta según el estado; el pedido pasa a `cancelled`.

4. **Cierre de caja**
   - Cerrar la caja al finalizar el turno.
   - Si se olvida, el sistema la cierra automáticamente después de 12 horas.

5. **Cierre diario**
   - Generar el cierre diario al final del día para cuadrar totales.
   - No generar cierre si hay cajas abiertas con ventas de esa fecha.

6. **Multi-sucursal**
   - Cada sucursal administra su propio stock, precios y caja.
   - El `admin` puede cambiar de sucursal para operar en otra, pero el `operator` no.

---

## 16. Checklist antes de producción

### Implementación (resuelto)

- [x] Corregir `convertOrderToSale` para conservar precios históricos.
- [x] Validar `branchId` entero en `/pedido`.
- [x] Incluir `branchId` explícito en el panel de pedidos.
- [x] Implementar expiración automática de pedidos `pending`.
- [x] Ajustar flujo de pedidos para que reserven stock inmediatamente al crearse.

### Configuración manual (pendiente del usuario)

- [ ] Configurar `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` en Vercel.
- [ ] Configurar `DATABASE_URL` y `DATABASE_URL_UNPOOLED` con base de producción.
- [ ] Ejecutar `npx drizzle-kit push` y `npx tsx src/db/seeds.ts` en producción.
- [ ] Ejecutar `npm run build`, `npm run test:e2e` en base de prueba.
- [ ] Rotar secretos si `.env.local` fue expuesto.
- [ ] Verificar que `STORAGE_PROVIDER` y credenciales de videos estén configuradas si se usa `/videos`.

### Escalabilidad

- [x] Evaluar rate limit compartido para `POST /api/public/pedido`.
  - Resuelto: se implementó `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` (`memory` por defecto, `db` para producción con múltiples instancias).
- [ ] Configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` en Vercel si se escala horizontalmente.

---

## 17. Conclusión

Panchería es una aplicación multi-sucursal con aislamiento estricto de datos, stock transaccional, caja diaria y pedidos públicos a través del catálogo `/pedido` y su chat integrado. WhatsApp funciona como fallback cuando `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado. El flujo central es: **abrir caja → vender o recibir/reservar/pagar/finalizar pedido → descontar stock → cerrar caja → generar cierre diario**. Los pedidos reservan stock de insumos críticos al crearse (`pending`); al recibirse (`in_process`) se conserva la reserva existente; al confirmarse el pago se libera la reserva y se descuenta stock físico; al finalizar se marca entregado/retirado.

Para producción se recomienda ejecutar las verificaciones estándar, completar el checklist de configuración manual y, si se espera alta concurrencia con múltiples instancias, configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db`.
