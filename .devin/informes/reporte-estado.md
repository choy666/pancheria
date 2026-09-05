# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-04  
**Proyecto:** `pancheria`  
**Baseline:** `940d8a055f10d2170ad177b8f226666c140b6376` (branch `main`)  
**Auditoría:** Masiva integral — 9 áreas  
**Histórico:** Fases anteriores en `.devin/informes/archivados/reporte-estado-historico-2026-08-30.md`

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo y estable para el baseline actual. Las verificaciones base (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`) pasan correctamente. La suite de tests unitarios alcanza **139 suites y 1326 tests**; la suite E2E pasa a **108 tests en 33 specs** con la adición del cierre diario (`cierres-diarios.spec.ts`) y la eliminación real de sucursales (`sucursal-eliminacion.spec.ts`). La ejecución de `npm run test:e2e` (equivalente a `npx playwright test`) pasó con **107 tests ok y 1 flaky preexistente**.

En esta sesión se completó la auditoría masiva de las 9 áreas, se aplicaron correcciones de seguridad sobre endpoints públicos, rate limiting, cron jobs, adjuntos y validación de productos eliminados, y se detectaron riesgos adicionales de concurrencia e integridad de datos que requieren acción posterior. Además se aplicaron correcciones documentales y de consistencia: se unificó `COMMON_BILLS` con `DEFAULT_DENOMINATIONS` en `payment-parts-input.tsx`, se documentaron las variables de dirección/teléfono/ubicación de sucursales y `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` en `README.md`, `AGENTS.md` y `.devin/environment.yaml`, y se sincronizó `.devin/prompts/README.md` con los prompts archivados faltantes.

Hallazgos críticos resueltos o mitigados en esta sesión:

- Tracking público ya no expone `cancellationToken` ni datos del pedido si no se proporciona `customerName` o `customerPhone`.
- Rate limiting endurece la resolución de IP confiable y rechaza IPs vacías en producción.
- Cron jobs comparan `CRON_SECRET` con `crypto.timingSafeEqual`.
- Adjuntos de chat autenticados usan `Cache-Control` privado y sin cache compartida.
- El upload de adjuntos de chat limpia el archivo si `sendClientMessage` falla por token inválido.
- `recipeRepository.assertProductInBranch` filtra productos `deletedAt`.
- `cancelSale` es idempotente y transaccional: bloquea la venta con `FOR UPDATE`, reintegra stock y actualiza la caja dentro de una sola transacción.
- `confirmSale` y `convertOrderToSale` bloquean los insumos críticos con `FOR UPDATE` antes de validar disponibilidad y descontar stock.
- `validateCartAvailability` resta reservas activas de `in_process` del stock efectivo.
- `receiveOrder` bloquea productos antes de validar disponibilidad.
- `receiveOrder` ya no reescribe `orderItemRecipes`; preserva el snapshot histórico del pedido y solo computa recetas en memoria si el item no tenía snapshot.
- `cashRegisterRepository.hardDelete` y `hardDeleteAllDeletedInRange` no borran cajas con ventas asociadas, preservando el vínculo histórico.
- `/api/panel/resumen` ya no ejecuta `expirePendingOrders` ni dispara 5 consultas `getOrders` con `limit:1`; ahora usa `orderService.getOrderCountsByStatus` y la expiración corre en el cron `/api/cron/expire-orders`.
- Se agregaron tests unitarios de rutas críticas: `recibir`, `finalizar`, `public/sucursal/estado`, imágenes de productos (`[key]`, `preparar`, `upload`) y `orderStockReservationRepository`.
- Se agregó el spec E2E `ventas-pago-mixto.spec.ts` para validar pagos mixtos (`cash + transfer`) de extremo a extremo.
- Se documentaron `E2E_ENABLE_RATE_LIMIT` y `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` en `.env.example`, `README.md`, `AGENTS.md` y `.devin/environment.yaml`, y se conectó el intervalo del dashboard a `src/config/dashboard.ts`.

Hallazgos críticos aún abiertos:

- Resuelto en tarea #5: `createOrder` ahora reserva stock inmediatamente. Quedan abiertas las tareas #17 (CSP sin `unsafe-inline`/`unsafe-eval`) y #18 (`axe-core` / Lighthouse en CI).

Otros hallazgos relevantes:

- `npm run analyze` completa el build bajo Turbopack, pero `@next/bundle-analyzer` no genera el HTML del reporte. Se agregó una nota en `next.config.ts` indicando que se requiere `next build --webpack` para el análisis completo.
- El intervalo de refresco del dashboard ya no está hardcodeado; se lee desde `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` vía `src/config/dashboard.ts`.
- El endpoint `/api/panel/resumen` realiza 5 consultas pesadas de pedidos solo para contar y ejecuta la expiración de pedidos `pending` dentro del request.
- Se cerraron los gaps de cierre diario (`cierres-diarios.spec.ts`) y eliminación real de sucursales (`sucursal-eliminacion.spec.ts`) en E2E. Quedan pendientes los items #17 y #18 del plan.
- `getClientIp` en `src/lib/rate-limit.ts` devuelve `'unknown'` cuando no puede resolver una IP confiable en producción, lo que agrupa todo el tráfico bajo la misma clave de rate limit. Recomendación: requerir un header de proxy confiable o rechazar explícitamente el rate limit para IPs no resolubles.
- `payment-parts-input.tsx` usaba `COMMON_BILLS` fijos (`[1000,...,50000]`) inconsistentes con `DEFAULT_DENOMINATIONS`. **Corregido** en esta sesión: los botones de billetes ahora usan `DEFAULT_DENOMINATIONS`.

No se recomienda liberar a producción acciones correctivas de código complejas en esta iteración; el plan de acción prioriza cierre de brechas de seguridad restantes, cobertura de tests y las correcciones de concurrencia/integridad identificadas.

## 2. Stack y arquitectura

- Next.js `16.3.3` (App Router + Turbopack) <ref_file file="C:/developer/paginas/pancheria/package.json" />
- React `19.2.8`
- TypeScript `5.x`
- Tailwind CSS `4`
- shadcn/ui
- Drizzle ORM `0.45.2`
- PostgreSQL (Neon / `pg`)
- NextAuth v5 (`5.0.0-beta.32`)
- Jest `30.x`
- Playwright `1.62.x`
- Vercel (despliegue recomendado)

La arquitectura mantiene la separación por capas: `src/app/` (UI y API), `src/application/` (servicios/casos de uso), `src/repositories/` (acceso a datos), `src/lib/` (utilidades transversales), `src/config/` (configuración con getters de variables de entorno), `src/domain/` (tipos y errores) y `src/db/` (esquema y seeds). <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja, pedidos por estado, alertas de stock, accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock y chat integrado.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público; snapshots de receta en `sale_item_recipes` y `order_item_recipes`.
- **Stock y caja**: movimientos con razones, cierre automático, cierres diarios históricos, soft delete de cajas.
- **Chat de pedidos**: texto e imágenes, paginación con cursores, polling y estados de entrega/lectura.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **139 suites, 1326 tests pasan** |
| `npm run build` | Build exitoso, 44 rutas/páginas |
| `npm run knip` | Pasa |
| `npm run analyze` | Build exitoso, **pero no genera reporte de bundle bajo Turbopack** (ver Hallazgo 5.6) |
| `npx drizzle-kit check` | No ejecutado (requiere base de datos de prueba) |
| `npx playwright test` | **108 tests en 33 archivos; 107 passed, 1 flaky preexistente (`tour.spec.ts`)** |

## 5. Hallazgos de la auditoría por área

A continuación se clasifican los hallazgos en **crítico**, **mayor**, **menor** o **informativo**, con evidencia concreta.

### 5.1 Calidad de código y consistencia

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Verificaciones base (`lint`, `tsc`, `test`, `build`, `knip`) pasan | OK | Ver sección 4 |
| `src/lib/utils.ts` contiene únicamente `cn` | OK | <ref_file file="C:/developer/paginas/pancheria/src/lib/utils.ts" /> |
| `throw new Error` en hooks y componentes de cliente sin boundary explícita | Menor | Hooks como `useDashboard.ts` y componentes como `usePedidoClient.ts` lanzan errores de fetch directamente. No se detecta `Error Boundary` global; los tests cubren caminos controlados, pero un error de red puede propagarse. <ref_snippet file="C:/developer/paginas/pancheria/src/hooks/useDashboard.ts" lines="36-39" /> |

### 5.2 Seguridad

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| No se detectaron credenciales/secretos hardcodeados en `src/` | OK | Búsquedas por `ADMIN_`, `SECRET`, `TOKEN`, `PASSWORD` solo arrojan lecturas de `process.env.*` y tests. |
| Autenticación y autorización por rol y `branchId` | OK | `withAuth` inyecta `branchId`; `admin` puede cambiar de sucursal; `operator` está restringido. <ref_file file="C:/developer/paginas/pancheria/src/lib/with-auth.ts" /> |
| Rate limit en endpoints públicos | OK | `createRateLimiter` protege pedidos y chat; `PUBLIC_ORDER_RATE_LIMIT_*` soporta `memory` y `db`. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| CSP y headers de seguridad | OK | `next.config.ts` define CSP, HSTS en producción, X-Frame-Options, etc. <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> |
| Cron jobs protegidos por `CRON_SECRET` | OK | <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/rate-limit-cleanup/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/chat-attachments-cleanup/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/expire-orders/route.ts" />. Comparación constante con `crypto.timingSafeEqual`. |
| `getClientIp` devuelve `'unknown'` si no hay header confiable en producción | Mayor | Si no está en Vercel ni se configura `TRUSTED_PROXY_IP_HEADER`, toda la producción comparte la misma clave de rate limit. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| Tracking público expone `cancellationToken` sin identificación del cliente | Crítico | `trackOrder` devolvía el token cuando se consultaba solo con `orderNumber`. **Corregido**: se exige `customerName` o `customerPhone` para devolver datos del pedido. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="789-797" /> |
| `getClientIp` permite spoofing y acepta IPs vacías | Mayor | `rate-limit.ts` tomaba el primer valor de `X-Forwarded-For` y devolvía `unknown`. **Corregido**: validación de `TRUSTED_PROXY_IP_HEADER`, descarte de valores privados/vacíos, uso del último `X-Forwarded-For` cuando está configurado, y `unknown` solo en desarrollo. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| Cache pública de adjuntos de chat autenticados | Mayor | `Cache-Control: public, max-age=86400` en `src/app/api/chat/attachment/[key]/route.ts` permitía cachear en proxies compartidos. **Corregido**: política privada y `no-store` / `must-revalidate`. <ref_file file="C:/developer/paginas/pancheria/src/app/api/chat/attachment/[key]/route.ts" /> |
| Upload de adjuntos guardaba archivo antes de validar token | Mayor | `sendClientMessage` validaba el token después de `saveChatAttachment`. **Corregido**: limpieza del adjunto en el `catch` si el envío falla. <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/upload/route.ts" /> |
| Comparación directa de `CRON_SECRET` | Mayor | Los cron jobs usaban `authHeader !== expected`. **Corregido**: comparación constante con `crypto.timingSafeEqual`. <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/rate-limit-cleanup/route.ts" /> |
| Productos eliminados aceptados como insumos de receta | Mayor | `recipeRepository.assertProductInBranch` no filtraba `deletedAt`. **Corregido**: agregado `isNull(products.deletedAt)`. <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" /> |
| `public/pedido` aplicaba rate limit después de parsear el body | Menor | `branchId` se obtenía del body antes del rate limit. **Corregido**: rate limit antes del parseo. <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" /> |
| Hostnames de storage hardcodeados | Informativo | `next.config.ts` y `src/lib/storage.ts` construyen orígenes oficiales de Vercel Blob, S3 y R2. Aunque son endpoints públicos oficiales, la política estricta del proyecto recomienda evitar hardcodeos. <ref_snippet file="C:/developer/paginas/pancheria/src/lib/storage.ts" lines="187-199" /> |

### 5.3 Arquitectura y deuda técnica

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Separación de capas | OK | Capas `app/`, `application/`, `repositories/`, `lib/`, `config/`, `domain/` respetadas. |
| Soft vs hard delete | OK | Productos, videos y cajas usan `deletedAt`/`isActive`; hard delete libera archivos en `productService.permanentlyDeleteProduct`, `videoService.permanentlyDeleteVideo` y `branchService.deleteBranch`. |
| `findFirst` con orden/unicidad | OK | La mayoría de `findFirst` filtra por `id` o campos únicos (`users.username`, índice único parcial `cash_registers_open_status_idx`). El caso de apertura de caja está cubierto por constraint de BD. |
| Duplicación de lógica entre ventas/pedidos | OK | `validateProductsForOperation`, `buildSaleItemValues` e `insertSaleAndUpdateCashRegister` se comparten según lecciones aprendidas. <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" /> |
| Variables de entorno centralizadas en `src/config/*` | OK | `caja.ts`, `chat.ts`, `catalog.ts`, `orders.ts`, `payments.ts`, `product-images.ts`, `videos.ts` exponen getters con defaults. |
| `process.env` disperso en helpers operacionales | Mayor | `src/lib/storage.ts`, `src/lib/chat-storage.ts`, `src/lib/product-image-storage.ts`, `src/lib/rate-limit.ts`, `src/lib/public-order-rate-limit-store.ts`, `src/lib/rate-limit-store.ts`, `src/lib/branch-helpers.ts`, `src/lib/branch-resolver.ts` y `src/lib/public-url.ts` leen variables directamente. Dificulta tests y simulación de entornos. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| Capas mezcladas: servicios y helpers acceden directamente al esquema Drizzle | Mayor | `saleService.ts`, `orderService.ts` y `product-helpers.ts` importan e insertan/actualizan tablas directamente. `product-helpers.ts` además depende de `application/services/summaryService`. <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" /> |
| Duplicación de lógica entre `confirmSale`, `convertOrderToSale` y `createOrder` | Mayor | Los tres flujos repiten `buildProductContext`, `validateCartAvailability`, `assertNoStockShortage` y `buildSaleItemValues`. Recomendación: extraer un `prepareCart()` común. <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> |
| `deleteBranch` elimina físicamente sin archivo ni bloqueo | Mayor | `branchService.deleteBranch` borra todas las tablas de negocio y archivos sin soft delete ni `SELECT ... FOR UPDATE`. <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" /> |
| Funciones críticas son largas y con múltiples responsabilidades | Menor | `insertSaleAndUpdateCashRegister`, `confirmSale`, `convertOrderToSale`, `createOrder`, `receiveOrder`, `validateCartAvailability` y `deleteBranch` exceden la longitud recomendable. <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> |
| Capa `domain` subutilizada | Informativo | Solo existen tipos y errores; faltan value objects (`Stock`, `Payment`, `Order`). <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> |

### 5.4 Cobertura de pruebas

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Unitarios: 133 suites / 1246 tests | OK | `npm test` |
| E2E: 31 specs / 105 tests listados | OK | <ref_file file="C:/developer/paginas/pancheria/tests/e2e" /> |
| Cobertura de rutas API | OK | 50 rutas `src/app/api/**/route.ts` con 50 `route.test.ts` asociados. |
| Cobertura de servicios y repositorios | OK | 13 servicios y 10 repositorios cuentan con test unitario. |
| Cobertura de rutas críticas | OK | Se agregaron `route.test.ts` para `recibir`, `finalizar`, imágenes de productos (`[key]`, `preparar`, `upload`) y `public/sucursal/estado`. |
| `orderStockReservationRepository.ts` | OK | Se agregó `src/repositories/orderStockReservationRepository.test.ts`. |
| Helpers de `src/lib/` sin test unitario | Menor/Mayor | `availability-helpers.ts`, `cart-helpers.ts`, `last-customer-name.ts`, `last-customer-phone.ts`, `logger.ts`, `pagination.ts`, `product-image-upload-client.ts`, `product-style.ts`, `validation-helpers.ts`, `ventas-helpers.ts`, `with-auth.ts`. Los de lógica de negocio (`cart-helpers`, `availability-helpers`, `ventas-helpers`, `validation-helpers`, `product-image-upload-client`) tienen mayor impacto. |
| Flujos E2E: pagos mixtos reales, eliminación real de sucursal, cierres diarios | Mayor | Pago mixto **Hecho** (`ventas-pago-mixto.spec.ts`). Cierres diarios **Hecho** (`cierres-diarios.spec.ts`). Eliminación real de sucursal **Hecho** (`sucursal-eliminacion.spec.ts`). |
| Componentes críticos de UI sin test unitario | Menor | Gran parte de los componentes del panel, productos, ventas, videos y sucursales no tienen `.test.tsx`; se recorren por E2E. |

### 5.5 Documentación y variables de entorno

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Variables principales sincronizadas con `.env.example` | OK | `DATABASE_URL`, `NEXTAUTH_*`, `ADMIN_*`, `NEXT_PUBLIC_*`, `STORAGE_*`, etc. |
| `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` expuesta y conectada | OK | Se agregó `src/config/dashboard.ts` y se conectó a `useDashboard.ts`. Documentada en `.env.example`, `README.md`, `AGENTS.md` y `.devin/environment.yaml`. |
| `E2E_ENABLE_RATE_LIMIT` documentada | OK | Documentada en `.env.example`, `README.md`, `AGENTS.md` y `.devin/environment.yaml`. |
| `ANALYZE` no documentada en `.env.example` | Menor | Se usa en `package.json` y `next.config.ts`. **Corregido** en `.env.example`. |
| `NO_WEB_SERVER` / `NO_GLOBAL_SETUP` no documentadas en `.env.e2e.example` | Menor | Aparecen en `.devin/environment.yaml` pero no en el template E2E. **Corregido** en `.env.e2e.example`. | 
| `NEXT_PUBLIC_WHATSAPP_NUMBER` no documentada en `.env.e2e.example` | Menor | Obligatoria para el flujo de pedidos. **Corregido** en `.env.e2e.example`. |
| Variables de dirección/teléfono/ubicación de sucursales no documentadas en `AGENTS.md` / `README.md` | Menor | **Corregido** en esta sesión: agregadas a `AGENTS.md`, `README.md` y `.devin/environment.yaml`. |
| `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` no documentada en `README.md` | Menor | **Corregido** en esta sesión: agregada a `README.md` y `.devin/environment.yaml`. <ref_file file="C:/developer/paginas/pancheria/src/config/payments.ts" /> |
| Prompts archivados no reflejados en `.devin/prompts/README.md` | Menor | **Corregido** en esta sesión: se agregaron `cobertura-auditoria-flujo-pedidos-2026-08-27.md`, `plan-mejoras-flujo-pedidos-chat-caja-sucursales-2026-08-27.md` y `recomendaciones-pedidos-sucursal-stock-2026-08-27.md` al índice. |
| Versión de Node inconsistente entre docs y CI | Informativo | `README.md`, `AGENTS.md` y `.devin/environment.yaml` indican Node 20; CI usa `node-version: 22`. Se agregó `engines` a `package.json` (`>=20`). |

### 5.6 Rendimiento y bundle

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Páginas públicas críticas con `dynamic = 'force-dynamic'` | OK | `/pedido`, `/pedido/[id]/chat`, `/api/public/*`, `/api/panel/resumen`, etc. <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" /> |
| `optimizePackageImports` habilitado | OK | `lucide-react` y `date-fns` en `next.config.ts`. |
| `npm run analyze` bajo Turbopack | OK / Limitación conocida | El build termina, pero `@next/bundle-analyzer` no genera el HTML del reporte. Se documentó en `next.config.ts` que se requiere `next build --webpack` para el análisis completo. |
| `/api/panel/resumen` consulta conteos de pedidos | OK | Se reemplazaron las 5 llamadas `getOrders(..., limit:1)` por `orderService.getOrderCountsByStatus(branchId)`, que agrupa en una sola consulta SQL. |
| Expiración de pedidos `pending` | OK | Ya no corre en el request de `/api/panel/resumen`; se movió al cron `/api/cron/expire-orders` (`*/5 * * * *`), protegido por `CRON_SECRET`. |
| Intervalo de refresco del panel hardcodeado | OK | Se lee desde `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` con fallback de 30000 ms. |
| `orderRepository.findOrders` carga relaciones completas en listado paginado | Menor | <ref_snippet file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" lines="188-206" />. El listado solo requiere nombres y cantidades. |
| Polling del catálogo público sin pausar al ocultar pestaña | Menor | `usePedidoClient.ts` no escucha `visibilitychange`; el intervalo sigue corriendo con la pestaña oculta. <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" lines="233-255" /> |
| Imágenes del catálogo público usan `<img>` nativo sin optimización | Menor | `product-card.tsx` usa `<img>` sin `srcset` ni `next/image`. <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" lines="106-116" /> |
| Vista previa de videos de hasta 100 MB | Menor | `video-form.tsx` crea `URL.createObjectURL(file)` para archivos grandes. <ref_snippet file="C:/developer/paginas/pancheria/src/components/videos/video-form.tsx" lines="363-374" /> |
| Terminal de ventas envía todos los IDs del catálogo en cada cambio de carrito | Menor | `sales-terminal.tsx` postea `productIds: products.map(...)` al calcular disponibilidad. <ref_snippet file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" lines="109-140" /> |

### 5.7 Accesibilidad y UX

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Uso de atributos ARIA en componentes críticos | OK | `aria-label`, `aria-pressed`, `aria-live`, `aria-expanded` presentes en carrito, pagos, chat, selector de sucursal, paginación, etc. <ref_file file="C:/developer/paginas/pancheria/src/components" /> |
| Estados de carga/error/vacío | OK | Componentes testeados (`stock-list`, `caja-history`, `chat-message-list`) manejan estados. |
| Tour interactivo adaptativo | OK | `tour-context.tsx` filtra pasos por rol (`admin`/`operator`) y usa `data-tour` / `skipMissingElement`. <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" /> |
| Botón de visibilidad de contraseña excluido del tab order | Mayor | `user-form.tsx` usa `tabIndex={-1}` en el `Button` de mostrar/ocultar, pese a ser interactivo. **Corregido** en esta sesión. <ref_snippet file="C:/developer/paginas/pancheria/src/components/usuarios/user-form.tsx" lines="111-121" /> |
| Label del input de archivo del chat sin nombre accesible | Mayor | `chat-composer.tsx` tiene un `<label>` que solo contiene un icono. **Corregido** agregando `aria-label` y `aria-hidden` en el icono. <ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" lines="75-81" /> |
| Error de checkout no se anuncia como alerta | Menor | `pedido-customer-form.tsx` no usa `role="alert"` en el mensaje de error. **Corregido**. <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-customer-form.tsx" lines="47-53" /> |
| Denominaciones rápidas inconsistentes | Menor | `payment-parts-input.tsx` usaba `COMMON_BILLS` fijos `[1000,...,50000]`, mientras `payments.ts` lee `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` con default `[1000,...,20000]`. **Corregido** en esta sesión: los botones de billetes usan `DEFAULT_DENOMINATIONS`. <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" /> |
| Botones de denominación rápida por debajo de 44×44 px en móvil | Menor | `payment-parts-input.tsx` usa `h-7 px-1.5` (28 px de alto). |
| Chat no pausa polling al ocultar pestaña | Menor | `useOrderChat.ts` sigue refrescando en segundo plano. <ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" lines="422-446" /> |
| Fallback de imagen de producto oculta el elemento sin alternativa | Menor | `product-card.tsx` pone `display: none` en `onError`. |
| Auditoría automática de accesibilidad | Informativo | No se detecta uso de `axe-core` ni Lighthouse en CI; se recomienda agregar como mejora futura. |

### 5.8 Integridad de datos y flujos de negocio

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Constraints de stock no negativo | OK | `CHECK (stock >= 0)`, `CHECK (min_stock >= 0)` en `products`. <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> |
| Snapshots de recetas | OK | `sale_item_recipes` y `order_item_recipes` persisten el estado de recetas en cada venta/pedido; `receiveOrder` ya no reescribe `order_item_recipes`, preservando el snapshot original. |
| Soft delete sin liberar archivos; hard delete sí | OK | Implementado en productos, videos y sucursales. |
| Expiración de pedidos `pending` | OK | `ORDER_EXPIRATION_MS`; la expiración no libera stock porque no reservó. |
| Pagos mixtos | OK | Tabla `sale_payments`, soporte en ventas y confirmación de pedidos. |
| Cierre automático de cajas | OK | `CAJA_AUTO_CLOSE_HOURS` y `CAJA_AUTO_CLOSED_BY`. |
| `cancelSale` transaccional e idempotente | OK | La venta se bloquea con `FOR UPDATE`, se valida `status='active'` y la cancelación completa corre dentro de `executeInTransaction`. Segundo intento sobre una venta ya cancelada no reintegra stock ni afecta caja. |
| `confirmSale` y `convertOrderToSale` bloquean insumos antes de validar | OK | Se agregó `SELECT ... FOR UPDATE` de insumos críticos (`compound` y `beverage`) inmediatamente después de `buildProductContext` y antes de `validateCartAvailability`, reduciendo el riesgo de sobreventa entre validación y descuento. |
| Hard delete de caja | OK / Limitación conocida | `cashRegisterRepository.hardDelete` y `hardDeleteAllDeletedInRange` verifican `count(sales.cashRegisterId)` y rechazan el borrado si existen ventas asociadas. Si el modelo de negocio cambia y se permite borrar cajas con ventas, se requeriría una estrategia de archivado en lugar de `SET NULL`. |
| `createOrder` no reserva stock: overselling de pedidos `pending` | Crítico / Mitigado | `createOrder` valida disponibilidad sin insertar reservas. `validateCartAvailability` ahora resta reservas activas y `confirmSale`/`convertOrderToSale`/`receiveOrder` bloquean stock con `FOR UPDATE`, por lo que la sobreventa real se evita al confirmar/recibir. El riesgo residual es puramente semántico: dos pedidos `pending` pueden "comprometer" stock disponible al crear, pero solo uno llegará a `in_process`. Decisión pendiente: reservar stock al crear o documentar la semántica. |
| `receiveOrder` preserva snapshots de recetas | OK | Ya no elimina ni reinserta `orderItemRecipes`; conserva el snapshot original del pedido y solo computa en memoria cuando el item no tiene snapshot. <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| `findFirst` y `SELECT ... FOR UPDATE` sin orden determinista | Menor | `cashRegisterRepository.findOpen`, `orderRepository.findByOrderNumberAndCustomer`, `productRepository.findByIdsForUpdate` y `deductStockForItems` no usan `orderBy`. Riesgo de no-determinismo y deadlocks. <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" /> |
| `createOrder` no es idempotente ante concurrencia | Menor | `getOrderByIdempotencyKey` se consulta fuera de la transacción y `insertOrder` no usa `onConflictDoNothing`. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="211-216" /> |
| `calculateCompoundAvailability` devuelve 0 si no hay insumos críticos | Menor | Un `compound` con recetas solo opcionales (`autoDiscount: false`) queda con disponibilidad 0. Los tests asumen este comportamiento, pero conviene documentar la regla de negocio. <ref_file file="C:/developer/paginas/pancheria/src/lib/availability-helpers.ts" /> |
| `expirePendingOrders` | OK | Ahora se ejecuta en el cron `/api/cron/expire-orders` cada 5 minutos; ya no depende del polling del panel. <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/expire-orders/route.ts" /> |
| Manejo de centavos inconsistente en pagos | Menor | `parsePaymentAmount` redondea con `Math.round`; `validatePaymentParts` compara con `Math.round`. Recomendación: aritmética entera de centavos. <ref_file file="C:/developer/paginas/pancheria/src/lib/payment-helpers.ts" /> |

### 5.9 Configuración de despliegue, CI/CD y entornos

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| `.github/workflows/ci.yml` completo | OK | Lint, tipos, unit tests, build, knip, E2E. Verifica secretos requeridos. <ref_file file="C:/developer/paginas/pancheria/.github/workflows/ci.yml" /> |
| `playwright.config.ts` | OK | Carga `.env.local` y `.env.e2e`, health check a `/api/caja/resumen`, pasa variables de rate limit. <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" /> |
| `vercel.json` con cron jobs | OK | Limpieza de rate limits y adjuntos de chat diariamente. |
| `next.config.ts` con headers y CSP | OK | CSP con `unsafe-inline`/`unsafe-eval` (ver Recomendación 7). <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> |
| `.env.local` y `.env.e2e` no commiteados | OK | `.gitignore` los excluye. |
| `package.json` sin campo `engines` | Menor | CI usa Node 22; docs dicen 20; sin `engines` no se forzaba versión. **Corregido** agregando `engines: { "node": ">=20" }`. |
| `analyze` no genera reporte bajo Turbopack | Menor | Ver Hallazgo 6.1. |

## 6. Últimas resoluciones (desde el baseline previo)

| Hallazgo | Clasificación original | Acción aplicada |
|---|---|---|
| `productService.deleteProduct` borraba imagen y recetas durante el soft delete | Mayor | Se corrigió: soft delete solo marca `deletedAt` e `isActive`; la imagen y recetas se conservan y se liberan solo en hard delete. |
| No existía hard delete individual con liberación de archivos para productos y videos | Mayor | Se agregaron `productRepository.hardDelete`, `productService.permanentlyDeleteProduct`, `videoRepository.hardDelete` y `videoService.permanentlyDeleteVideo`. |
| No había UI de papelera para productos y videos | Mayor | Se agregaron `/productos/eliminados` y `/videos/eliminados`. |
| Cachés en memoria de rate limit no se limpiaban al eliminar usuarios/sucursales | Menor | Se agregó `remove` a `RateLimitStore` y su uso en `userService.deleteUser` y `branchService.deleteBranch`. |
| `InMemoryPublicOrderRateLimitStore` acumulaba registros expirados | Menor | Se invoca `cleanupExpired` periódicamente en `recordRequest`. |
| `VideoList` eliminaba/restauraba videos sin confirmación | Menor | Se agregó `ConfirmDialog` en `video-list.tsx`. |
| `deleteByCompoundProductId` en `recipeRepository` sin uso | Menor | Se eliminó la función y su test. |
| Tests E2E de caja y rate limit | Mayor | Suite E2E pasa con variables `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`, `TRUSTED_PROXY_IP_HEADER`, etc. |
| Pedidos con múltiples líneas del mismo producto personalizado | Mayor | Se corrigieron keys duplicadas y resumen de recetas por línea; suite E2E: 104 passed. |
| `deleteBranch` no limpiaba pedidos/videos/archivos asociados | Mayor | Se corrigió cascada completa incluyendo archivos `local`, `vercel-blob`, `s3` y `r2`. |
| `localStorage` conservaba datos de sucursales eliminadas | Mayor | `usePedidoClient` detecta sucursal inexistente y limpia claves. |
| Tests E2E de stock en promos y vaciado masivo de papelera | Menor | Agregados en `productos-y-recetas.spec.ts`. |
| Tracking público exponía `cancellationToken` sin identificación del cliente | Crítico | `trackOrder` ahora exige `customerName` o `customerPhone` para devolver datos del pedido. |
| `getClientIp` permitía spoofing y aceptaba IPs vacías | Mayor | `src/lib/rate-limit.ts` valida `TRUSTED_PROXY_IP_HEADER`, descarta privados y usa el último `X-Forwarded-For` cuando está configurado. |
| Adjuntos de chat cacheados públicamente | Mayor | `src/app/api/chat/attachment/[key]/route.ts` usa `Cache-Control` privado y sin cache compartida. |
| Upload de adjuntos guardaba antes de validar token | Mayor | `src/app/api/public/pedido/[id]/chat/upload/route.ts` limpia el adjunto si `sendClientMessage` falla. |
| Comparación directa de `CRON_SECRET` | Mayor | Los cron jobs usan `crypto.timingSafeEqual`. |
| Productos eliminados como insumos de receta | Mayor | `recipeRepository.assertProductInBranch` filtra `isNull(products.deletedAt)`. |
| Rate limit de pedidos públicos aplicado después del parseo | Menor | `src/app/api/public/pedido/route.ts` aplica rate limit antes de procesar el body. |
| Denominaciones rápidas inconsistentes (`COMMON_BILLS`) | Menor | `src/components/pagos/payment-parts-input.tsx` usa `DEFAULT_DENOMINATIONS` en los botones de billetes. |
| Variables de dirección/teléfono/ubicación de sucursales no documentadas | Menor | `AGENTS.md`, `README.md` y `.devin/environment.yaml` documentan `DEFAULT_BRANCH_ADDRESS`, `DEFAULT_BRANCH_PHONE`, `DEFAULT_BRANCH_LOCATION`, `NEW_BRANCH_ADDRESS`, `NEW_BRANCH_PHONE`, `NEW_BRANCH_LOCATION`. |
| `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` no documentada en `README.md` | Menor | `README.md` y `.devin/environment.yaml` incluyen la variable. |
| Prompts archivados ausentes en el índice | Menor | `.devin/prompts/README.md` lista los prompts archivados `cobertura-auditoria-flujo-pedidos-2026-08-27.md`, `plan-mejoras-flujo-pedidos-chat-caja-sucursales-2026-08-27.md` y `recomendaciones-pedidos-sucursal-stock-2026-08-27.md`. |

## 7. Plan de acción priorizado

| Recomendación | Prioridad | Razón |
|---|---|---|
| Cerrar condiciones de carrera en `cancelSale`, `confirmSale` y `convertOrderToSale` | Crítico | Evita doble reintegro de stock/caja y sobreventa entre recepción y confirmación. **Hecho.** |
| Resolver overselling de pedidos `pending` (`createOrder` sin reserva) | Crítico | Varios pedidos pueden comprometer el mismo stock antes de `receiveOrder`. **Mitigado** con locks y reservas en recepción/confirmación; decisión pendiente de reservar al crear. |
| Preservar referencia histórica al eliminar cajas | Crítico | Los reportes de cierre no pueden perder `cashRegisterId` por hard delete. **Hecho:** se impide hard delete si existen ventas asociadas. |
| Agregar `countOrdersByStatus` y reemplazar `getOrders(..., limit:1)` en `/api/panel/resumen` | Crítico | **Hecho:** ahora se usa `orderService.getOrderCountsByStatus(branchId)`. |
| Mover `expirePendingOrders` fuera del request del dashboard (cron job o endpoint background) | Crítico | **Hecho:** se creó `/api/cron/expire-orders` (`*/5 * * * *`) protegido por `CRON_SECRET`; se quitó de `/api/panel/resumen` y `/api/pedidos`. |
| Agregar `route.test.ts` para `recibir`, `finalizar`, `public/sucursal/estado` y rutas de imagen de productos | Crítico | Estados de pedido, catálogo público e imágenes son críticos. **Hecho.** |
| Exponer `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` y conectarlo a `useDashboard.ts` | Mayor | Consistencia con el resto de intervalos configurables. **Hecho.** |
| Documentar `E2E_ENABLE_RATE_LIMIT` en `.env.example`, `README.md` y `AGENTS.md` (o aislar la lógica de test) | Mayor | **Hecho.** |
| Centralizar `process.env` en `src/config/*` y limpiar dependencias de capas | Mayor | Reduce riesgo de dependencias circulares y facilita tests. |
| Extraer pipeline común `prepareCart()` para ventas, pedidos y conversión | Mayor | Reduce duplicación y errores de inconsistencia. |
| Decidir semántica de reservas de stock en pedidos `pending` | Crítico | Reservar stock al crear o documentar que la disponibilidad solo se garantiza al recibir/confirmar; impacta UX y contabilidad de stock comprometido. |
| Proteger snapshots históricos en `receiveOrder` | Mayor | **Hecho:** se reemplazó `recomputeOrderRecipeSnapshots` por `ensureOrderRecipeSnapshots`; `receiveOrder` no vuelve a escribir `orderItemRecipes`, conserva el snapshot del pedido y solo computa en memoria cuando no hay snapshot. |
| Implementar soft delete o bloqueo para `deleteBranch` | Mayor | Evita pérdida irreversible de datos históricos. |
| Crear E2E de pago mixto real (`cash + transfer`) en el terminal de ventas | Mayor | **Hecho.** |
| Agregar test unitario para `orderStockReservationRepository.ts` | Mayor | **Hecho.** |
| Agregar `orderBy` en `findFirst` y `SELECT ... FOR UPDATE` de múltiples filas | Menor | Reduce no-determinismo y riesgo de deadlocks. |
| Hacer `createOrder` idempotente con `onConflictDoNothing` | Menor | Evita violaciones de unicidad en concurrencia. |
| Normalizar manejo de centavos en pagos | Menor | Evita redondeos inconsistentes en `payment-helpers.ts`. |
| Pausar polling del catálogo público al ocultar pestaña (`visibilitychange`) | Menor | Mejora batería y uso de ancho de banda. |
| Optimizar imágenes de productos/chat con `next/image` | Menor | Reduce tamaño de descarga y mejora CLS. |
| Unificar `COMMON_BILLS` con `DEFAULT_DENOMINATIONS` | Menor | **Hecho.** Evita denominaciones inconsistentes. |
| Resolver `getClientIp` para IPs no confiables en producción | Mayor | Evita que todo el tráfico comparta el mismo bucket de rate limit. |
| Revisar CSP `script-src 'unsafe-inline'` | Menor | Reduce riesgo de XSS; evaluar nonces o hashes. |
| Agregar `axe-core` o Lighthouse en CI para accesibilidad | Futuro | Detectar problemas de accesibilidad de forma automática. |

## 8. Progreso de ejecución del plan de acción

### Estado actual del plan de 18 tareas

| # | Tarea | Estado |
|---|---|---|
| 1 | Centralizar lecturas de `process.env` en `src/config/*` | **Completado** |
| 2 | Desacoplar `product-helpers.ts` de `summaryService` | **Completado** |
| 3 | Extraer `prepareCart()` común | **Completado** |
| 4 | Resolver `getClientIp` en producción | **Completado** |
| 5 | Reserva de stock en `createOrder` | **Completado** |
| 6 | Soft delete / archivo para `deleteBranch` | **Completado** |
| 7 | Tests unitarios para helpers críticos | **Completado** |
| 8 | E2E de cierres diarios | **Completado** |
| 9 | E2E de eliminación real de sucursal | **Completado** |
| 10 | `orderBy` en `findFirst` y `SELECT ... FOR UPDATE` | **Completado** |
| 11 | Idempotencia de `createOrder` | **Completado** |
| 12 | Pausar polling al ocultar pestaña | **Completado** |
| 13 | `next/image` en catálogo público | **Completado** |
| 14 | Targets táctiles de botones de pago | **Completado** |
| 15 | Documentar `calculateCompoundAvailability` | **Completado** |
| 16 | Normalizar aritmética de centavos | **Completado** |
| 17 | CSP sin `unsafe-inline/eval` | Pendiente |
| 18 | `axe-core` / Lighthouse en CI | Pendiente |

### Verificaciones del repositorio (última ejecución)

- `npm run lint` — ✅
- `npx tsc --noEmit` — ✅
- `npm test` — ✅ (139 suites, 1326 tests)
- `npm run build` — ✅
- `npm run knip` — ✅

### Decisiones aplicadas

- **Tarea #5:** se implementó reserva de stock en `createOrder`. Los pedidos `pending` ahora generan reservas en `order_stock_reservations` y movimientos `reserve` en `stock_movements`. `cancelOrder`, `expirePendingOrders` y `convertOrderToSale` liberan esas reservas cuando corresponde.
- **Tarea #6:** se implementó soft delete de sucursales. La columna `deletedAt` se agregó a `branches` y las tablas `products`, `cashRegisters`, `orders` y `videos` reciben `deletedAt` en cascada. `users` no se borran físicamente; `verifyCredentials` rechaza login en sucursales archivadas. Se conservan `sales`, `saleItems`, `stockMovements`, `recipes` y otros datos históricos.
- **Tarea #8:** se agregó `tests/e2e/cierres-diarios.spec.ts`. Abre caja, crea ventas por API con pagos mixtos (`cash` + `transfer`), cierra por API y verifica el resumen en `/cierre` y el historial en `/ventas/historial/[id]`, incluyendo productos vendidos y medios de pago.
- **Tarea #9:** se agregó `tests/e2e/sucursal-eliminacion.spec.ts`. Crea una sucursal y un operador, archiva la sucursal desde el panel y verifica que desaparece del listado, que el operador no puede loguear y que el endpoint público `/api/public/pedido` rechaza pedidos para la sucursal archivada con 404.

## 9. Enlaces relevantes

- `README.md` — punto de entrada del repositorio.
- `AGENTS.md` — reglas y convenciones para agentes.
- `.devin/README.md` — índice de `.devin/`.
- `.devin/prompts/README.md` — índice de prompts activos y archivados.
- `.devin/prompts/auditoria-masiva.md` — metodología de la auditoría.
- `.devin/prompts/auditoria-masiva-resumen.md` — guía de ejecución de la auditoría.
- `.devin/informes/entornos.md` — procedimientos de entornos y credenciales.
- `.devin/informes/guia-funcionamiento-pancheria.md` — conceptos de negocio y flujos.
- `.devin/informes/lecciones-aprendidas.md` — decisiones técnicas y regresiones evitadas.
- `.devin/informes/checklist-pre-push.md` — verificaciones antes de subir cambios.
- `.devin/informes/archivados/reporte-estado-historico-2026-08-30.md` — snapshot completo de fases anteriores.
