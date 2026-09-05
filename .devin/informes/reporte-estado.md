# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-05  
**Proyecto:** `pancheria`  
**Baseline:** `9c6f08507090d7dd379a49f25ad3e7600ae4fe3a` (branch `auditoria/masiva-2026-09-04`)  
**Auditoría:** Masiva integral — 9 áreas  
**Histórico:** Fases anteriores en `.devin/informes/archivados/reporte-estado-2026-09-04.md`

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo y las verificaciones base (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`) pasan correctamente. La suite de tests unitarios alcanza **140 suites y 1337 tests**; el build genera **69 rutas/páginas**.

Se completó la implementación de los seis hallazgos críticos y mayores identificados en la auditoría masiva del 2026-09-05:

1. **Transacciones reentrantes** (`executeInTransaction`): ahora detecta una transacción activa mediante `getCurrentTransaction()` y reutiliza el mismo `tx`, garantizando que `cancelOrder` + `cancelSale` sean atómicos. <ref_file file="C:/developer/paginas/pancheria/src/application/transactionService.ts" />
2. **Unificación de recetas históricas** en `convertOrderToSale` y `receiveOrder`: `validateCartAvailability` y `buildSaleItemValues` usan el `recipeSnapshot` del pedido cuando está presente, evitando validar con recetas actuales y descontar con snapshots distintos. <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />
3. **Scope en rate limits**: `createRateLimiter` propaga el `scope` al store, tanto en memoria como en PostgreSQL, separando contadores de pedidos y chat. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/public-order-rate-limit-store.ts" />
4. **Trazabilidad de reservas en `stock_movements`**: se agregó la columna `orderId` nullable con FK a `orders.id` y `onDelete: 'set null'`, poblada en movimientos `reserve` y `reserve_release`. <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
5. **Resolución de IP fuera de Vercel**: `getClientIp` ahora ofrece el escape controlado `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS=true` para usar `X-Forwarded-For` en producción auto-alojada, y corrige el header confiable para usar el primer valor de la cadena. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" />
6. **Cobertura de `prepareCart`**: se creó `src/lib/cart-pipeline.test.ts` con tests de contexto, bloqueo `FOR UPDATE`, reservas ajenas, totales, snapshots, servicios y faltantes. <ref_file file="C:/developer/paginas/pancheria/src/lib/cart-pipeline.test.ts" />

Se generó la migración `drizzle/0027_special_hellcat.sql` con los cambios de esquema correspondientes, pero **no se aplicó a producción** (se deja para el despliegue controlado).

No se ejecutaron tests E2E ni `drizzle-kit push` porque requieren confirmación explícita y una base de datos descartable.

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

La arquitectura mantiene la separación por capas: `src/app/` (UI y API), `src/application/` (servicios/casos de uso), `src/repositories/` (acceso a datos), `src/lib/` (utilidades transversales), `src/config/` (configuración con getters de variables de entorno), `src/domain/` (tipos y errores) y `src/db/` (esquema y seeds). Se agregó `src/lib/cart-pipeline.ts` para unificar la preparación del carrito entre ventas y pedidos. <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja, pedidos por estado, alertas de stock, accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock en `createOrder`, chat integrado y pagos mixtos.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público; snapshots de receta en `sale_item_recipes` y `order_item_recipes`.
- **Stock y caja**: movimientos con razones, cierre automático, cierres diarios históricos, soft delete de cajas.
- **Chat de pedidos**: texto e imágenes, paginación con cursores, polling con pausa por visibilidad y estados de entrega/lectura.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **140 suites, 1337 tests pasan** |
| `npm run build` | Build exitoso, 69 rutas/páginas |
| `npm run knip` | Pasa |
| `npx drizzle-kit check` | Pasa |
| `npx drizzle-kit generate` | Migración `0027_special_hellcat.sql` generada, no aplicada |
| `npm run analyze` | No ejecutado (limitación conocida bajo Turbopack) |
| `npx playwright test` | No ejecutado (requiere base de datos descartable) |

Los resultados de los comandos se resumen en la tabla anterior.

## 5. Hallazgos de la auditoría por área

A continuación se clasifican los hallazgos en **crítico**, **mayor**, **menor** o **informativo**, con evidencia concreta.

### 5.1 Calidad de código y consistencia

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Verificaciones base (`lint`, `tsc`, `test`, `build`, `knip`) pasan | OK | Ver sección 4 |
| `src/lib/utils.ts` contiene únicamente `cn` | OK | <ref_file file="C:/developer/paginas/pancheria/src/lib/utils.ts" /> |
| `saleService.ts` (685 líneas) y `orderService.ts` (846 líneas) son excesivamente largos y mezclan múltiples responsabilidades | Mayor | <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| `throw new Error` genéricos en servicios/repositorios no se mapean a `DomainError`/`NotFoundError` y terminan como 500 | Menor | `branchService.ts:64,115,264`, `userService.ts:71,144`, `saleService.ts:396`, `orderRepository.ts:294,330,356,375` <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" /> |
| `product-card.tsx` usa `key={product.imageUrl}` en `ProductImage`, forzando remount cuando cambia la URL | Menor | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" /> |
| `product-card.tsx` y `sales-product-card.tsx` duplican layout e insumos | Menor | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" /> <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-product-card.tsx" /> |
| `sales-terminal.tsx` calcula el total con multiplicación directa de `number` sin helpers de dinero | Menor | <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" /> |

### 5.2 Seguridad

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| No se detectaron credenciales/secretos hardcodeados en `src/` | OK | Búsquedas por `ADMIN_`, `SECRET`, `TOKEN`, `PASSWORD` solo arrojan lecturas de `process.env.*` y tests. |
| Autenticación y autorización por rol y `branchId` | OK | `withAuth` inyecta `branchId`; `admin` puede cambiar de sucursal; `operator` está restringido. <ref_file file="C:/developer/paginas/pancheria/src/lib/with-auth.ts" /> |
| Rate limit en endpoints públicos | OK | `createRateLimiter` protege pedidos y chat, y el scope se propaga al store, separando contadores de pedidos y chat. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/public-order-rate-limit-store.ts" /> |
| Cron jobs protegidos por `CRON_SECRET` con `crypto.timingSafeEqual` | OK | <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/rate-limit-cleanup/route.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/chat-attachments-cleanup/route.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/app/api/cron/expire-orders/route.ts" /> |
| CSP y headers de seguridad | OK | `src/proxy.ts` genera nonce por request; `next.config.ts` añade X-Frame-Options, X-Content-Type-Options, Referrer-Policy y HSTS. <ref_file file="C:/developer/paginas/pancheria/src/proxy.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" /> <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> |
| Rate limit de pedidos y chat con scope separado en el store de DB | OK | `createRateLimiter(scope, ...)` propaga el scope; `public_order_rate_limits` tiene PK compuesta `(scope, ip)`. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/public-order-rate-limit-store.ts" /> <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="708-712" /> |
| `getClientIp` en producción fuera de Vercel | OK | Se agregó `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS=true` como escape controlado para `X-Forwarded-For` (resuelto). <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| Header confiable `X-Forwarded-For` | OK | Se usa el primer valor de la cadena, que corresponde al cliente original detrás de un proxy confiable. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| Validación de uploads por `file.type` sin magic bytes | Menor | `src/lib/chat-storage.ts`, `src/lib/storage.ts`, `src/lib/product-image-storage.ts` <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" /> |
| `POST /api/public/pedido/[id]/chat/upload` no valida `content` con `chatMessageContentSchema` | Menor | <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/upload/route.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" /> |

### 5.3 Arquitectura y deuda técnica

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Separación de capas | OK | Capas `app/`, `application/`, `repositories/`, `lib/`, `config/`, `domain/` respetadas. |
| `prepareCart` en `src/lib/cart-pipeline.ts` reduce duplicación | OK | <ref_file file="C:/developer/paginas/pancheria/src/lib/cart-pipeline.ts" /> |
| Soft vs hard delete | OK | Productos, videos, cajas y sucursales usan `deletedAt`; hard delete libera archivos en productos y videos. |
| `process.env` disperso en helpers operacionales | Mayor | `src/lib/csp-helpers.ts`, `src/lib/storage.ts`, `src/lib/chat-storage.ts`, `src/lib/product-image-storage.ts`, `src/lib/rate-limit.ts`, `src/lib/public-order-rate-limit-store.ts`, `src/lib/rate-limit-store.ts`, `src/lib/branch-helpers.ts`, `src/lib/branch-resolver.ts` leen variables directamente. Dificulta tests y simulación de entornos. <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" /> |
| Capas mezcladas: `app/(panel)/perfil/actions.ts` y `api/productos/imagen/[key]/route.ts` acceden a `db` directamente | Menor | <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/perfil/actions.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/imagen/[key]/route.ts" /> |
| `findFirst` sin orden explícito en casos no únicos | Menor | `cashRegisterRepository.findOpen`, `orderRepository.findByOrderNumberAndCustomer` no usan `orderBy`. <ref_file file="C:/developer/paginas/pancheria/src/repositories/cashRegisterRepository.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" /> |
| Funciones críticas son largas y con múltiples responsabilidades | Menor | `insertSaleAndUpdateCashRegister`, `confirmSale`, `convertOrderToSale`, `createOrder`, `receiveOrder`, `validateCartAvailability`, `deleteBranch`. <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |

### 5.4 Cobertura de pruebas

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Unitarios: 139 suites / 1326 tests | OK | `npm test` |
| E2E: 33 specs / 113 tests | OK | `tests/e2e` |
| Cobertura de rutas API | OK | 50 rutas `src/app/api/**/route.ts` con 50 `route.test.ts` asociados. |
| Cobertura de servicios y repositorios | OK | 13 servicios y 10 repositorios cuentan con test unitario. |
| `src/lib/cart-pipeline.ts` con test unitario | OK | Se creó `src/lib/cart-pipeline.test.ts` con cobertura de contexto, `FOR UPDATE`, reservas, totales, snapshots, servicios y faltantes. <ref_file file="C:/developer/paginas/pancheria/src/lib/cart-pipeline.ts" /> |
| Helpers de `src/lib/` sin test unitario | Menor | `csp-helpers.ts`, `pagination.ts`, `logger.ts`, `product-image-upload-client.ts`, `last-customer-name.ts`, `last-customer-phone.ts`, `product-style.ts`. <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" /> |
| Componentes críticos de UI sin test unitario | Menor | `dashboard-client.tsx`, `caja-panel.tsx`, `chat-composer.tsx`, `pedidos-list.tsx`, `branch-form.tsx`, `change-password-form.tsx`, `video-player.tsx`, `sales-cart.tsx` se recorren por E2E. <ref_file file="C:/developer/paginas/pancheria/src/components" /> |
| Flujos E2E críticos cubiertos | OK | Pago mixto, cierres diarios, eliminación de sucursal, expiración, rate limit, cambio de contraseña, anulación. <ref_file file="C:/developer/paginas/pancheria/tests/e2e" /> |

### 5.5 Documentación y variables de entorno

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Variables principales sincronizadas con `.env.example` | OK | `DATABASE_URL`, `NEXTAUTH_*`, `ADMIN_*`, `NEXT_PUBLIC_*`, `STORAGE_*`, etc. |
| `ANALYZE` y `AUTH_URL` documentadas como implícitas | Informativo | `ANALYZE` se usa en build; `AUTH_URL` es consumida por NextAuth v5. Están en `.env.example` como referencia. <ref_file file="C:/developer/paginas/pancheria/.env.example" /> |
| README, lecciones aprendidas y guía de funcionamiento decían que los pedidos no reservan stock al crearse | Mayor (documental) | **Corregido** en esta sesión: se actualizaron `README.md`, `lecciones-aprendidas.md` y `guia-funcionamiento-pancheria.md` para reflejar que `createOrder` reserva stock inmediatamente. <ref_file file="C:/developer/paginas/pancheria/README.md" /> <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> |
| Prompts archivados reflejados en índices | OK | `.devin/prompts/README.md` y `.devin/README.md` listan prompts activos y archivados. <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" /> |

### 5.6 Rendimiento y bundle

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Páginas públicas críticas con `dynamic = 'force-dynamic'` | OK | `/pedido`, `/pedido/[id]/chat`, `/api/public/*`, `/api/panel/resumen`, etc. <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" /> |
| `optimizePackageImports` habilitado | OK | `lucide-react` y `date-fns` en `next.config.ts`. |
| `npm run analyze` bajo Turbopack | Limitación conocida | El build termina, pero `@next/bundle-analyzer` no genera el HTML del reporte. <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> |
| `orderService.expirePendingOrders` carga todos los pedidos expirados sin límite/paginación | Mayor | <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="758-793" /> <ref_snippet file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" lines="274-287" /> |
| `getCajaRefreshInterval()` y `getCajaClockIntervalMs()` no imponen un mínimo práctico | Mayor | Un valor bajo puede generar polling agresivo. <ref_file file="C:/developer/paginas/pancheria/src/config/caja.ts" /> |
| Loops N+1 en descuento/reintegro de stock y borrado de cajas | Menor | `saleService.deductStockForItems` / `reintegrateStockForItems`, `cashRegisterRepository.hardDeleteAllDeletedInRange`. <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/repositories/cashRegisterRepository.ts" /> |
| Catálogo público y terminal de ventas cargan catálogo completo en memoria | Menor | `usePedidoClient.ts` y `sales-terminal.tsx` sin paginación. <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" /> |
| `useOrderChat.ts` agrega listeners propios de visibilidad además de `useVisibilityPolling` | Menor | Puede provocar fetch duplicado al volver visible. <ref_file file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" /> |

### 5.7 Accesibilidad y UX

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Uso de atributos ARIA en componentes críticos | OK | `aria-label`, `aria-pressed`, `aria-live`, `aria-expanded` presentes en carrito, pagos, chat, selector de sucursal, paginación, etc. <ref_file file="C:/developer/paginas/pancheria/src/components" /> |
| Estados de carga/error/vacío | OK | Skeletons y mensajes vacíos en listados principales. <ref_file file="C:/developer/paginas/pancheria/src/components" /> |
| Tour interactivo adaptativo | OK | `tour-context.tsx` filtra pasos por rol (`admin`/`operator`) y usa `data-tour` / `skipMissingElement`. <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" /> |
| Accesibilidad automatizada con axe-core | OK | `tests/e2e/accessibility.spec.ts` con `@axe-core/playwright` y CI. <ref_file file="C:/developer/paginas/pancheria/tests/e2e/accessibility.spec.ts" /> |
| Responsividad | OK | `tests/e2e/responsive.spec.ts` verifica viewports y targets táctiles. <ref_file file="C:/developer/paginas/pancheria/tests/e2e/responsive.spec.ts" /> |
| Targets táctiles de botones de pago por debajo de 44×44 px | Menor | `payment-parts-input.tsx` usa `h-7 px-1.5` (28 px de alto). <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" /> |

### 5.8 Integridad de datos y flujos de negocio

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| Reserva de stock en `createOrder` | OK | `createOrder` inserta reservas en `order_stock_reservations` y movimientos `reserve` en `stock_movements`. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="292-309" /> |
| Snapshots de recetas | OK | `sale_item_recipes` y `order_item_recipes` persisten el estado de recetas; `receiveOrder` ya no reescribe `order_item_recipes`. <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| Soft delete sin liberar archivos; hard delete sí | OK | Implementado en productos y videos; `deleteBranch` archiva en cascada. |
| Pagos mixtos | OK | Tabla `sale_payments`, soporte en ventas y confirmación de pedidos. |
| Cierre automático de cajas | OK | `CAJA_AUTO_CLOSE_HOURS` y `CAJA_AUTO_CLOSED_BY`. |
| Transacción reentrante en `cancelOrder` → `cancelSale` | OK | `executeInTransaction` detecta una transacción activa con `getCurrentTransaction()` y reutiliza el mismo `tx`; `cancelOrder` + `cancelSale` son atómicos. <ref_file file="C:/developer/paginas/pancheria/src/application/transactionService.ts" /> <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="360-403" /> |
| `convertOrderToSale` usa el snapshot histórico para validar y descontar | OK | `validateCartAvailability` y `buildSaleItemValues` usan el `recipeSnapshot` del pedido cuando está presente, asegurando que se validen y descuenten los mismos insumos. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="474-540" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/sale-helpers.ts" /> |
| `stock_movements` con FK `orderId` | OK | La columna `orderId` nullable con FK a `orders.id` poblada en `reserve` y `reserve_release` mejora trazabilidad. <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="489-517" /> |
| `updateProduct` borra la imagen anterior dentro de la transacción | Menor | Si el `UPDATE` falla, el archivo ya fue eliminado. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/productService.ts" lines="154-159" /> |
| `deleteBranch` no libera archivos asociados | Menor | Archiva productos, cajas, pedidos y videos, pero no elimina imágenes/videos/adjuntos. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" lines="213-269" /> |
| `expirePendingOrders` solo tolera errores que contienen `"confirmado"` | Menor | Si `cancelOrder` falla por otro motivo, el cron se detiene y deja pedidos expirados. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="779-787" /> |

### 5.9 Configuración de despliegue, CI/CD y entornos

| Hallazgo | Clasificación | Evidencia / Comentario |
|---|---|---|
| `.github/workflows/ci.yml` completo | OK | Lint, tipos, unit tests, build, knip, E2E. Verifica secretos requeridos. <ref_file file="C:/developer/paginas/pancheria/.github/workflows/ci.yml" /> |
| `playwright.config.ts` | OK | Carga `.env.local` y `.env.e2e`, health check a `/api/caja/resumen`, pasa variables de rate limit. <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" /> |
| `vercel.json` con cron jobs | OK | Limpieza de rate limits, adjuntos de chat y expiración de pedidos. |
| `next.config.ts` con headers y CSP | OK | CSP generada por `src/proxy.ts`/`src/lib/csp-helpers.ts`; headers de seguridad en `next.config.ts`. <ref_file file="C:/developer/paginas/pancheria/src/proxy.ts" /> <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" /> <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> |
| `.env.local` y `.env.e2e` no commiteados | OK | `.gitignore` los excluye. |
| Versiones desalineadas en `package.json` | Informativo | `next` `^16.3.3` vs `@next/bundle-analyzer` y `eslint-config-next` `16.3.2`. <ref_file file="C:/developer/paginas/pancheria/package.json" /> |
| `playwright.config.ts` y `scripts/dev-e2e.ts` usan `override: true` para `.env.e2e` | Menor | Si se dejan variables vacías, sobrescriben `.env.local` con cadenas vacías. <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" /> <ref_file file="C:/developer/paginas/pancheria/scripts/dev-e2e.ts" /> |
| `next.config.ts` sin CORS explícito | Informativo | Si se esperan llamadas cross-origin a `/api/public/*`, agregar headers. <ref_file file="C:/developer/paginas/pancheria/next.config.ts" /> |

## 6. Correcciones documentales aplicadas

| Hallazgo | Acción | Evidencia |
|---|---|---|
| README.md decía que los pedidos no reservan stock al crearse | Actualizado flujo y explicación de reservas | <ref_file file="C:/developer/paginas/pancheria/README.md" /> |
| `lecciones-aprendidas.md` decía que `createOrder` no descuenta stock | Reescrita la lección para reflejar reserva inmediata | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> |
| `guia-funcionamiento-pancheria.md` contradecía el flujo de reservas | Actualizado checklist y conclusión | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> |

## 7. Plan de acción priorizado

| Recomendación | Prioridad | Razón |
|---|---|---|
| `executeInTransaction` re-entrante para `cancelOrder` → `cancelSale` | Resuelto | Resuelto: `getCurrentTransaction()` reutiliza el `tx` activo; tests actualizados. <ref_file file="C:/developer/paginas/pancheria/src/application/transactionService.ts" /> |
| Unificar validación y deducción de recetas en `convertOrderToSale` usando el snapshot histórico | Resuelto | Resuelto: `validateCartAvailability` y `buildSaleItemValues` usan `recipeSnapshot` del pedido. <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| Scope en `public_order_rate_limits` | Resuelto | Resuelto: PK compuesta `(scope, ip)` y store separa contadores por scope. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| `orderId` nullable en `stock_movements` | Resuelto | Resuelto: columna y FK agregadas, poblada en reservas; migración generada. <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> |
| `getClientIp` en producción fuera de Vercel | Resuelto | Resuelto: `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS=true` como escape controlado. <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> |
| Tests unitarios de `src/lib/cart-pipeline.ts` | Resuelto | Resuelto: `src/lib/cart-pipeline.test.ts` cubre contexto, `FOR UPDATE`, reservas, totales, snapshots, servicios y faltantes. <ref_file file="C:/developer/paginas/pancheria/src/lib/cart-pipeline.ts" /> |
| Mover eliminación de archivos fuera de la transacción o a una cola post-commit | Menor | Evita que un rollback deje `imageKey` apuntando a un archivo inexistente. <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" /> |
| Paginar `expirePendingOrders` y tolerar errores de dominio genéricos | Menor | Reduce carga de memoria y evita que el cron se detenga por carreras. <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> |
| Imponer mínimos prácticos a intervalos de caja | Menor | Evita polling agresivo si se configuran valores muy bajos. <ref_file file="C:/developer/paginas/pancheria/src/config/caja.ts" /> |
| Centralizar lecturas de `process.env` en `src/config/*` | Menor | Reduce acoplamiento y mejora testeabilidad. <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" /> |
| Alinear versiones de paquetes `@next/*` y `eslint-config-next` con `next` | Informativo | Consistencia de versiones en `package.json`. <ref_file file="C:/developer/paginas/pancheria/package.json" /> |

## 8. Cierre

- Baseline: `9c6f08507090d7dd379a49f25ad3e7600ae4fe3a`
- Verificaciones base ejecutadas: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`, `npx drizzle-kit check` — todas pasaron.
- Migración generada: `drizzle/0027_special_hellcat.sql` (no aplicada a producción).
- Documentación actualizada: `README.md`, `AGENTS.md`, `.env.example`.
- Informe anterior archivado en `.devin/informes/archivados/reporte-estado-2026-09-04.md`.
- No se ejecutaron `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npm run test:e2e`, `npx playwright test` ni `npx vercel env pull` por requerir confirmación explícita y una base de datos descartable.
