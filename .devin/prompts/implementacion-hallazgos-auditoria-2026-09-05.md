# Prompt: implementación de hallazgos críticos y mayores de la auditoría 2026-09-05

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y chat.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Este prompt es la continuación operativa del <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />. El objetivo es implementar los hallazgos críticos y mayores detectados en la auditoría masiva del 2026-09-05.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />

## Hallazgos a implementar

Los seis ítems siguientes deben quedar resueltos y verificados.

### 1. Hacer `executeInTransaction` re-entrante o refactorizar `cancelSale`

**Problema:** `orderService.cancelOrder` abre una transacción con `executeInTransaction` y, dentro de la misma, llama `cancelSale` para pedidos `paid`. `cancelSale` vuelve a invocar `executeInTransaction`, generando una transacción anidada no atómica. <ref_file file="C:/developer/paginas/pancheria/src/application/transactionService.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />

**Criterio de aceptación:**

- La anulación de un pedido `paid` (cancelación de la venta asociada + cancelación del pedido + liberación/reintegro de stock) debe ejecutarse en una única transacción.
- Si una parte falla, tanto la venta como el pedido deben quedar en su estado original.
- `cancelSale` sigue funcionando cuando se invoca directamente (por ejemplo, desde el panel de ventas).

**Opciones de implementación:**

- **Opción A (preferida):** modificar `executeInTransaction` para consultar `getCurrentTransaction()`. Si existe una transacción activa, ejecutar `fn(tx)` directamente sin iniciar `db.transaction`. Esto hace el wrapper re-entrante y corrige automáticamente todos los casos anidados.
- **Opción B:** agregar a `cancelSale` un parámetro opcional `dbOrTx` para recibir una transacción externa. Si se pasa, no inicia transacción propia; si no, mantiene el comportamiento actual. `cancelOrder` pasaría `tx`.

**Consideraciones:**

- `cancelSale` lee la venta con `db.query.sales.findFirst` antes de `executeInTransaction`. Esa lectura no es transaccional. Evaluar si puede leerse dentro de la misma `tx` (o `db` si no hay tx activa).
- Agregar test unitario de `cancelOrder` con un pedido `paid` y venta asociada, verificando que ambas quedan `cancelled` y el stock se reintegra.
- Si se modifica `executeInTransaction`, ejecutar todos los tests para asegurar que no se rompe el aislamiento de otras transacciones.

### 2. Unificar validación y deducción de recetas en `convertOrderToSale`

**Problema:** `convertOrderToSale` prepara `itemsForValidation` solo con `productId`, `quantity` y `selectedRecipeItemIds`, sin el snapshot histórico. `validateCartAvailability` usa `recipesByProduct` (recetas actuales) para validar disponibilidad. Luego, `buildSaleItemValues` descuenta con `recipeSnapshot` del pedido. Si la receta cambia entre la creación y la conversión, se valida con unos insumos y se descuentan otros. <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" />

**Criterio de aceptación:**

- `convertOrderToSale` valida la disponibilidad usando los mismos datos que luego se descontarán.
- Si la receta actual difiere del snapshot, la conversión debe decidir consistentemente: o rechaza por falta de stock según el snapshot, o descuenta exactamente lo que validó.
- Los precios históricos del pedido se conservan (`unitPrice`, `subtotal` de `order.items`).
- Los tests existentes de `convertOrderToSale` siguen pasando.

**Implementación sugerida:**

- Extender `SaleItemInput` o crear un tipo específico para conversión que incluya el `recipeSnapshot` completo.
- Hacer que `validateCartAvailability` acepte un flag o un tipo de operación que le indique usar el snapshot histórico en lugar de las recetas actuales.
- Alternativa: construir un `recipesByProduct` a partir de los snapshots del pedido (`order_item_recipes`) y pasarlo a `validateCartAvailability`.
- Asegurar que `buildSaleItemValues` reciba los mismos datos y no recalcule el subtotal si ya viene del pedido.
- Agregar test que modifique una receta después de crear el pedido y verifique que `convertOrderToSale` usa los insumos del snapshot (o rechaza consistentemente).

### 3. Agregar `scope` al rate limit de pedidos y chat

**Problema:** `createRateLimiter(_scope, ...)` ignora el parámetro `_scope`. `public_order_rate_limits` usa `ip` como clave primaria. En el store `db`, pedidos y chat comparten el mismo contador. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/public-order-rate-limit-store.ts" /> <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="708-712" />

**Criterio de aceptación:**

- Un cliente que alcanza el límite de chat no debe quedar bloqueado para crear pedidos, y viceversa.
- La clave primaria de `public_order_rate_limits` debe ser compuesta `(scope, ip)`.
- El store `InMemoryPublicOrderRateLimitStore` también separa por scope.
- `createRateLimiter` propaga el scope al store.
- Las migraciones de Drizzle se generan y aplican solo en base de prueba con confirmación explícita.

**Implementación sugerida:**

- Modificar el esquema:
  ```ts
  export const publicOrderRateLimits = pgTable('public_order_rate_limits', {
    scope: varchar('scope', { length: 64 }).notNull(),
    ip: varchar('ip', { length: 255 }).notNull(),
    count: integer('count').notNull(),
    resetAt: bigint('reset_at', { mode: 'number' }).notNull(),
  }, (table) => [primaryKey({ columns: [table.scope, table.ip] })]);
  ```
- Actualizar `PublicOrderRateLimitStore` y `InMemoryPublicOrderRateLimitStore` para recibir `scope`.
- Actualizar `createRateLimiter` para pasar `scope` a `recordRequest`.
- Actualizar queries de upsert, reset y cleanup para incluir `scope`.
- Generar migración `npx drizzle-kit generate` y verificar con `npx drizzle-kit check` en una base de prueba.
- Agregar tests unitarios y, si aplica, E2E.

### 4. Agregar `orderId` nullable a `stock_movements`

**Problema:** La tabla `stock_movements` tiene `saleId` pero no `orderId`. Las reservas de pedidos solo registran el id del pedido como texto en `reason`. <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="489-517" />

**Criterio de aceptación:**

- `stock_movements` tiene una columna `orderId` nullable con `references(() => orders.id, { onDelete: 'set null' })`.
- `insertStockReserveMovements` y las operaciones de reserva/liberación escriben el `orderId`.
- `reason` sigue siendo descriptivo (`reserve`, `reserve_release`, `sale`, `sale_cancelled`, etc.) y no se usa como clave foránea.
- El esquema mantiene la relación inversa en `ordersRelations`.
- Se genera y aplica migración solo en base de prueba.

**Implementación sugerida:**

- Agregar `orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' })`.
- Actualizar `insertStockReserveMovements` en `orderService.ts` para incluir `orderId: orderId`.
- Actualizar `release` y otras inserciones de reserva en `orderService.ts` y `saleService.ts` si corresponde.
- Generar migración y actualizar tests.

### 5. Resolver `getClientIp` para producción fuera de Vercel

**Problema:** En producción, si no está en Vercel y no se configuró `TRUSTED_PROXY_IP_HEADER`, `getClientIp` lanza `DomainError` y bloquea todos los endpoints públicos con rate limit. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/config/env.ts" />

**Criterio de aceptación:**

- El sistema funciona en producción auto-alojado o en cualquier plataforma que no sea Vercel sin requerir `TRUSTED_PROXY_IP_HEADER` forzosamente.
- La resolución de IP sigue siendo robusta contra spoofing cuando hay proxy confiable configurado.
- El rate limit no se desactiva silenciosamente.

**Opciones de implementación:**

- **Opción A (defensiva):** cuando `TRUSTED_PROXY_IP_HEADER` no esté configurado y no esté en Vercel, usar la IP de conexión directa (`request.ip` de Next.js, si está disponible, o el header estándar del runtime) con un log de advertencia.
- **Opción B (estricta):** documentar explícitamente en `AGENTS.md`, `.env.example` y el README que `TRUSTED_PROXY_IP_HEADER` es obligatorio en producción fuera de Vercel; mejorar el mensaje de error para indicar cómo configurarlo.
- **Opción C:** agregar una variable `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS=true` que permita, como escape controlado, usar el último hop de la conexión cuando no hay proxy confiable.

Se recomienda implementar **A o C** para no romper despliegues fuera de Vercel.

### 6. Crear `src/lib/cart-pipeline.test.ts`

**Problema:** `prepareCart` en `src/lib/cart-pipeline.ts` es el coordinador central de ventas y pedidos, pero no tiene test unitario. <ref_file file="C:/developer/paginas/pancheria/src/lib/cart-pipeline.ts" />

**Criterio de aceptación:**

- El test cubre al menos:
  - Construcción del contexto (`productById`, `recipesByProduct`).
  - Bloqueo `FOR UPDATE` cuando `shouldLock: true`.
  - Validación de disponibilidad con y without reservas activas (`excludeOrderId`).
  - Cálculo de totales para `venta` y `pedido`.
  - Insumos críticos, manuales, servicios y promos.
  - Caso de escasez (`shortage`).
- Mockear `dbOrTx` o usar una base de datos de prueba con seed.
- Los tests pasan con `npm test`.

## Reglas de oro para esta implementación

1. Idioma español en comentarios, documentación e informes.
2. No hardcodear credenciales, URLs de APIs ni secretos.
3. No ejecutar `npx drizzle-kit push`, `npx drizzle-kit generate` que modifique el esquema de producción. Solo en base de prueba y con confirmación explícita.
4. No ejecutar `npm run test:e2e` ni `npx tsx src/db/seeds.ts` sin confirmación y base de datos descartable.
5. Cualquier cambio en el esquema debe acompañarse de migración generada con `npx drizzle-kit generate`.
6. Cualquier cambio en lógica de negocio debe acompañarse de tests unitarios que cubran el caso de borde detectado.
7. Mapear errores de dominio a HTTP correctos: `NotFoundError` → 404, `DomainError` → 400, `ForbiddenError` → 403.
8. Si se modifica `transactionService.ts`, validar que `getCurrentTransaction()` y `executeInTransaction` siguen funcionando para casos no anidados.

## Plan de trabajo sugerido

1. **Preparar entorno:** leer `AGENTS.md`, `reporte-estado.md`, `lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md` y `entornos.md`.
2. **Esquema:** implementar cambios en `public_order_rate_limits` y `stock_movements`; generar migración; verificar con `npx drizzle-kit check`.
3. **Transacciones:** resolver anidamiento (ítem 1).
4. **Recetas:** unificar validación/deducción (ítem 2).
5. **Rate limit:** propagar scope (ítem 3).
6. **Client IP:** ajustar resolución (ítem 5).
7. **Tests:** crear `cart-pipeline.test.ts` (ítem 6) y agregar tests de regresión para transacciones, recetas, rate limit y stock.
8. **Verificaciones:** ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`.
9. **E2E (opcional):** si se cuenta con base de datos descartable, ejecutar `npm run test:e2e`.
10. **Actualizar documentación:** si surgen nuevas variables de entorno o cambios de comportamiento, actualizar `AGENTS.md`, `README.md`, `.env.example` y `.devin/environment.yaml`.

## Verificaciones obligatorias

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | `npm run knip` | Detección de código muerto |
| 6 | `npx drizzle-kit check` | Consistencia del esquema (base de prueba) |
| 7 | `npm run test:e2e` | Tests E2E (solo base descartable) |

## Entregables esperados

1. Código modificado con los seis hallazgos resueltos.
2. Migraciones Drizzle generadas en `drizzle/` si aplica esquema.
3. Tests unitarios y/o E2E nuevos.
4. Actualización de `.devin/informes/reporte-estado.md` marcando los hallazgos como resueltos.
5. Si corresponde, actualización de `README.md`, `AGENTS.md` y `.env.example`.
