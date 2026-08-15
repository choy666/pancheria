# Prompt: Sincronizar stock de ventas y pedidos públicos con reserva transaccional

## Contexto

Proyecto `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/catalogo-whatsapp.md" />

## Estado actual relevante

- El catálogo público y el flujo de pedidos por WhatsApp ya existen: <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/catalogo-whatsapp.md" />.
- Los pedidos públicos actuales **no persisten en base de datos ni descuentan stock**; solo validan disponibilidad y abren WhatsApp: <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="207-297" />.
- El sistema de ventas del panel ya descuenta stock de forma transaccional y reintegra al anular: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="367-580" />.
- La validación de disponibilidad del carrito ya maneja promos con insumos compartidos: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="115-281" />.
- El cálculo de disponibilidad de productos compuestos está centralizado en `summaryService.calculateCompoundAvailability`: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" lines="50-65" />.
- El servicio de catálogo público reutiliza `saleService.validateCartAvailability`: <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.ts" />.
- Las tablas actuales de ventas y stock son `sales`, `sale_items` y `stock_movements`: <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="175-256" />.
- `src/app/(public)/pedido/page.tsx` ya resuelve `searchParams` como `Promise` en Next.js 16: <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />.

## Objetivo

Convertir el flujo de pedidos públicos en un proceso transaccional que reserve stock al crearse, evitando que el negocio venda lo que un cliente ya pidió y viceversa. Los pedidos deben compartir la lógica de stock con las ventas, respetar insumos compartidos entre promos y permitir confirmación o cancelación posterior.

## Reglas de negocio

1. Un pedido debe reservar stock inmediatamente al crearse, no solo validarlo.
2. El stock reservado por pedidos debe impactar la disponibilidad que ven operadores y clientes.
3. Las promos con insumos compartidos deben seguir calculándose con `validateCartAvailability` / `calculateCompoundAvailability`.
4. Un pedido puede estar en estado `pending`, `converted` o `cancelled`.
5. Al confirmar un pedido como venta, se crea una `sale` sin volver a descontar stock (ya fue reservado).
6. Al cancelar un pedido se reintegra el stock reservado.
7. Los pedidos no requieren caja registradora abierta al crearse; la caja solo se requiere al convertir a venta.
8. No duplicar la lógica de descuento/reintegro de stock: extraer funciones compartidas desde `saleService`.
9. Respetar integridad con soft delete: productos eliminados o inactivos no deben venderse ni pedirse.
10. No hardcodear valores sensibles; usar variables de entorno para configuraciones nuevas.
11. Incluir idempotencia en la creación de pedidos para evitar duplicados.
12. Considerar expiración automática de pedidos `pending` para liberar stock en caso de no confirmación.

## Decisiones de arquitectura

- `products.stock` representa **stock disponible para ventas y pedidos** (físico menos reservas y ventas confirmadas). Al crear un pedido se decrementa `products.stock` igual que al vender. Al confirmar el pedido como venta no se toca `products.stock` nuevamente.
- `stock_movements` registra el descuento inicial del pedido con `type: 'order'`. Al convertirse en venta **no se crea un movimiento `sale` adicional**; la venta hereda la reserva a través de `order.convertedSaleId`. Si más adelante se necesita separar stock físico de reservas lógicas, se deberá migrar a un modelo de reservas explícito.
- La idempotencia de pedidos vive en la tabla `orders.idempotencyKey` y se valida con `idempotencyService` extendido a ambos dominios (`sale` y `order`).
- La cancelación pública requiere un `cancellationToken` generado en `createOrder` y devuelto al cliente; el panel puede cancelar sin token.

## Flujo del pedido

```text
Cliente arma carrito → POST /api/public/pedido
                              ↓
           ┌────────────────────┴────────────────────┐
           ↓                                       ↓
   Stock suficiente                       Stock insuficiente
   ↓                                       ↓
   Reservar stock                          Rechazar con 409/shortage
   Crear order + order_items
   Crear stock_movements tipo 'order'
   Abrir WhatsApp con número de pedido
           ↓
   Operador ve pedido en /pedidos
           ↓
   ┌───────┴───────┐
   ↓               ↓
  Confirmar      Cancelar
   ↓               ↓
  Requiere       Reintegrar stock
  caja abierta   stock_movements tipo 'order_cancellation'
   ↓               order.status = 'cancelled'
  Crear sale + sale_items
  Actualizar resumen de caja
  order.status = 'converted'
  order.convertedSaleId = sale.id
```

## Implementación detallada

### Fase 0: `searchParams` en `/pedido` (ya corregido)

- `src/app/(public)/pedido/page.tsx` ya usa `searchParams: Promise<{ branchId?: string }>` y `await searchParams` para Next.js 16. **No modificar** salvo que `npm run build` falle por un cambio futuro del framework.

### Fase 1: Refactorizar lógica de stock compartida en `saleService.ts`

Antes de crear pedidos, extraer de `confirmSale` y `cancelSale` las funciones puramente de stock para que sean reutilizables por `orderService`.

- Crear funciones auxiliares exportadas en `saleService.ts`:
  - `deductStockForItems(tx, branchId, items, productById, recipesByProduct, source, movementType)` — descuenta stock de insumos y bebidas e inserta `stock_movements`.
  - `reintegrateStockForItems(tx, branchId, items, productById, recipesByProduct, source, movementType)` — reintegra stock e inserta movimientos de cancelación/reserva.
- `items` es `{ productId: number; quantity: number }[]`.
- `source: { saleId?: number; orderId?: number }` indica a qué operación pertenece el movimiento.
- `movementType` es `'sale' | 'order' | 'cancellation' | 'order_cancellation'` y define el valor de `stock_movements.type`.
- Reemplazar los bloques duplicados de `confirmSale` y `cancelSale` por llamadas a estas funciones.
- Asegurar que los tests unitarios de `saleService.test.ts` sigan pasando.
- **Recomendación**: evaluar bloquear los productos con `.for('update')` dentro de la transacción y/o agregar una cláusula `WHERE stock >= ...` para evitar stock negativo bajo concurrencia.

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="499-544" />
<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="650-695" />

### Fase 2: Extender el esquema de base de datos

Modificar `src/db/schema.ts` sin romper datos históricos.

1. Agregar enums:
   ```ts
   export const orderStatusEnum = pgEnum('order_status', ['pending', 'converted', 'cancelled']);
   export const deliveryTypeEnum = pgEnum('delivery_type', ['delivery', 'pickup']);
   ```
2. Agregar tablas `orders` e `order_items`, con campos similares a `sales`/`sale_items` más datos del cliente:
   - `orders`: `branchId`, `orderNumber` (único por sucursal, legible para el cliente), `total`, `status`, `customerName`, `deliveryType`, `address`, `notes`, `cancellationToken`, `convertedSaleId`, `idempotencyKey`, `createdAt`, `cancelledAt`, `cancellationReason`, `deletedAt`.
   - `order_items`: `orderId`, `productId`, `quantity`, `unitPrice`, `subtotal`.
   - FKs: `orders.branchId → branches.id (onDelete: 'restrict')`, `orders.convertedSaleId → sales.id (onDelete: 'set null')`, `order_items.orderId → orders.id (onDelete: 'cascade')`, `order_items.productId → products.id (onDelete: 'restrict')`.
   - Índices: `orders_branch_id_idx`, `orders_status_idx`, `orders_branch_status_deleted_at_idx`, `orders_order_number_unique_idx` por `branchId`+`orderNumber`, `orders_idempotency_branch_unique_idx` por `branchId`+`idempotencyKey`.
3. Extender `stock_movements` con `orderId` nullable y FK a `orders.id` (`onDelete: 'set null'`).
4. Extender `stockMovementTypeEnum` con `'order'` y `'order_cancellation'`.
5. Generar y empujar migraciones con `npx drizzle-kit generate` y `npx drizzle-kit push` (solo en base de prueba primero).

<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="175-256" />

### Fase 3: Crear `orderService.ts` con reglas de pedido

Crear `src/application/services/orderService.ts` reutilizando `validateCartAvailability` y las funciones compartidas de stock.

1. `createOrder(params)`:
   - `params` incluye `branchId`, `items: SaleItemInput[]`, `customerName`, `deliveryType`, `address?`, `notes?`, `idempotencyKey`.
   - Validar sucursal, productos activos/no eliminados y vendibilidad usando `isPublicSellableProduct` de `src/lib/catalog.ts`.
   - Llamar `validateCartAvailability` para detectar faltantes.
   - Verificar idempotencia con `idempotencyService` extendido a scope `'order'`.
   - Ejecutar en transacción:
     - Generar `orderNumber` único por sucursal (ej. `PED-${branchId}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`).
     - Descontar `products.stock` con `deductStockForItems(..., source: { orderId: order.id }, movementType: 'order')`.
     - Insertar `order` e `order_items`.
     - Insertar `stock_movements` con `type: 'order'`, `orderId` y `saleId` nulo.
   - Generar mensaje de WhatsApp con `buildWhatsAppMessage` e incluir el `orderNumber`.
   - Retornar el pedido creado, incluyendo `cancellationToken` (solo para el cliente que creó el pedido).

2. `cancelOrder(branchId, id, reason, token?)`:
   - Validar que el pedido exista y esté `pending`.
   - Si se provee `token` (cancelación pública), validar que coincida con `orders.cancellationToken`.
   - En transacción:
     - Reintegrar stock con `reintegrateStockForItems(..., source: { orderId: order.id }, movementType: 'order_cancellation')`.
     - Marcar pedido como `cancelled`, llenar `cancelledAt` y `cancellationReason`.

3. `convertOrderToSale(params)`:
   - `params` incluye `branchId`, `orderId`, `paymentMethod`, `idempotencyKey`.
   - Requerir caja abierta (`cashRegisterService.getOpenCashRegister`).
   - Validar que el pedido esté `pending`.
   - Crear `sale` e `sale_items` a partir del pedido.
   - **No descontar stock nuevamente** ni generar movimientos `sale` adicionales.
   - Actualizar `orders.status = 'converted'`, `orders.convertedSaleId = sale.id`.
   - Actualizar resumen de caja con `updateCashRegisterSummary`.
   - Validar idempotencia de la venta con scope `'sale'`.

4. `getPendingOrders(branchId)` y `getOrderById(branchId, id)`.

### Fase 4: Crear/actualizar rutas API

1. Extender `src/lib/zod-schemas.ts`:
   - `orderSchema`: `items` (array de `saleItemSchema`, mínimo 1), `customerName` (string 1-255), `deliveryType` (`'delivery' | 'pickup'`), `address` (optional, max 500, requerido si `deliveryType === 'delivery'`), `notes` (optional, max 1000), `idempotencyKey` (string 1-255).
   - `orderConfirmSchema`: `paymentMethod` (`'cash' | 'transfer'`), `idempotencyKey` (string).
   - `orderCancellationSchema`: `reason` (string 3-500), `token` (optional string).

2. API pública:
   - `POST /api/public/pedido`: crea el pedido, retorna `{ order, whatsappUrl }`.
   - `POST /api/public/pedido/[id]/cancelar`: cancela un pedido `pending` usando `cancellationToken` en el body.

3. API del panel (requiere auth):
   - `GET /api/pedidos`: lista pedidos por sucursal con filtros por estado.
   - `GET /api/pedidos/[id]`: detalle.
   - `POST /api/pedidos/[id]/confirmar`: convierte pedido en venta con `paymentMethod` e `idempotencyKey`.
   - `POST /api/pedidos/[id]/cancelar`: cancela desde el panel (sin token).

4. Actualizar `src/config/api.ts` con las nuevas constantes:
   - `PUBLIC_PEDIDO_API = '/api/public/pedido'`
   - `PEDIDOS_API = '/api/pedidos'`
   - `PEDIDOS_CONFIRMAR_API(orderId)` / `PEDIDOS_CANCELAR_API(orderId)` helpers si se prefiere.

<ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />

### Fase 5: Actualizar frontend de pedidos

Modificar `src/components/pedido/pedido-client.tsx` para que el checkout no abra WhatsApp inmediatamente, sino que cree el pedido primero.

1. Al hacer clic en "Enviar por WhatsApp":
   - Llamar `POST /api/public/pedido` con el body validado.
   - Si hay faltantes, mostrar error (el servicio debe devolver `InsufficientStockError` → 409).
   - Si es exitoso, abrir WhatsApp con el mensaje que incluya el `orderNumber`.
   - Limpiar carrito.
2. Extender `PublicOrder` y `buildWhatsAppMessage` en `src/lib/whatsapp.ts` para incluir `orderNumber` al inicio del mensaje.
3. Mantener el refresco periódico del catálogo (`getPedidoRefetchIntervalMs`) para reflejar reservas de otros clientes.
4. Mostrar confirmación con `orderNumber` y botón de cancelar (usando `cancellationToken` guardado en el cliente; opcional para la primera fase).

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="207-297" />

### Fase 6: Crear panel de gestión de pedidos

1. Agregar rutas en `src/config/routes.ts`: `pedidos: '/pedidos'`, `pedidoDetalle: (id) => `/pedidos/${id}`.
2. Nueva página `src/app/(panel)/pedidos/page.tsx` para listar pedidos `pending`.
3. Nueva página `src/app/(panel)/pedidos/[id]/page.tsx` para ver detalle, confirmar como venta o cancelar.
4. El administrador y el operador pueden gestionar pedidos de su sucursal (`getCurrentBranchId` desde sesión).
5. Al confirmar, abrir el flujo de pago (efectivo/transferencia) y vincular a caja.
6. Agregar enlace en `PanelHeader` (admin y operator nav items) para acceder a `/pedidos`.

### Fase 7: Tests

1. Tests unitarios en `src/application/services/orderService.test.ts` con Jest:
   - Pedido descuenta stock correctamente.
   - Pedido con promos compartidas respeta insumos.
   - Cancelación reintegra stock.
   - Confirmación crea `sale` sin doble descuento.
   - Producto inactivo o eliminado rechaza el pedido.
   - Idempotencia evita duplicados.
   - Cancelación pública rechaza token inválido.
2. Tests de API en `src/app/api/public/pedido/route.test.ts` y `src/app/api/pedidos/route.test.ts`.
3. Tests E2E mínimos:
   - Cliente arma pedido, stock se reserva.
   - Operador ve disponibilidad reducida.
   - Confirmar pedido desde el panel genera venta.
   - Cancelar pedido libera stock.
4. Actualizar `catalogService.test.ts` si el cálculo de disponibilidad cambia.
5. Actualizar `tests/e2e/global-setup.ts` para truncar también `orders` y `order_items`.

<ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.test.ts" />

### Fase 8 (opcional): Expiración de pedidos pendientes

- Agregar campo `expiresAt` en `orders` o un campo configurable.
- Crear un endpoint o cron interno que cancele pedidos `pending` viejos liberando stock.
- Documentar el comportamiento en `AGENTS.md` si se habilita.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales ni URLs de API.
- Ejecutar `npx drizzle-kit generate` y `npx drizzle-kit push` solo en base de datos de prueba primero.
- No correr `npm run test:e2e` contra una base con datos reales (trunca tablas de negocio y re-seedea).
- `.env.local` no debe commitearse.
- Las APIs públicas deben tener rate limiting para evitar abuso de creación de pedidos. Implementar un limitador simple por IP en `POST /api/public/pedido` (la clase `RateLimitStore` existente está diseñada para username de login; no reutilizarla sin adaptar la clave a `ip:<ip>` o crear un store específico).
- La confirmación de pedidos requiere autenticación y caja abierta.
- Validar que los productos de un pedido pertenezcan a la sucursal del pedido.
- No exponer `ProductRow` completo en APIs públicas; mapear a DTOs.
- `cancellationToken` debe ser criptográficamente aleatorio y no devolverse en listados de panel.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y calidad |
| `npx drizzle-kit generate` y `npx drizzle-kit push` | Migraciones en base de prueba |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba |

## Anti-patrones a evitar

- No duplicar el descuento de stock en `orderService` y `saleService`.
- No confirmar un pedido sin verificar caja abierta.
- No borrar pedidos físicamente; usar estados y soft delete si aplica.
- No modificar `products.stock` fuera de transacciones.
- No mezclar pedidos con ventas en la tabla `sales`.
- No generar un movimiento `sale` adicional al convertir un pedido (evita doble descuento).
- No olvidar truncar `orders` y `order_items` en `tests/e2e/global-setup.ts`.
