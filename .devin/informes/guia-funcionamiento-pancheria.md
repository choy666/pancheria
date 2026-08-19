# Guía de funcionamiento y manejo de la aplicación — Panchería

**Fecha:** 2026-08-18  
**Proyecto:** `pancheria`  
**Basada en:** código actual, `AGENTS.md`, `README.md`, <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />.

---

## 1. ¿Se puede pasar a producción con el estado actual?

**Respuesta corta:** la aplicación es funcional, los tests unitarios y E2E pasan, y el build de producción es exitoso. Los riesgos críticos del flujo de pedidos (`convertOrderToSale` con precios históricos, `branchId` explícito, expiración automática de pedidos `pending`) ya están resueltos.

Los hallazgos restantes son de deuda técnica, documentación, escalabilidad y configuración de producción. No bloquean por completo la operación, pero conviene resolverlos antes de escalar, en especial el rate limit en memoria y la configuración de variables de entorno en Vercel.

---

## 2. Conceptos fundamentales

### 2.1 Multi-sucursal

- Todo dato de negocio (productos, usuarios, ventas, pedidos, cajas, movimientos, cierres, videos) está aislado por `branchId`.
- La tabla `branches` tiene las sucursales.
- Los usuarios pertenecen a una única sucursal (`users.branchId`).
- El `admin` puede cambiar de sucursal activa desde el panel; la selección se guarda en la cookie `activeBranchId`.
- El `operator` siempre opera en su sucursal asignada.
- Los productos y recetas se copian a una nueva sucursal cuando se crea con `NEW_BRANCH_NAME`/`NEW_BRANCH_USERNAME`/`NEW_BRANCH_PASSWORD` vía seed.

### 2.2 Roles

- **admin**: puede crear/editar/eliminar productos, recetas, stock, usuarios, sucursales; abrir/cerrar caja; ver historial; cambiar de sucursal activa.
- **operator**: puede vender, gestionar stock, abrir/cerrar su caja asignada, ver historial, confirmar/cancelar pedidos. No puede crear productos ni usuarios.

### 2.3 Tipos de producto

Cada producto en `products` tiene uno de estos tipos:

- `critical_supply`: insumo crítico. Tiene un `criticalSupplyType`: `bread` (pan), `sausage` (salchicha) o `beverage` (bebida). Los críticos con `autoDiscount: true` en una receta son los únicos que descuentan stock automáticamente al vender una promo.
- `manual_supply`: insumo manual (salsas, condimentas, cajas, etc.). Se usa como referencia informativa en recetas, **no descuenta stock automáticamente**.
- `compound`: producto compuesto/promo. Tiene una receta (`recipes`) que indica qué insumos críticos y en qué cantidad se consumen.
- `service`: servicio adicional (toppings, vasos de gaseosa, etc.). No tiene stock ni receta; es ilimitado.

Solo los productos `compound`, `service` o `critical_supply` con `criticalSupplyType === 'beverage'` son **vendibles al público**.

<ref_file file="C:/developer/paginas/pancheria/src/lib/catalog.ts" />

---

## 3. Productos y recetas

### 3.1 Creación de productos

- Todo producto se crea con `stock = 0` por defecto, excepto si el tipo es `compound` o `service`, que siempre tienen `stock = 0` y `minStock = 0`.
- El stock inicial se carga con un movimiento de tipo `restock` a través de `/stock/ajustar` o el seed.
- Los productos `manual_supply` no pueden tener precio (`price` debe ser `0`). Los demás sí.
- Los productos `critical_supply` deben tener un `criticalSupplyType`.
- El soft delete evita perder el historial de ventas y pedidos.

### 3.2 Recetas

- Una receta vincula un producto `compound` con varios insumos (`critical_supply` o `manual_supply`).
- Solo los insumos críticos pueden tener `autoDiscount: true`. Eso indica que al vender/comprometer una promo, se descuenta stock del insumo automáticamente.
- Un insumo manual puede estar en la receta, pero nunca con `autoDiscount: true`.
- No puede haber insumos duplicados ni un compuesto usándose a sí mismo.
- Si se elimina un insumo crítico usado en una promo activa, no se permite; hay que eliminar o inactivar la promo primero.

### 3.3 Disponibilidad de un producto

- Para `service`: disponibilidad infinita.
- Para `critical_supply` tipo `beverage`: `stock` del producto.
- Para `compound`: la mínima cantidad de veces que se puede armar considerando el stock de todos sus insumos críticos con `autoDiscount`.
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
| `order` | Reserva de stock por pedido público | **No se genera** en el flujo actual; los pedidos `pending` no reservan stock. | No (no se genera) |
| `order_cancellation` | Liberación de stock reservado por pedido | **No se genera** en el flujo actual; los pedidos `pending` no reservan stock. | No |

<ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> (`StockMovementType`).

### 4.3 ¿Cuándo se descuenta stock automáticamente?

1. **Venta directa (`/ventas`)**
   - El operador arma el carrito y confirma.
   - Se valida caja abierta y disponibilidad.
   - Se inserta la venta (`sales` + `sale_items`).
   - Se descuenta stock de los insumos críticos con `autoDiscount` de las promos y de las bebidas (`critical_supply` tipo `beverage`) vendidas.
   - Se insertan movimientos `sale`.

2. **Pedido público (`/pedido`)**
   - El cliente arma el carrito y envía el pedido por WhatsApp.
   - Se valida disponibilidad de stock en el momento (`validateCartAvailability`) pero **no se reserva ni descuenta stock**.
   - El pedido queda `pending` y el stock sigue disponible para otras ventas hasta que el operador confirme.

3. **Conversión de pedido a venta (`/pedidos/[id]/confirmar`)**
   - El operador revisa el pedido pendiente, confirma la forma de pago y confirma.
   - Se valida nuevamente la disponibilidad de stock y se descuenta transaccionalmente (`deductStockForItems` con `movementType: 'sale'`).
   - Se crea la venta (`sales` + `sale_items`) y se actualiza el resumen de caja.
   - El pedido pasa a `converted` y se vincula con `convertedSaleId`.

### 4.4 ¿Cuándo se reintegra stock automáticamente?

1. **Anulación de venta (`/ventas/[id]/anular`)**
   - La venta debe ser de una caja abierta.
   - Se reintegra stock de los insumos críticos (`reintegrateStockForItems` con `movementType: 'cancellation'`).
   - Se resta la venta del resumen de caja.
   - La venta pasa a `cancelled`.

2. **Cancelación de pedido público (`/pedido/[id]/cancelar` o panel `/pedidos/[id]/cancelar`)**
   - El pedido debe estar `pending`.
   - El cliente puede cancelar con el `cancellationToken`; el operador cancela desde el panel sin token.
   - **No se modifica stock** porque el pedido nunca reservó ni descontó stock.
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
- La caja lleva un resumen de ventas: `total`, `cashTotal`, `transferTotal`, `totalSales`, `productsSummary`, `criticalSuppliesSummary`.

### 5.2 Ciclo de vida

1. **Apertura**
   - Desde `/caja` el operador/admin abre la caja indicando usuario.
   - Se inserta un registro con `status = 'open'`.
   - No se requiere monto inicial; todos los totales comienzan en `0`.

2. **Ventas**
   - Cada venta confirmada incrementa `totalSales`, `total`, `cashTotal` o `transferTotal` según medio de pago.
   - `productsSummary` cuenta unidades vendidas por nombre de producto.
   - `criticalSuppliesSummary` cuenta unidades de bebidas y, para promos, las cantidades de insumos críticos consumidos.

3. **Cierre manual**
   - El operador/cierra la caja.
   - Se calcula el resumen final y se graba en el registro (`status = 'closed'`, `closedAt`, `closedBy`).

4. **Cierre automático**
   - Si la caja lleva abierta más de `AUTO_CLOSE_HOURS` (12 horas por defecto, configurable en <ref_file file="C:/developer/paginas/pancheria/src/config/caja.ts" />), al consultarla se cierra automáticamente (`autoClosed = true`, `closedBy = 'Sistema'`).

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
5. El cliente agrega productos al carrito.
6. El carrito se guarda en `localStorage` (`pancheria-cart-v1`) vinculado a la `branchId`.
7. El cliente completa nombre, tipo de entrega (`delivery`/`pickup`) y notas.
8. Al confirmar:
   - Se valida disponibilidad.
   - Se crea el pedido con estado `pending`.
   - **No se reserva ni descuenta stock**.
   - Se genera un mensaje de WhatsApp con el resumen y un enlace a `wa.me/{NUMERO}`.
9. El cliente abre WhatsApp, envía el mensaje y vuelve a la app:
   - El diálogo detecta el regreso y pregunta si logró enviar el mensaje.
   - Si confirma, se registra `sentAt` en el pedido mediante `POST /api/public/pedido/[id]/enviar` validado con `cancellationToken`.
   - El pedido sigue en estado `pending`; `sentAt` solo indica que el cliente ya envió el mensaje.
   - El diálogo muestra un mensaje de éxito definitivo.
10. El cliente puede cancelar el pedido desde el mismo diálogo usando el `cancellationToken`.

### 7.2 Flujo del operador

1. El operador/admin ve los pedidos `pending` de su sucursal en `/pedidos`.
2. Los pedidos `pending` que ya fueron enviados por WhatsApp muestran un badge `Enviado por WhatsApp` además del estado `Pendiente`.
3. Al abrir un pedido, ve detalle y acciones.
4. **Confirmar como venta**
   - Requiere caja abierta.
   - Valida disponibilidad, descuenta stock y crea la venta.
   - El pedido pasa a `converted`.
4. **Cancelar**
   - Requiere motivo.
   - No modifica stock.
   - El pedido pasa a `cancelled`.

### 7.3 Rate limiting

- `POST /api/public/pedido` limita por IP usando un `Map` en memoria.
- Ventana y máximo configurables por `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` y `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`.

---

## 8. Cierres diarios

### 8.1 Propósito

- Generar una foto de las ventas de un día determinado.
- Sirve para cuadrar caja y conocer totales por día.

### 8.2 Flujo

1. El operador/admin genera un cierre para una fecha desde `/cierre`.
2. El sistema:
   - Rechaza si ya existe un cierre para esa fecha en esa sucursal.
   - Rechaza si hay cajas abiertas con ventas de esa fecha.
   - Suma todas las ventas `active` del día con caja no eliminada.
   - Calcula totales y resúmenes.
   - Inserta en `dailyClosures`.

### 8.3 Relación con caja

- El cierre no modifica caja ni stock; es un resumen informativo.
- Las ventas canceladas después del cierre no afectan el cierre ya generado.

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
| Confirmar venta | Sí | `sale` | `products`, `sale_items`, `sales`, `stock_movements`, `cashRegisters` | Descuenta insumos críticos y bebidas |
| Anular venta | Sí | `cancellation` | `products`, `sales`, `stock_movements`, `cashRegisters` | Reintegra stock; requiere caja abierta |
| Crear pedido público | No | — | `order_items`, `orders` | Valida stock; estado `pending` (no reserva) |
| Confirmar envío por WhatsApp | No | — | `orders` | Actualiza `sentAt`; el estado sigue `pending` |
| Cancelar pedido público | No | — | `orders` | No modifica stock |
| Confirmar pedido como venta | Sí | `sale` | `products`, `sale_items`, `sales`, `stock_movements`, `orders`, `cashRegisters` | Descuenta stock, crea venta y actualiza caja |
| Eliminar producto | No | — | `products` (soft delete) | No si está en recetas activas |
| Eliminar caja | No | — | `cashRegisters` (soft delete) | No si está abierta |
| Cierre diario | No | — | `dailyClosures` | Resumen informativo |

---

## 11. Flujo compartido entre ventas y pedidos

Tanto `confirmSale` como `createOrder` usan los mismos helpers compartidos:

- `buildProductContext(branchId, productIds)` (`src/lib/product-helpers.ts`): carga productos y recetas.
- `validateProductsForOperation(...)` (`src/lib/product-helpers.ts`): valida que los productos sean vendibles, activos y de la sucursal.
- `validateCartAvailability(...)` (`src/lib/product-helpers.ts`): calcula disponibilidad y shortage.
- `buildSaleItemValues(productById, items)` (`src/lib/sale-helpers.ts`): calcula `unitPrice` y `subtotal`.
- `buildOrderValues(...)` y `buildOrderItemValues(...)` (`src/lib/order-helpers.ts`): construyen los registros de `orders` y `order_items`.
- `deductStockForItems(...)` (`src/application/services/saleService.ts`): descuenta stock con lock pesimista (`SELECT ... FOR UPDATE`).
- `lockOpenCashRegister(...)` y `lockCashRegisterById(...)` (`src/lib/cash-register-helpers.ts`): lockean la caja abierta para actualizarla.

La diferencia es:

- **Venta**: `deductStockForItems` con `movementType: 'sale'`.
- **Pedido**: no genera movimiento de stock.
- **Conversión de pedido a venta**: revalida disponibilidad y descuenta stock (`deductStockForItems` con `movementType: 'sale'`); inserta venta y actualiza resumen de caja.

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

### 12.4 Manual y otros críticos

No son vendibles al público, por lo que no aparecen en catálogo ni terminal de ventas.

---

## 13. Configuración relevante

| Variable / Config | Dónde se usa | Valor por defecto |
| ----------------- | ------------ | ----------------- |
| `DEFAULT_BRANCH_NAME` | Seed y resolución de sucursal por defecto | `Sucursal por defecto` |
| `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` | Refresco del estado de caja en panel | `5000` ms |
| `AUTO_CLOSE_HOURS` | Cierre automático de caja | `12` h |
| `AUTO_CLOSED_BY` | Label de cierre automático de caja | `'Sistema'` |
| `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` | Refresco del catálogo público | `30000` ms |
| `PUBLIC_ORDER_RATE_LIMIT_*` | Rate limit de pedidos | `60s`, `10` req |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp para pedidos | — |

---

## 14. Limitaciones y comportamientos a tener en cuenta

### Resueltos recientemente

1. ~~**Cambio de precio entre pedido y venta**~~: resuelto. `convertOrderToSale` conserva los precios históricos de `order.items` usando `buildSaleItemValues` con `unitPrice` y `subtotal`.
2. ~~**Pedido `pending` infinito**~~: resuelto. `expirePendingOrders` cancela pedidos `pending` cuya antigüedad supere `ORDER_EXPIRATION_MS` (default 1 hora) e integra en `GET /api/pedidos`.
3. ~~**Cambio de sucursal en panel sin `branchId` explícito**~~: resuelto. `PedidosList` envía `branchId` en query string y `GET /api/pedidos` lo valida contra `getCurrentBranchId(session)`, rechazando accesos cruzados de `operator`.

### Limitaciones vigentes

4. **Rate limit en memoria**: `POST /api/public/pedido` limita por IP con un `Map` en el proceso de Node. No escala horizontalmente en Vercel con múltiples funciones; requiere store compartido (Redis, Vercel KV, PostgreSQL) para escalar.
5. **Tipos `order` y `order_cancellation` en `stock_movements`**: los enum `StockMovementType` y el esquema de base de datos aún incluyen estos valores, pero el flujo actual de pedidos no los genera porque los pedidos `pending` no reservan stock. Se conservan por compatibilidad histórica y posibles ajustes manuales.
6. **Stock de productos `compound`**: el campo `products.stock` de un producto compuesto no se usa para calcular disponibilidad; se usa el stock de sus insumos críticos con `autoDiscount`. `products.stock` se mantiene en `0` y puede servir como referencia si se ajusta manualmente.
7. **Productos `manual_supply` en recetas**: son informativos; no afectan disponibilidad ni se descuentan.
8. **Soft delete**: al eliminar un producto, venta o caja, el registro permanece en base con `deletedAt`. Para eliminar definitivamente hay que ir a la papelera.

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

3. **Pedidos por WhatsApp**
   - Configurar `NEXT_PUBLIC_WHATSAPP_NUMBER` en producción.
   - El cliente envía el mensaje; el operador confirma el pedido en `/pedidos` cuando la caja esté abierta.
   - Si el cliente cancela, no se modifica stock; el pedido pasa a `cancelled`.

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
- [x] Ajustar flujo de pedidos para que no reserven stock al crearse.

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

Panchería es una aplicación multi-sucursal con aislamiento estricto de datos, stock transaccional, caja diaria y pedidos públicos por WhatsApp. El flujo central es: **abrir caja → vender/confirmar pedido → descontar stock → cerrar caja → generar cierre diario**. Los pedidos no reservan stock; el stock se descuenta únicamente cuando el operador confirma el pedido desde el panel.

Para producción se recomienda ejecutar las verificaciones estándar, completar el checklist de configuración manual y, si se espera alta concurrencia con múltiples instancias, configurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db`.
