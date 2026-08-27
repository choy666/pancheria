# ARCHIVADO — Prompt: Arquitectura y buenas prácticas del flujo de pedidos, sucursales y stock

> **Estado: archivado.** El flujo de pedidos implementa reservas transaccionales (`in_process`) y conversión a venta (`paid`). El contexto vigente está en `.devin/informes/guia-funcionamiento-pancheria.md`. Se conserva como registro histórico.

## Contexto

Proyecto: `pancheria` — Sistema multi-sucursal de gestión de stock, ventas, caja y pedidos públicos por WhatsApp/chat.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5.

Este prompt documenta las decisiones arquitectónicas, las buenas prácticas y los puntos de atención del flujo de pedidos públicos y del panel de pedidos. Antes de tocar cualquiera de estos archivos, leer:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/cobertura-auditoria-flujo-pedidos-2026-08-27.md" />

> **Nota:** este prompt es una guía activa. Si detectás discrepancias con el código, seguir <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" /> para actualizar la documentación o el código según corresponda.

## Estado actual relevante

El flujo de pedidos públicos (`/pedido`) y la gestión en panel (`/pedidos`) están consolidados:

- Los pedidos `pending` **no reservan ni descuentan stock**; el stock se descuenta solo al confirmar la venta (`convertOrderToSale`).
- El carrito se invalida al cambiar de sucursal mediante `key={branchId}`, `clearCart()` y validación en `useCart`.
- La lógica compartida entre ventas y pedidos vive en `src/lib/product-helpers.ts`, `src/lib/sale-helpers.ts` y `src/lib/order-helpers.ts`.
- El catálogo público incluye chat por pedido; WhatsApp sigue siendo un fallback configurable.
- La expiración automática de pedidos `pending` se ejecuta en `GET /api/pedidos` y en listados del panel.

## Objetivo

Proveer una guía reutilizable para que cualquier modificación en el flujo de pedidos, la selección de sucursal, el carrito o el stock mantenga:

1. Aislamiento estricto por `branchId`.
2. Sin duplicación de lógica entre `orderService` y `saleService`.
3. SSR-safe y sin hydration mismatch en Client Components.
4. Stock consistente: validación inicial, descuento solo al confirmar, reintegro solo al anular venta.
5. Comportamiento estable en tests E2E con selectores `data-testid`.

## Reglas de negocio

1. **Los pedidos no reservan stock.** `createOrder` valida disponibilidad con `validateCartAvailability`, pero solo inserta `orders` e `order_items`.
2. **El stock se descuenta al confirmar la venta.** `convertOrderToSale` usa `deductStockForItems` con `movementType: 'sale'` dentro de una transacción.
3. **La cancelación de un pedido no modifica stock.** Como nunca se reservó, `cancelOrder` solo cambia el estado a `cancelled`.
4. **La anulación de una venta reintegra stock.** `cancelSale` usa `reintegrateStockAndUpdateCashRegister` con `movementType: 'cancellation'`.
5. **Los precios históricos de `order_items` se conservan.** `convertOrderToSale` pasa `unitPrice` y `subtotal` existentes a `buildSaleItemValues` para no recalcular desde el precio actual del producto.
6. **El cambio de sucursal invalida el carrito.** El cliente no puede llevar ítems de una sucursal a otra.
7. **Una caja abierta es requisito para confirmar pedido o venta.** Sin ella, ambas operaciones fallan con `ValidationError`.
8. **Los pedidos `pending` expiran automáticamente** después de `ORDER_EXPIRATION_MS` (1 hora por defecto, mínimo 1 minuto).
9. **El rate limit de creación de pedidos es por IP** y soporta almacenamiento en memoria o en PostgreSQL (`public_order_rate_limits`).

## Implementación detallada

### 1. Aislamiento por sucursal

- Tratar `branchId` como parte del estado de navegación, no solo de la sesión.
  - En `/pedido` la URL (`?branchId=<id>`) es la fuente de verdad.
  - En el panel (`/pedidos`, `/ventas`, etc.) la sucursal activa se obtiene de la sesión/cookie a través de `getCurrentBranchId(session)` o `getCurrentBranchIdOrRedirect()`.
- Cualquier Client Component que dependa de la sucursal debe recibirla como prop o reaccionar a su cambio.

#### Archivos clave

- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" /> valida y resuelve `branchId`, y envuelve la carga del catálogo en `Suspense` mediante el componente asíncrono `PedidoCatalog`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/page.tsx" /> obtiene la sucursal activa en el Server Component con `getCurrentBranchIdOrRedirect` y se la pasa a <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />.
- `PedidosList` envía `branchId` explícito en la query string de `GET /api/pedidos`; el endpoint valida contra la sucursal de sesión y rechaza accesos cruzados para operadores.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> recibe `activeBranch` e `initialProducts`; al cambiar de sucursal limpia el carrito y navega.

#### Invalidación del carrito al cambiar de sucursal

1. **Estado React:** `handleBranchChange` llama `clearCart()` antes de `router.push`.
2. **Remonte limpio:** `PedidoCatalog` renderiza `PedidoClient` con `key={branchId}`, por lo que React remonta el componente al cambiar de sucursal.
3. **Persistencia:** <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" /> valida `stored.data.branchId` en `getInitialItems` y descarta el carrito si no coincide. También usa `previousBranchIdRef` para reinicializar el carrito si `branchId` cambia en tiempo de ejecución.

### 2. Hydration y Client Components

#### Evitar hydration mismatch con `localStorage`

- No leer `localStorage` durante el render ni usarlo como estado inicial de `useState`.
- Inicializar el estado con un valor SSR-safe (arreglo vacío) y cargar el valor real en un `useEffect`.
- En <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" /> el carrito inicia vacío y se hidrata desde `localStorage` dentro de un `useEffect`. De ese modo `PedidoClient`, `ProductCard` y `CartSummary` reciben `items = []` tanto en el servidor como en el primer render del cliente.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" /> usa la prop `inCart` directamente para decidir entre `Agregar` y `Agregar otro`; no necesita `useSyncExternalStore` ni flags de montaje.

#### `setState` dentro de `useEffect`

El proyecto permite `setState` en efectos en dos casos concretos:

1. **Carga asíncrona con flag de montaje.** Usar `isMountedRef` o una bandera `cancelled` dentro del `useEffect`, retornar una función de cleanup que evite actualizaciones luego del desmontaje, y no llamar `setState` si el componente ya no está montado.
2. **Persistencia derivada.** Escribir en `localStorage` u otro almacenamiento local como consecuencia de un cambio de estado (por ejemplo, guardar el carrito cuando cambian los ítems).

Para **sincronizar props con estado**, preferir:

1. **Calcular valores directamente** en render si no necesitan mutar.
2. **Usar `key` para forzar remonte** cuando la prop define un nuevo contexto completo (como `branchId`).
3. **Levantar el estado al padre** si varios componentes comparten la misma fuente de verdad.

#### Ejemplos aplicados

- `PedidoClient` carga el catálogo asíncronamente en un `useEffect` con `isMountedRef` y actualiza `products` (carga inicial y refresco periódico); `activeBranch` se sincroniza vía `key={branchId}`, no por efecto.
- `useCart` inicia con un carrito vacío (SSR-safe), persiste el carrito en `localStorage` en un `useEffect` y lo hidrata en otro `useEffect` cuando cambia `branchId`.
- `ProductCard` usa la prop `inCart` directamente para mostrar `Agregar` o `Agregar otro`; el mismatch desaparece porque `useCart` no lee `localStorage` durante el render.

### 3. Consolidación de lógica de ventas y pedidos

#### Principio

`orderService.ts` y `saleService.ts` comparten validación de productos, cálculo de totales, inserción de venta, resumen de caja y manejo de stock. La lógica común debe vivir en helpers reutilizables y no duplicarse:

- `convertOrderToSale` no debe descontar stock dos veces.
- `confirmSale` no debe omitir validaciones de productos vendibles.

#### Helpers comunes

- <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" /> — `buildProductContext`, `validateProductsForOperation`, `validateCartAvailability`, `assertNoStockShortage`, `calculateAvailability`, `calculateAvailabilityForProductIds`.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" /> — `buildSaleItemValues`.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" /> — `generateOrderNumber`, `generateCancellationToken`, `buildOrderValues`, `buildOrderItemValues`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> — `deductStockForItems`, `reintegrateStockForItems`, `insertSaleAndUpdateCashRegister`, `updateCashRegisterSummary`, `buildReintegrationContext`, `reintegrateStockAndUpdateCashRegister`.
- `saleService.ts` re-exporta algunos helpers de `product-helpers.ts` y `sale-helpers.ts` para compatibilidad, pero la fuente de verdad son los archivos de `src/lib/`.

#### Semántica de disponibilidad

- En `/pedido` solo interesa la disponibilidad de los ítems del carrito.
- En `/ventas` el terminal necesita la disponibilidad de **todo el catálogo** para mostrar mensajes como "En este pedido: X más".
- Por eso `validateCartAvailability(branchId, items, productIds?)` recibe el parámetro opcional `productIds` para precalcular productos adicionales.

#### Precios históricos en la conversión de pedido

- `convertOrderToSale` recibe los ítems con `unitPrice` y `subtotal` almacenados en `order_items`.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" /> acepta `unitPrice` y `subtotal` opcionales; si están definidos, los conserva en lugar de recalcular desde el precio actual del producto.
- Esto evita desfasajes contables si el precio del producto cambia entre la creación del pedido y su confirmación.

### 4. Ciclo de vida del pedido

#### Creación

- Endpoint: <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />.
- Servicio: `orderService.createOrder` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />.
- Pasos:
  1. Validar rate limit por IP usando `createRateLimiter` y las variables `PUBLIC_ORDER_RATE_LIMIT_*`.
  2. Resolver `branchId` desde query string o sucursal por defecto.
  3. Validar disponibilidad con `validateCartAvailability`; no descontar stock.
  4. Insertar `orders` e `order_items` con `buildOrderValues` y `buildOrderItemValues`.
  5. Generar URL de WhatsApp con <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.ts" /> (`buildWhatsAppUrl`).
  6. Si no está configurado el número de WhatsApp, `whatsappUrl` es `null` y el chat pasa a ser el canal principal.

#### Confirmación como venta

- Endpoint: <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />.
- Servicio: `orderService.convertOrderToSale`.
- Pasos:
  1. Requerir sesión y sucursal activa (`getCurrentBranchId`).
  2. Requerir caja abierta (`cashRegisterService.getOpenCashRegister`).
  3. Validar que el pedido esté `pending` con lock pesimista (`findByIdForUpdate`).
  4. Revalidar productos y disponibilidad con `validateProductsForOperation` y `validateCartAvailability`.
  5. Descuenta stock con `deductStockForItems` (`movementType: 'sale'`).
  6. Inserta venta y actualiza resumen de caja con `insertSaleAndUpdateCashRegister`.
  7. Marca el pedido como `converted` y vincula `convertedSaleId`.

#### Cancelación

- Pública: `POST /api/public/pedido/[id]/cancelar` valida `cancellationToken`.
- Panel: el operador cancela desde `/pedidos/[id]/cancelar` sin token.
- Servicio: `orderService.cancelOrder`.
- No modifica stock. El pedido pasa a `cancelled`.

#### Expiración automática

- Servicio: `orderService.expirePendingOrders` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />.
- Configuración: <ref_file file="C:/developer/paginas/pancheria/src/config/orders.ts" /> (`getOrderExpirationMs`).
- Se invoca en `GET /api/pedidos` para limpiar pedidos viejos del listado.
- Debe tolerar carreras con la confirmación: si un pedido ya no está `pending`, se ignora y continúa con el resto.

### 5. Rate limiting

- Implementación: <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> (`createRateLimiter`).
- Configuración: <ref_file file="C:/developer/paginas/pancheria/src/config/orders.ts" />.
- Variables de entorno:
  - `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` (`memory` o `db`).
    - En `NODE_ENV=test` siempre es `memory`.
    - Si se define explícitamente `memory` o `db`, se respeta.
    - En producción (`NODE_ENV=production`) con `DATABASE_URL` o `POSTGRES_URL` definidos, el valor por defecto es `db`.
    - En cualquier otro caso, el valor por defecto es `memory`.
    - Usar `db` si se escala horizontalmente en Vercel con múltiples instancias.
  - `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` (por defecto 60000 ms).
  - `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS` (por defecto 10).
- En memoria usa un `Map` por proceso; en `db` usa la tabla `public_order_rate_limits`.

### 6. Chat de pedidos

- Cada pedido `pending` dispone de un chat entre cliente y operador.
- Página pública: `/pedido/[id]/chat?token=...`.
- Panel: el chat se renderiza dentro del detalle del pedido (`/pedidos/[id]`).
- Adjuntos: soportan `STORAGE_PROVIDER=local`, `vercel-blob`, `s3` y `r2` a través de `src/lib/chat-storage.ts`.
- WhatsApp sigue disponible como fallback cuando `NEXT_PUBLIC_WHATSAPP_NUMBER` está configurado.
- Para extender canales de chat, reutilizar `src/lib/rate-limit.ts` con un scope propio (por ejemplo, `chat:`) en lugar de crear un nuevo sistema de rate limit.

## Tests y cobertura

### Selectores estables

- Preferir `data-testid` sobre selectores de estructura (`locator('..')`, `getByRole` con textos dinámicos, etc.).
- Ejemplos del flujo de pedidos:
  - `data-testid={`product-card-${product.id}`}` en `ProductCard`.
  - `data-testid={`add-product-${product.id}`}` en el botón.
  - `data-testid={`cart-item-${item.id}`}` en `CartSummary`.
  - `data-testid="branch-select-trigger"` en el selector de sucursal.
  - `data-testid={`row-order-${order.id}`}` en el listado del panel.

### Iteración rápida con E2E

- Correr tests enfocados antes de la corrida completa:

```bash
npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts
```

### Documentar tests preexistentes fallidos

- Si una corrida completa deja fallos que parecen preexistentes (seed duplicado, datos residuales, selectores ambiguos), anotarlos en <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> o en un issue.
- Esto evita que se confundan con regresiones del flujo de pedidos.

## Seguridad y configuración

- No hardcodear credenciales, URLs de API ni nombres de sucursal.
- Las variables sensibles deben provenir de `.env.local` o de variables de entorno.
- Variables de entorno relacionadas con pedidos:
  - `NEXT_PUBLIC_WHATSAPP_NUMBER` — requerido para WhatsApp; sin él el chat es el canal principal.
  - `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` y `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` — saludo y cierre del mensaje.
  - `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` — refresco del catálogo público (por defecto 30000 ms).
  - `ORDER_EXPIRATION_MS` — expiración de pedidos `pending` (por defecto 3600000 ms, mínimo 60000 ms).
  - `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`, `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`.
  - `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS`, `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS`, `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS`, `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB`, `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES`.
- `DATABASE_URL` de producción debe apuntar a Neon/Vercel Postgres, no a `localhost`, para que el seed y las migraciones se comporten igual que en desarrollo.
- Ejecutar `npm run test:e2e` y `npx tsx src/db/seeds.ts` solo en base de datos de prueba.

## Proceso de cambios futuros

### Antes de modificar

1. Consultar `AGENTS.md`, `lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md`, `rchivados/cobertura-auditoria-flujo-pedidos-2026-08-27.md (archivado)` y este prompt.
2. Identificar si la lógica afectada está duplicada entre `orderService` y `saleService`.
3. Revisar si `validateCartAvailability`, `buildSaleItemValues`, `buildProductContext` o `buildOrderValues` cambian de firma; de ser así, actualizar consumidores y tests.
4. Considerar el impacto en el chat y en los adjuntos si se tocan endpoints de pedidos.

### Verificaciones inmediatas

Después de editar servicios, hooks o componentes del flujo de pedidos, correr:

```bash
npx tsc --noEmit
npm run lint
npm test
```

Antes de `npm test`. Los errores de tipo por cambios de firma aparecen más rápido y evitan tests con mocks inconsistentes.

Para cambios de UI/flujo:

```bash
npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts
```

### Limpieza del árbol de trabajo

- No commitear cambios en prompts o documentación que no correspondan a la tarea.
- Si un prompt fue archivado o reemplazado, resolver el estado en un commit separado.
- No commitear `.env.local`.

## Verificaciones mínimas

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y reglas de React Hooks |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts` | Tests E2E enfocados del flujo de pedidos |
| `npm run test:e2e` | Tests E2E completos en base de prueba |

## Relación con otros prompts e informes

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/cobertura-auditoria-flujo-pedidos-2026-08-27.md" /> — flujo vigente, limpieza realizada, pendientes y decisiones que no deben revertirse.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> — guía operativa del negocio: multi-sucursal, stock, caja, pedidos.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> — lecciones transversales de auditorías anteriores.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" /> — estado verificado del proyecto y recomendaciones vigentes.

## Resumen

La arquitectura de pedidos quedó cohesionada al:

- Aislar catálogo, carrito y pedidos por `branchId`.
- Limitar `setState` en efectos a carga asíncrona con flag de montaje y persistencia derivada; evitarlo para sincronización de props con estado.
- Reutilizar helpers entre `orderService` y `saleService` desde `src/lib/product-helpers.ts`, `src/lib/sale-helpers.ts` y `src/lib/order-helpers.ts`.
- Preservar precios históricos al convertir un pedido en venta.
- No descontar stock hasta la confirmación; no reintegrar stock al cancelar un pedido.
- Agregar `data-testid` estables para E2E.
- Documentar decisiones en `lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md` y `rchivados/cobertura-auditoria-flujo-pedidos-2026-08-27.md (archivado)`.

El próximo paso recomendado es mantener este prompt sincronizado con el código y ejecutar las verificaciones mínimas antes de cualquier cambio en el flujo de pedidos.
