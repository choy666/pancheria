# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-06  
**Proyecto:** `pancheria`  
**Baseline:** `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`) — seguimiento post-eliminación de WhatsApp y catálogo paginado  
**Auditoría:** Masiva integral — 9 áreas — **con implementación de todos los hallazgos abiertos**  
**Histórico:** Fases anteriores en `.devin/informes/archivados/reporte-estado-2026-09-04.md`; seguimientos del 2026-09-06 en las secciones 9 y 11

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo y las verificaciones base (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`) pasan correctamente. La suite de tests unitarios alcanza **144 suites y 1405 tests** en el seguimiento del 2026-09-06 (ver sección 9) y **148 suites y 1444 tests** tras la implementación de la sección 13 (working tree); el build genera **73 rutas/páginas**. El suite E2E cuenta con **34 specs (~113 tests)**.

Esta iteración tuvo dos fases:

1. **Re-auditoría** sobre `HEAD` de `main` (post-merge de `auditoria/masiva-2026-09-04`): sin regresiones y sin hallazgos críticos; se confirmaron los seis ítems resueltos de la iteración anterior.
2. **Implementación de todos los hallazgos abiertos** (3 mayores, ~20 menores, informativos):

   - `validateOpeningHours` ahora lanza `ValidationError` (400 en lugar de 500 para horarios inválidos). <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" />
   - `getCajaRefreshInterval()` y `getCajaClockIntervalMs()` imponen mínimos de 5000 ms y 10000 ms. <ref_file file="C:/developer/paginas/pancheria/src/config/caja.ts" />
   - Refactor incremental de servicios: `saleService.ts`, `orderService.ts` y `productService.ts` ya no escriben directamente en tablas — orquestan repositorios con soporte de `tx` (`saleRepository`, `orderRepository`, `productRepository`, `stockMovementRepository`, `cashRegisterRepository`, `orderMessageRepository`, `recipeRepository`).
   - Validación de **magic bytes** en uploads de videos, adjuntos de chat e imágenes de productos (`assertFileSignature` en `src/lib/storage.ts`).
   - `content` validado con `chatMessageContentSchema.partial()` en ambos endpoints de upload de chat.
   - `findFirst` con `orderBy` explícito en `findOpen` y `findByOrderNumberAndCustomer`.
   - Eliminados N+1 de `hardDeleteAllDeletedInRange` (GROUP BY + delete único), `emptyTrash` (validaciones masivas + `hardDeleteMany`) y movimientos de stock (insert bulk vía `insertMany`).
   - `updateProduct` elimina la imagen anterior **después** del commit.
   - `csp-helpers.ts` ya no lee `process.env` directo (usa `src/config/*` + nuevo `src/config/storage-origins.ts`); `remotePatterns` auto-incluye los orígenes del proveedor de storage activo y `images.formats` declarado.
   - Polling unificado: `useOrderChat` sin listener duplicado, `useCashRegister` y `useDashboard` migrados a `useVisibilityPolling` (con nuevo `onResume`), `TourProvider` con `useMemo`.
   - Empty states en productos, stock, historial de ventas y caja; `key` corregidas en `product-card.tsx`; total del terminal con helpers de dinero.
   - 4 suites de tests nuevas: `dashboard-client`, `video-player`, `csp-helpers`, `product-image-upload-client` (+43 tests).

3. **Consolidación final de la iteración** (última ronda sobre `main`):

   - Consolidación real de tarjetas: `ProductCardBase` con `variant="catalog" | "sales"` unifica las props de `product-card.tsx` (catálogo) y `sales-product-card.tsx` (terminal); se conservan imagen/descripción/badge de tipo y diálogo de opciones en catálogo, y tarjeta clickeable con badge de cantidad y stock restante en ventas; los `data-testid` por variante no cambian (selectores E2E intactos). <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-base.tsx" />
   - `validateCartAvailability` dividida en un orquestador + 8 funciones puras exportadas y testeadas (`collectCartProductIds`, `groupRecipeSnapshotsByProduct`, `collectAvailabilityLockIds`, `applyReservationsToStock`, `calculateConsumedBySupply`, `calculateAvailabilityByProduct`, `calculateBreakdownByProduct`, `calculateShortageByProduct`). <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" />
   - Catálogo paginado de punta a punta: `findPublicProducts` filtra vendibles en SQL y suma `countPublicProducts`; el service acepta `{limit, offset}` y devuelve `total`; `GET /api/public/catalogo` valida ambos parámetros; `/pedido` hace SSR de la primera página y el cliente pide el resto con "Cargar más" (`catalog-load-more`, dedupe por id, polling refresca lo ya cargado). Page size con `NEXT_PUBLIC_CATALOG_PAGE_SIZE` (default 48).
   - +32 tests unitarios (145 suites, 1425 tests); re-verificación E2E parcial de los flujos tocados: **11/11 pasaron**.
   - Selectores endurecidos con `data-testid` (`product-availability`, `cash-register-cash-total`, `cash-register-transfer-total`, `cash-register-sales-count`, `cash-register-id-*`, `branch-phone`).
   - Docs: `BASE_URL`/`NO_GLOBAL_SETUP` documentadas, `NEXT_PUBLIC_WHATSAPP_NUMBER` como opcional, mínimos de intervalos documentados, `environment.yaml` sincronizado, `.env.e2e` ya no pisa variables con valores vacíos, CI E2E usa `drizzle-kit migrate`, versiones `@next/*`/`eslint-config-next` alineadas a `16.3.3`.

Los tests E2E se ejecutaron contra la base descartable de `.env.e2e` con resultado completo: **110/110 pasaron**. No se ejecutó `drizzle-kit push` (no hubo cambios de esquema).

> **Actualización post-baseline:** el cron `expire-orders` se movió de `vercel.json` a `.github/workflows/expire-orders.yml`; se sincronizó la documentación en `README.md`, `AGENTS.md`, `.env.example`, `environment.yaml` y este informe; se eliminó el dominio de producción hardcodeado del workflow.
>
> **Actualización 2026-09-06:** se eliminó por completo la integración con WhatsApp (`src/lib/whatsapp.ts`, enlaces `wa.me`, botones en `pedido-success-dialog.tsx` y `pedido-actions.tsx`, y las variables `NEXT_PUBLIC_WHATSAPP_*` de `.env.example`, `.env.e2e.example`, `ci.yml` y la documentación). El tipo `PublicOrderItem` se reubicó en `src/domain/types.ts` y el chat del pedido quedó como único canal con el cliente.

## 2. Stack y arquitectura

- Next.js `16.3.3` (App Router + Turbopack) <ref_file file="C:/developer/paginas/pancheria/package.json" />
- React `19.2.8`, TypeScript `5.x`, Tailwind CSS `4`, shadcn/ui
- Drizzle ORM `0.45.2`, PostgreSQL (Neon / `pg`)
- NextAuth v5 (`5.0.0-beta.32`)
- Jest `30.x`, Playwright `1.62.x`
- `@next/bundle-analyzer` y `eslint-config-next` alineados a `16.3.3`
- Vercel (despliegue recomendado)

La arquitectura mantiene la separación por capas: `src/app/` (UI y API), `src/application/` (servicios/casos de uso), `src/repositories/` (acceso a datos — ahora incluye las escrituras transaccionales antes embebidas en servicios), `src/lib/` (utilidades transversales), `src/config/` (getters de variables de entorno — única fuente de `process.env` en runtime), `src/domain/` (tipos y errores) y `src/db/` (esquema y seeds). `src/lib/cart-pipeline.ts` unifica la preparación del carrito y delega el locking a `productRepository.lockForUpdate`. <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja, pedidos por estado, alertas de stock, accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock al recibir el pedido (`receiveOrder`), chat integrado y pagos mixtos.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público; snapshots de receta en `sale_item_recipes` y `order_item_recipes`.
- **Stock y caja**: movimientos con razones, cierre automático, cierres diarios históricos, soft delete de cajas.
- **Chat de pedidos**: texto e imágenes (con validación de magic bytes), paginación con cursores, polling con pausa por visibilidad.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **145 suites, 1425 tests pasan** |
| `npm run build` | Build exitoso, 73 rutas/páginas |
| `npm run knip` | Pasa (sin exports/dependencias sin uso) |
| `npx drizzle-kit check` | **Pasa**: esquema y migraciones consistentes contra `.env.e2e` |
| `npm run analyze` | No ejecutado (limitación conocida bajo Turbopack) |
| `npm run test:e2e` | **Pasa: 110/110 tests (18.1 min)** contra la base descartable de `.env.e2e`. Re-verificación parcial tras esta ronda: `pedido.spec.ts` + `ventas-disponibilidad.spec.ts` + `ventas-pago-mixto.spec.ts` → **11/11 pasaron** |

El esquema Drizzle cuenta con **28 migraciones** (`0000`–`0027`) y el journal termina en `0027_dashing_bastion`, consistente con `src/db/schema.ts`. No hubo cambios de esquema en esta iteración.

## 5. Hallazgos de la auditoría por área

Todos los hallazgos abiertos fueron implementados. La tabla resume el estado final; la evidencia de implementación está en la sección 6.

### 5.1 Calidad de código y consistencia

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Verificaciones base (`lint`, `tsc`, `test`, `build`, `knip`) | OK | Pasan |
| `src/lib/utils.ts` contiene únicamente `cn` | OK | Vigente |
| `withApiErrorHandling` mapea errores correctamente | OK | `NotFoundError`→404, `ForbiddenError`→403, `DomainError`→400, `ZodError`→400, conexión→503, `InsufficientStockError`→409 |
| `throw new Error` genéricos → errores de dominio | Resuelto | `branch-helpers.ts` (`ValidationError`), `branchService`, `userService`, `orderRepository`, `saleRepository`, `orderMessageRepository` (`DomainError`); `storage.ts`/`chat-storage.ts` (`ValidationError` para input); `db/index.ts` (`DatabaseConnectionError`→503). Los errores de misconfiguración de arranque (credenciales faltantes de storage) quedan como `Error` por decisión documentada (500 correcto). |
| `validateCartAvailability` (~217 líneas) | Menor | **Resuelto**: dividida en funciones puras exportadas (`collectCartProductIds`, `groupRecipeSnapshotsByProduct`, `collectAvailabilityLockIds`, `applyReservationsToStock`, `calculateConsumedBySupply`, `calculateAvailabilityByProduct`, `calculateBreakdownByProduct`, `calculateShortageByProduct`) con `validateCartAvailability` como orquestador; +12 tests unitarios. <ref_file file="C:/developer/paginas/pancheria/src/lib/product-helpers.ts" /> |
| `key={product.imageUrl}` / `key={index}` en `product-card.tsx` | Resuelto | `ProductImage` guarda `failedUrl` (resetea el error al cambiar `src` sin remount); breakdown usa `key={item.supplyName}`. |
| Duplicación `product-card.tsx` vs `sales-product-card.tsx` | Menor | **Resuelto**: consolidación real con `ProductCardBase` (`variant="catalog" | "sales"`) en `src/components/productos/product-card-base.tsx`; ambos wrappers delegan. Se conservan los `data-testid` por variante (no se rompen selectores E2E); +11 tests unitarios del base. |
| Total de `sales-terminal.tsx` con `number` | Resuelto | Ahora usa `addMoney`/`multiplyMoney`/`parseMoney`/`moneyToNumber` con `useMemo`. |

### 5.2 Seguridad

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Credenciales/secretos hardcodeados | OK | Ninguno detectado |
| Autenticación, roles y `branchId` | OK | `withAuth` en las rutas del panel |
| Rate limit en endpoints públicos | OK | Scopes separados (`order`, `chat`, `order-tracking`, `order-cancellation`) |
| Cron jobs con `CRON_SECRET` + `timingSafeEqual` | OK | Los 3 crons |
| CSP y headers | OK | Nonce por request; sin `unsafe-inline`/`unsafe-eval` en producción |
| Path traversal en `local` | OK | Validación de clave + path resuelto en los 3 storages |
| Validación de uploads sin magic bytes | Resuelto | `assertFileSignature` verifica firma real (JPEG/PNG/WebP/MP4/WebM/OGG/AVI) antes de persistir; fail-closed ante MIME sin firma conocida. Limitación documentada: las subidas directas presignadas (blob/s3/r2) solo validan metadata. <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" /> |
| `content` sin validar en uploads de chat | Resuelto | `chatMessageContentSchema.partial()` en ambos endpoints; 400 sin persistir el adjunto. |
| Sin CORS explícito | Informativo | Monolito mismo-origen; sin acción requerida |

### 5.3 Arquitectura y deuda técnica

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Separación de capas | Resuelto | Los servicios ya no escriben en tablas directamente; la persistencia vive en repositorios con `tx`. `perfil/actions.ts` delega en `userService`; `api/productos/imagen/[key]` delega en `productImageStorage`. |
| `process.env` fuera de `src/config/*` | Resuelto | `csp-helpers.ts` migrado a getters de config; nuevo `src/config/storage-origins.ts` (autocontenido para uso desde `next.config.ts` y el proxy). |
| Locking en `src/lib/` | Resuelto | `productRepository.lockForUpdate` concentra el `for('update')` de productos; `cash-register-helpers.ts` delega en `cashRegisterRepository`. |
| `findFirst` sin `orderBy` | Resuelto | `findOpen` ordena por `openedAt`/`id` desc; `findByOrderNumberAndCustomer` por `createdAt`/`id` desc. |
| Servicios monolíticos | Mayor → Resuelto (parcial) | La persistencia fue extraída a repositorios; los servicios quedaron como orquestadores. `validateCartAvailability` quedó dividida en funciones puras; la división fina de `orderService`/`saleService` queda como deuda futura no bloqueante. |
| Soft vs hard delete | OK | Decisión funcional confirmada: `deleteBranch` es hard delete en cascada con liberación post-commit. |

### 5.4 Cobertura de pruebas

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Unitarios: 145 suites / 1425 tests | OK | `npm test` |
| E2E: 34 specs / ~110 tests | OK | `tests/e2e` |
| Rutas API, servicios, repositorios | OK | 100% con test |
| Helpers de `src/lib/` sin test | Resuelto | Agregados `csp-helpers.test.ts` y `product-image-upload-client.test.ts`; quedan sin test solo helpers triviales (`utils`, `logger`, `last-customer-*`, `product-style`, `pagination`). |
| `dashboard-client.tsx` y `video-player.tsx` sin cobertura | Resuelto | Suites nuevas: 13 y 8 tests respectivamente. |
| `branch-form.tsx` sin `data-testid` | Menor | Resuelto — agregados `data-testid` en formulario, campos, franjas horarias, botones y mensaje de error. |
| Selectores frágiles con valores numéricos | Resuelto | `data-testid` agregados (`product-availability`, `cash-register-*-total`, `cash-register-sales-count`, `cash-register-id-*`, `branch-phone`); specs E2E actualizados. |
| Dependencia del seed en E2E | Informativo | Conocida y aceptada; `global-setup` reseedea. |
| Flujos E2E críticos | OK | Todos cubiertos; recetas solo vía promo. |

### 5.5 Documentación y variables de entorno

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Variables sincronizadas | OK | `.env.example`, `AGENTS.md`, `README.md`, `environment.yaml` alineados con el código |
| `.env*` no commiteados | OK | Solo ejemplos trackeados |
| `environment.yaml` desactualizado | Resuelto | `daily_closures` fuera del truncate, `migrate` como flujo de producción, `npm run start`/`test:accessibility` agregados |
| `BASE_URL`/`NO_GLOBAL_SETUP` sin documentar | Resuelto | Documentadas en `AGENTS.md` y `README.md` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` requerida vs opcional | Resuelto | Marcada opcional en `.env.example`, `AGENTS.md` y `README.md` |
| Mínimos de intervalos sin documentar | Resuelto | Documentados en `.env.example` y `AGENTS.md` |
| Comentario `src/middleware.ts` en `csp-helpers.ts` | Resuelto | Actualizado a `src/proxy.ts` |

### 5.6 Rendimiento y bundle

| Hallazgo | Clasificación | Estado |
|---|---|---|
| `force-dynamic` en páginas públicas | OK | Vigente |
| `npm run analyze` bajo Turbopack | Limitación conocida | Requiere `next build --webpack` |
| Intervalos de caja sin mínimo | Resuelto | Mínimos 5000/10000 ms aplicados y documentados |
| N+1 en movimientos de stock, borrado de cajas y papelera | Resuelto | `stockMovementRepository.insertMany` (insert bulk), `hardDeleteAllDeletedInRange` con `GROUP BY` + delete único, `emptyTrash` con `findReferencedProductIds` + `hardDeleteMany`. Los `UPDATE` de stock con guarda `gte` siguen por fila (semántica requerida para `InsufficientStockError`). |
| Catálogo completo en memoria | Resuelto | `catalogRepository.findPublicProducts` filtra productos vendibles en SQL (era filtro en memoria) y suma `countPublicProducts`; `listPublicCatalog`/`listPublicCatalogWithAvailability` aceptan `{limit, offset}` y devuelven `total`; `GET /api/public/catalogo` valida `limit`/`offset`; `/pedido` carga la primera página por SSR y el cliente trae el resto con "Cargar más" (`catalog-load-more`, dedupe por id, polling refresca lo ya cargado). Page size configurable con `NEXT_PUBLIC_CATALOG_PAGE_SIZE` (default 48). |
| Listeners duplicados en `useOrderChat` | Resuelto | `useVisibilityPolling` es la única fuente de polling por visibilidad; se conserva `pageshow` (bfcache) y el reset de backoff vía `onResume`. |
| Polling manual en `useCashRegister`/`useDashboard` | Resuelto | Migrados a `useVisibilityPolling`. |
| `TourProvider` sin `useMemo` | Resuelto | Contexto memoizado. |
| `remotePatterns` sin dominios del provider | Resuelto | Auto-incluye `*.public.blob.vercel-storage.com`, origin de `S3_ENDPOINT`/`bucket.s3.region.amazonaws.com` o `account.r2.cloudflarestorage.com` según `STORAGE_PROVIDER`; `images.formats: avif/webp` declarado. |
| `<img>` nativo en `product-image-uploader` | Informativo | Justificado para vista previa local. |

### 5.7 Accesibilidad y UX

| Hallazgo | Clasificación | Estado |
|---|---|---|
| ARIA, labels, roles | OK | Cobertura adecuada en componentes críticos |
| axe-core + responsive en CI | OK | `accessibility.spec.ts` y `responsive.spec.ts` en el job E2E |
| Targets táctiles | OK | `min-h-11`/`min-w-11` en botones de pago |
| Tour adaptativo | OK | Por rol, `data-tour`, `skipMissingElement` |
| Empty states faltantes | Resuelto | Agregados en productos, stock, historial de ventas y caja (mensaje + `colSpan`). |

### 5.8 Integridad de datos y flujos de negocio

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Reservas de stock | OK | `createOrder` solo valida; `receiveOrder` reserva; liberación solo desde `in_process`; expiración no toca stock |
| Snapshots de recetas | OK | `convertOrderToSale` propaga `recipeSnapshot` a validación y deducción |
| Soft/hard delete y archivos | OK | Archivos se liberan solo en hard delete, post-commit |
| Integridad referencial | OK | FKs verificadas (`restrict`/`cascade`/`set null`, PK compuesta de rate limits) |
| Expiración de pedidos | OK | Lotes de 200, `findByIdForUpdate`, tolera `DomainError` |
| Transacciones reentrantes | OK | `executeInTransaction` reutiliza el `tx` activo |
| `updateProduct` borraba imagen dentro de la tx | Resuelto | La eliminación del archivo ocurre después del commit. |

### 5.9 Configuración de despliegue, CI/CD y entornos

| Hallazgo | Clasificación | Estado |
|---|---|---|
| `ci.yml` completo | OK | lint, typecheck, unit-tests, build, knip, e2e+accesibilidad; verifica secretos |
| `playwright.config.ts` | Resuelto | `.env.e2e` ya no sobrescribe con valores vacíos (parseo manual con `dotenv.parse` + filtrado); igual en `scripts/dev-e2e.ts` |
| `vercel.json` crons | OK | 2 crons en `vercel.json` (`rate-limit-cleanup`, `chat-attachments-cleanup`, diarios); `expire-orders` se dispara desde `.github/workflows/expire-orders.yml` cada 5 min |
| `next.config.ts` headers/CSP | OK | + `images.formats` y `remotePatterns` por provider |
| CI E2E `push --force` | Resuelto | Ahora usa `drizzle-kit migrate` (registra `__drizzle_migrations`) |
| Versiones desalineadas | Resuelto | `@next/bundle-analyzer` y `eslint-config-next` en `16.3.3` |
| `global-setup` valida base descartable | OK | Vigente |

## 6. Correcciones aplicadas en esta iteración

### Código
| Cambio | Archivos |
|---|---|
| Errores de dominio en validaciones y servicios | `src/lib/branch-helpers.ts`, `src/application/services/branchService.ts`, `src/application/services/userService.ts`, `src/repositories/orderRepository.ts`, `src/repositories/saleRepository.ts`, `src/repositories/orderMessageRepository.ts`, `src/lib/storage.ts`, `src/lib/chat-storage.ts`, `src/db/index.ts` |
| Magic bytes en uploads | `src/lib/storage.ts` (`hasExpectedFileSignature`/`assertFileSignature`), `src/lib/chat-storage.ts`, `src/lib/product-image-storage.ts` |
| Refactor de persistencia a repositorios | `src/application/services/saleService.ts`, `orderService.ts`, `productService.ts`, `cashRegisterService.ts`, `src/repositories/*` (métodos nuevos: `lockForUpdate`, `decrementStock`/`incrementStock`, `insertMany`, `insertSale`/`insertItems`/`insertItemRecipes`/`insertPayments`, `findByIdWithDetails`, `cancelIfActive`, `insertOrderIdempotent`, `insertItems`/`insertItemRecipes`, `insertMessage`, `findReferencedProductIds`, `hardDelete`/`hardDeleteMany`, `findBySupplyId`, `deleteByCompoundProductId`, `update`/`create` con `dbOrTx`), `src/lib/cart-pipeline.ts`, `src/lib/cash-register-helpers.ts` |
| `updateProduct` imagen post-commit; `emptyTrash` en lote | `src/application/services/productService.ts` |
| Mínimos de intervalos de caja | `src/config/caja.ts` |
| `csp-helpers` → config; orígenes de storage | `src/lib/csp-helpers.ts`, `src/config/storage-origins.ts` (nuevo), `next.config.ts` |
| Polling unificado y `onResume` | `src/components/chat/useOrderChat.ts`, `src/hooks/useCashRegister.ts`, `src/hooks/useDashboard.ts`, `src/hooks/use-visibility-polling.ts` |
| `useMemo` en tour | `src/components/tour/tour-context.tsx` |
| Keys y money helpers | `src/components/pedido/product-card.tsx`, `src/components/ventas/sales-terminal.tsx` |
| Empty states | `src/app/(panel)/productos/page.tsx`, `src/components/stock/stock-list.tsx`, `src/components/ventas/sales-history.tsx`, `src/components/caja/caja-history.tsx` |
| `chatMessageContentSchema` en uploads | `src/app/api/public/pedido/[id]/chat/upload/route.ts`, `src/app/api/pedidos/[id]/chat/upload/route.ts` |
| Capas en app | `src/app/(panel)/perfil/actions.ts`, `src/app/api/productos/imagen/[key]/route.ts` |
| Batching del cron de adjuntos | `src/app/api/cron/chat-attachments-cleanup/route.ts`, `src/repositories/orderMessageRepository.ts` |
| `data-testid` nuevos | `product-card.tsx` (`product-availability`), `cash-register-summary.tsx` (`cash-register-cash-total`, `cash-register-transfer-total`, `cash-register-sales-count`), `caja-history.tsx` (`cash-register-id-*`), `pedido-client.tsx` (`branch-phone`) |
|| Refactor incremental de tarjetas de producto | `src/components/productos/product-card-image.tsx`, `product-card-price.tsx`, `product-card-availability.tsx`, `product-card-recipe-included.tsx`, `product-card-sales-extra.tsx`, `src/components/pedido/product-card.tsx`, `src/components/ventas/sales-product-card.tsx` |
|| `data-testid` en `branch-form` | `src/components/sucursales/branch-form.tsx` |

### Tests
- 4 suites nuevas (+43 tests): `dashboard-client.test.tsx`, `video-player.test.tsx`, `csp-helpers.test.ts`, `product-image-upload-client.test.ts`.
- Tests ajustados: mocks de storage con magic bytes, repositorios refactorizados, selectores endurecidos (unitarios y `ventas-pago-mixto.spec.ts`, `pedido-sucursal-y-stock.spec.ts`).

### Documentación y configuración
| Cambio | Archivos |
|---|---|
| `daily_closures` fuera del truncate; `migrate` en producción; `start`/`test:accessibility` | `.devin/environment.yaml` |
| WhatsApp opcional; mínimos de intervalos; `BASE_URL`/`NO_GLOBAL_SETUP` | `.env.example`, `AGENTS.md`, `README.md` |
| `dotenv` sin override de valores vacíos | `playwright.config.ts`, `scripts/dev-e2e.ts` |
| `drizzle-kit migrate` en CI E2E | `.github/workflows/ci.yml` |
| Versiones `16.3.3` | `package.json`, `package-lock.json` |
|| `expire-orders` a GitHub Actions; dominio sin hardcodear | `.github/workflows/expire-orders.yml`, `vercel.json`, `README.md`, `AGENTS.md`, `.env.example`, `.devin/environment.yaml` |

## 7. Plan de acción priorizado — estado final

| Recomendación | Estado |
|---|---|
| Errores de dominio en `validateOpeningHours` | ✅ Resuelto |
| Mínimos en intervalos de caja | ✅ Resuelto |
| Refactor de servicios monolíticos | ✅ Resuelto (extracción de persistencia); división fina de `orderService`/`saleService`/`validateCartAvailability` queda como deuda futura |
| Tests de `dashboard-client`/`video-player`/`csp-helpers`/`product-image-upload-client` | ✅ Resuelto |
| `chatMessageContentSchema` en uploads | ✅ Resuelto |
| Magic bytes en uploads | ✅ Resuelto (con limitación documentada en presignados) |
| `orderBy` en `findFirst` | ✅ Resuelto |
| Imagen de `updateProduct` post-commit | ✅ Resuelto |
| `csp-helpers` → `src/config/*` | ✅ Resuelto |
| Empty states | ✅ Resuelto |
| Docs (`BASE_URL`, `NO_GLOBAL_SETUP`, WhatsApp opcional, mínimos) | ✅ Resuelto |
| Keys de `product-card` y money helpers en `sales-terminal` | ✅ Resuelto |
| Versiones `@next/*`/`eslint-config-next` | ✅ Resuelto (`16.3.3`) |
| CORS explícito | Informativo — sin acción (monolito) |
| Catálogo paginado en cliente | ✅ Resuelto — `/pedido` carga la primera página por SSR y el cliente trae el resto con "Cargar más" (`catalog-load-more`); `NEXT_PUBLIC_CATALOG_PAGE_SIZE` (default 48) |
| `data-testid` en `branch-form` | ✅ Resuelto
|| Consolidación `product-card`/`sales-product-card` | ✅ Resuelto — `ProductCardBase` con `variant="catalog" | "sales"` en `src/components/productos/product-card-base.tsx`; los wrappers delegan; selectores E2E intactos |
| División de `validateCartAvailability` | ✅ Resuelto — orquestador + 8 funciones puras exportadas en `product-helpers.ts` |

### Pendiente de ejecución
1. ✅ `npm run test:e2e` — re-ejecutado sobre `.env.e2e`: **110/110 tests pasaron** (18.1m; incluye accesibilidad axe-core, responsive, pagos mixtos, chat con adjuntos, expiración y aislamiento por sucursal).
2. ✅ `npx drizzle-kit check` — ejecutado sobre la base de `.env.e2e`: sin drift; esquema y migraciones consistentes.

## 8. Cierre

- Baseline: `99f05d65003edeecd3e49e27e15ddfdc9d4cee61` en `main` — merge de `fix/hallazgos-auditoria-2026-09-05` (commit `d9692bd`) completado.
- Verificaciones base ejecutadas sobre el estado final: `npm run lint`, `npx tsc --noEmit`, `npm test` (145 suites / 1425 tests), `npm run build` (73 rutas), `npm run knip` y `npm run test:e2e` (110/110 tests) — todas pasan.
- Última ronda sobre `main`: consolidación `ProductCardBase` con `variant="catalog" | "sales"`, división de `validateCartAvailability` en funciones puras y catálogo paginado con "Cargar más" (`NEXT_PUBLIC_CATALOG_PAGE_SIZE`, default 48). Re-verificación E2E parcial (`pedido`, `ventas-disponibilidad`, `ventas-pago-mixto`): **11/11 pasaron**.
- Sin cambios de esquema: no se generaron migraciones; `npx drizzle-kit check` sobre base de `.env.e2e` pasó sin drift.
- Índices `.devin` actualizados: prompt de implementación de hallazgos archivado en `prompts/archivados/` y READMEs actualizados.
- No se ejecutaron `npx tsx src/db/seeds.ts`, `npx drizzle-kit generate/push/migrate` ni `npx vercel env pull` por requerir confirmación explícita (el seed de la base E2E lo realizó `global-setup.ts` como parte del suite).

## 9. Seguimiento de auditoría — 2026-09-06

> Re-auditoría ejecutada sobre el baseline `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`, post-eliminación de WhatsApp y catálogo paginado).

### 9.1 Verificaciones base

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **144 suites, 1405 tests pasan** |
| `npm run build` | Build exitoso, 73 rutas/páginas |
| `npm run knip` | Pasa (sin exports/dependencias sin uso) |
| `npm run analyze` | Build OK; analizador sin salida bajo Turbopack (limitación conocida) |

> **Nota:** `npm run test:e2e` y `npx drizzle-kit check` no se re-ejecutaron en este seguimiento por requerir una base de datos descartable y confirmación explícita. El estado documentado en la sección 7 (`110/110 E2E` y `drizzle-kit check` OK) sigue vigente salvo cambios de esquema.

### 9.2 Áreas auditadas

| Área | Estado | Observaciones |
|---|---|---|
| Calidad de código y consistencia | OK | `lint`, `tsc`, `test`, `build` y `knip` pasan. Sin `TODO`/`FIXME` en `src/`. |
| Seguridad | OK | Sin credenciales/secretos hardcodeados. `process.env` centralizado en `src/config/*`. Rate limit, CSP, CRON secret y validación de archivos vigentes. |
| Arquitectura y deuda técnica | OK | Separación de capas mantenida. `findFirst` en repositorios filtra por IDs/constraints únicas o incluye `orderBy` donde puede haber duplicados. |
| Cobertura de pruebas | OK | 100% de rutas API, servicios y repositorios con tests. 34 specs E2E (~113 tests). 4 helpers triviales de `src/lib/` sin test unitario. |
| Documentación y variables de entorno | OK | `.env.example`, `AGENTS.md`, `README.md` y `environment.yaml` alineados; variables `NEXT_PUBLIC_WHATSAPP_*` eliminadas. |
| Rendimiento y bundle | Informativo | `npm run analyze` no genera reporte con Turbopack; alternativa es `next build --webpack`. Páginas públicas críticas siguen `dynamic = 'force-dynamic'`. |
| Accesibilidad y UX | OK | Suite `accessibility.spec.ts` en E2E; `data-testid` y estados vacíos mantenidos. |
| Integridad de datos y flujos de negocio | OK | No se detectaron regresiones en reservas, pagos mixtos, cierre de caja, expiración de pedidos ni snapshots. |
| Configuración de despliegue, CI/CD y entornos | OK | `ci.yml`, `playwright.config.ts`, `vercel.json`, `next.config.ts` y `package.json` sin cambios críticos. |

### 9.3 Hallazgos del seguimiento

No se detectaron hallazgos **críticos** ni **mayores** en este seguimiento.

| Hallazgo | Clasificación | Estado | Evidencia |
|---|---|---|---|
| Tests unitarios: 144 suites / 1405 tests | Menor | Ajuste de conteo | El informe anterior reportaba 145/1425; la diferencia (1 suite / ~20 tests) se debe a consolidación de casos o eliminación de un test obsoleto. Verificar intencionalidad. |
| `throw new Error` en hooks y componentes de cliente | Menor | Vigente | Los errores de fetch en hooks UI (`usePedidoClient.ts`, `useOrderChat.ts`, `sales-terminal.tsx`, etc.) usan `Error` genérico. No impactan el mapeo de códigos HTTP del servidor, pero podrían normalizarse con errores de dominio si se reutilizan en server actions. |
| Análisis de bundle | Informativo | Limitación conocida | `npm run analyze` no genera reporte bajo Turbopack; documentado en `AGENTS.md` y `.env.example`. |
| Helpers triviales sin test unitario | Informativo | Aceptado | `src/lib/last-customer-name.ts`, `last-customer-phone.ts`, `logger.ts`, `pagination.ts`, `product-style.ts` y `utils.ts` son wrappers simples sin lógica de negocio. |

### 9.4 Plan de acción

| Prioridad | Acción | Responsable sugerido |
|---|---|---|
| Baja | Confirmar que la reducción de 1 suite / ~20 tests unitarios fue intencional y documentar la suite eliminada. | Equipo de desarrollo |
| Baja | Evaluar si `throw new Error` en hooks de cliente se normalizan con errores de dominio o se mantienen con mensajes descriptivos. | Equipo de desarrollo |
| Baja | Ejecutar `npx drizzle-kit check` en base de E2E antes del próximo release si hay cambios de esquema. | Equipo de desarrollo |
| Baja | Ejecutar `next build --webpack` con `ANALYZE=true` si se requiere un informe detallado de bundle. | Equipo de desarrollo |

### 9.5 Cierre del seguimiento

- Baseline auditado: `c667f8835475a729dfc97eae05391effbc65f9ba`.
- Working tree limpio; sin cambios por commitear.
- Verificaciones base (`lint`, `tsc`, `test`, `build`, `knip`) pasan sobre el baseline actual.
- Sin pendientes críticos para el release. Las acciones restantes son de baja prioridad o informativas.

## 10. Consejos y recomendaciones detalladas

### 10.1 Diferencia de conteo de tests (145/1425 → 144/1405)

**Causa raíz**

La eliminación de la integración con WhatsApp en el commit `c667f88` borró `src/lib/whatsapp.test.ts` (192 líneas), que contenía aproximadamente 1 suite y ~20 tests. A su vez se agregaron/ajustaron tests del catálogo paginado y de `product-helpers`, pero el saldo neto bajó.

**Evidencia**

```bash
git diff --stat 99f05d6..c667f88 -- 'src/**/*.test.ts' 'src/**/*.test.tsx' 'tests/**/*.spec.ts'
```

Muestra:
- `src/lib/whatsapp.test.ts` eliminado.
- Nuevos tests: `src/components/productos/product-card-base.test.tsx`, `src/application/services/catalogService.test.ts`.
- Ajustes en `src/lib/product-helpers.test.ts` y `src/repositories/catalogRepository.test.ts`.

**Consejos**

1. **Confirmar intencionalidad en el próximo PR de refactor**: cuando se elimine una feature completa, documentar en el PR cuántas suites/tests se eliminan para que el reporte de estado quede coherente.
2. **Automatizar el conteo**: agregar en CI un paso que guarde el resultado de `npm test` como artifact (`test-results.json`), así las auditorías futuras pueden comparar sin ejecutar manualmente.
3. **No compensar con tests triviales**: si la suite eliminada era correcta (WhatsApp ya no existe), no es necesario agregar tests vacíos solo para mantener el número; priorizar cobertura de lógica de negocio.
4. **Verificar cobertura real**: correr `npx jest --coverage` periódicamente (semanal o antes de release) para detectar si la pérdida de tests impacta cobertura de ramas.

**Recomendación**

Marcar este punto como **resuelto documentalmente** una vez que se confirme que la baja fue intencional y se refleje en el próximo reporte de estado.

---

### 10.2 `throw new Error` en hooks y componentes de cliente

**Contexto**

Los hooks de cliente (`usePedidoClient.ts`, `useOrderChat.ts`, `usePedidoDetail.ts`, `sales-terminal.tsx`, etc.) usan el patrón:

```ts
if (!response.ok) {
  const data = await response.json();
  throw new Error(data.error ?? 'Error al ...');
}
```

capturado inmediatamente después por un `catch` para setear el estado de error. No hay Error Boundaries en el árbol que capturen estos errores.

**Riesgo actual**

- **Bajo**: el `throw`/`catch` es local y el usuario ve el mensaje adecuado en la UI.
- **Mantenimiento**: el patrón es redundante — se lanza un error solo para capturarlo una línea después. Un `if` directo es más simple y no genera stack traces falsos en `console.error` durante tests.
- **Consistencia**: en el servidor se usan errores de dominio (`NotFoundError`, `DomainError`, etc.); en el cliente no hay equivalente, lo que dificulta mockear estados de error en tests.

**Consejos**

1. **Preferir `if`/`else` sobre `throw`/`catch` interno** cuando el error se va a manejar en el mismo bloque:

   ```ts
   if (!response.ok) {
     const data = await response.json();
     setError(data.error ?? 'Error al cargar mensajes');
     return false;
   }
   ```

   Esto elimina el stack trace y hace el flujo explícito.

2. **Si se quiere propagar**, usar una función helper tipada que devuelva un `Result<T, E>`:

   ```ts
   type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
   ```

   Esto facilita tests y evita excepciones para control de flujo.

3. **Mantener `throw` solo para invariantes programáticas**: por ejemplo, `useTour` lanza `throw new Error('useTour debe usarse dentro de un TourProvider')` porque es un error de uso interno del desarrollador; ese caso está justificado.

4. **Suprimir ruido en tests**: si se mantienen los `throw`/`catch`, mockear `console.error` en los tests de hooks para no ensuciar la salida:

   ```ts
   const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
   afterAll(() => consoleSpy.mockRestore());
   ```

**Recomendación**

Revisar los 27 archivos con `throw new Error` en `src/components` y reemplazar los casos de fetch-control-de-flujo por manejo directo de error. Ejemplos de prioridad:
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/usePedidoDetail.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />

---

### 10.3 `npm run analyze` y el bundle analyzer

**Contexto**

`package.json` define:

```json
"analyze": "cross-env ANALYZE=true next build"
```

Next.js 16 usa Turbopack por defecto en `next build`, y `@next/bundle-analyzer` (basado en `webpack-bundle-analyzer`) **no genera el reporte HTML** con Turbopack.

**Verificación**

Se ejecutó `npm run analyze` y se confirmó que termina el build sin reporte.

Se ejecutó `ANALYZE=true next build --webpack` y generó correctamente:

- `.next/analyze/nodejs.html`
- `.next/analyze/edge.html`
- `.next/analyze/client.html`

**Consejos**

1. **Agregar un script alternativo** en `package.json` para no tener que recordar el flag:

   ```json
   "analyze:webpack": "cross-env ANALYZE=true next build --webpack"
   ```

2. **Documentar la limitación en `AGENTS.md` y `README.md`** con el comando correcto. `next.config.ts` ya tiene un comentario, pero los comandos principales del README solo listan `npm run analyze`.
3. **Programar análisis periódico**: antes de cada release importante, correr `npm run analyze:webpack` y revisar el bundle cliente. Si un chunk supera 200 KB parseados, evaluar lazy loading o `dynamic`.
4. **Ignorar `.next/analyze` en `.gitignore`**: verificar que el directorio `.next` ya esté ignorado (lo está por defecto en Next.js), porque los reportes HTML no deben commitearse.

**Observación adicional**

Bajo webpack apareció el warning:

```
./src/lib/storage.ts
Critical dependency: the request of a dependency is an expression
```

Esto se debe a los `await import(clientModuleName)` y `await import('@vercel/blob')` condicionales en <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" />. Es un patrón válido para evitar cargar SDKs no usados, pero webpack no puede determinar estáticamente el bundle. No es un error y no afecta el funcionamiento.

**Consejo adicional**

Si el warning genera ruido en CI, considerar agregar un comentario en `next.config.ts` o en `src/lib/storage.ts` explicando que es intencional, o bien centralizar los nombres de módulos en constantes tipadas:

```ts
const S3_CLIENT_MODULE = '@aws-sdk/client-s3' as const;
const S3_PRESIGNER_MODULE = '@aws-sdk/s3-presigned-post' as const;
```

Eso no elimina el warning de webpack, pero mejora la trazabilidad.

---

### 10.4 Helpers de `src/lib/` sin test unitario

**Inventario**

| Archivo | ¿Tiene test? | Complejidad | Recomendación |
|---|---|---|---|
| `last-customer-name.ts` | No | Baja (wrapper localStorage + trim) | Test opcional pero valioso para regresión. |
| `last-customer-phone.ts` | No | Baja (wrapper localStorage + trim + regex) | Test opcional. Verificar sanitización de espacios. |
| `logger.ts` | No | Media (producción vs dev vs test, serialización de Error) | Recomendado test; mockear `console` y `process.env.NODE_ENV`. |
| `pagination.ts` | No | Media (parse + clamp de page/limit) | **Recomendado test**; validar límites, NaN, valores negativos. |
| `product-style.ts` | No | Baja (records de clases Tailwind) | Test innecesario; son constantes. |
| `utils.ts` | No | Baja (`cn` de clsx + tailwind-merge) | Test innecesario; librería externa ya testeada. |

**Consejos**

1. **Prioridad 1 — `pagination.ts`**: la lógica de clamp y parseo es susceptible a valores maliciosos (`?page=-1&limit=99999`). Agregar `src/lib/pagination.test.ts` con casos de borde:

   - `page` no numérico, negativo, cero, decimal.
   - `limit` por debajo de `MIN_LIMIT`, por encima de `MAX_LIMIT`, NaN.
   - Ausencia de parámetros.

2. **Prioridad 2 — `logger.ts`**: mockear `console.*` y `isProduction`/`isTest` para verificar:

   - En `NODE_ENV=test` no se emite nada.
   - En producción y servidor se emite JSON.
   - En desarrollo se emite texto plano.
   - `logError` serializa `Error.message` y `Error.stack` sin exponer objetos completos.

3. **Prioridad 3 — localStorage helpers**: testear que:

   - Guardan y recuperan el valor.
   - Triman espacios.
   - `last-customer-phone` elimina espacios en el medio (`replace(/\s/g, '')`).
   - Eliminan la clave si el string queda vacío.
   - No fallan en SSR (cuando `window` no existe).

4. **No testear `product-style.ts` ni `utils.ts`**: son declaraciones o delegaciones. Si se agrega lógica condicional en `product-style.ts`, ahí sí revaluar.

**Recomendación**

Agregar tests para `pagination.ts`, `logger.ts` y, si hay tiempo, para los helpers de `localStorage`. Esto no solo cierra la brecha, sino que protege contra regresiones futuras en validaciones de entrada.

---

### 10.5 Plan de acción priorizado

| Prioridad | Acción | Archivos / comandos | Riesgo si no se hace |
|---|---|---|---|
| Media | Tests para `pagination.ts` | `src/lib/pagination.test.ts` | Entradas maliciosas o fuera de rango no detectadas. |
| Media | Tests para `logger.ts` | `src/lib/logger.test.ts` | Logs sensibles o ruido en producción/test. |
| Baja | Tests para `last-customer-*.ts` | `src/lib/last-customer-name.test.ts`, `src/lib/last-customer-phone.test.ts` | Regresiones menores de UX. |
| Baja | Reemplazar `throw`/`catch` local en hooks de cliente | `src/components/pedidos/usePedidoDetail.ts`, `src/components/pedido/usePedidoClient.ts`, `src/components/chat/useOrderChat.ts`, `src/components/ventas/sales-terminal.tsx`, etc. | Ruido en tests y peor legibilidad. |
| Baja | Agregar script `analyze:webpack` y documentar | `package.json`, `AGENTS.md`, `README.md` | Imposibilidad de auditar el bundle sin recordar el flag `--webpack`. |
| Baja | Documentar warning de `storage.ts` bajo webpack | `next.config.ts` o `src/lib/storage.ts` | Confusión en CI al ver warnings. |

### 10.6 Nota de cierre

Ninguno de estos puntos es bloqueante para un release. La mayoría son de baja prioridad y se centran en legibilidad, mantenibilidad y cobertura de tests. Los puntos de mayor impacto son los tests de `pagination.ts` y `logger.ts`, porque protegen contra entradas inválidas y filtraciones de información.

---

## 11. Re-verificación de auditoría — 2026-09-06 (segunda pasada)

> Segunda pasada de la auditoría masiva ejecutada sobre el mismo baseline `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`), con verificaciones base re-ejecutadas y análisis dirigido de las 9 áreas sobre `src/`, `tests/`, `.github/`, `next.config.ts`, `vercel.json` y `package.json`.

### 11.1 Verificaciones base (re-ejecutadas)

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **144 suites, 1405 tests pasan** |
| `npm run build` | Build exitoso, 73 rutas/páginas (`ƒ Proxy (Middleware)` detectado) |
| `npm run knip` | Pasa (sin exports/dependencias sin uso) |
| `npm run test:e2e` / `npx drizzle-kit check` | No re-ejecutados (requieren base descartable y confirmación); el estado de la sección 7 sigue vigente — sin cambios de esquema desde entonces |

Los resultados son **idénticos** a los documentados en la sección 9.1: no hay regresiones.

### 11.2 Falsos positivos descartados (verificados manualmente)

| Hallazgo reportado | Veredicto | Evidencia |
|---|---|---|
| "`src/proxy.ts` no se ejecuta porque falta `middleware.ts`" | **Falso positivo** | Next.js 16 renombró la convención `middleware.ts` → `proxy.ts`; el build lo detecta como `ƒ Proxy (Middleware)` y el CSP con nonce está activo. Documentado en `lecciones-aprendidas.md` §2. <ref_file file="C:/developer/paginas/pancheria/src/proxy.ts" /> |
| "`@base-ui/react` sin uso" | **Falso positivo** | Se importa en `src/components/ui/` (`input.tsx`, `dialog.tsx`, `select.tsx`, `button.tsx`, `badge.tsx`); `knip` confirma que no es dependencia huérfana. |
| "Dependencia E2E del seed = crítico" | **Reclasificado a informativo** | Diseño aceptado y documentado: `global-setup.ts` trunca tablas y re-seedea sobre una base descartable obligatoria. |
| "CSP no conectada / headers incompletos" | **Falso positivo** | La CSP se emite por request desde `src/proxy.ts` con nonce; `next.config.ts` agrega HSTS, X-Frame-Options, X-Content-Type-Options y Referrer-Policy. |

### 11.3 Áreas auditadas

| Área | Estado | Observaciones |
|---|---|---|
| 1. Calidad de código y consistencia | OK | `lint`, `tsc`, `test`, `build` y `knip` pasan. `src/lib/utils.ts` solo exporta `cn`. `withApiErrorHandling` mapea `NotFoundError`→404, `ForbiddenError`→403, `DomainError`/`ZodError`→400, `InsufficientStockError`→409, conexión→503. Sin `TODO`/`FIXME` reales en `src/`. |
| 2. Seguridad | OK | Sin credenciales ni URLs sensibles hardcodeadas. `process.env` centralizado en `src/config/*`. `withAuth` en rutas del panel (34 usos); rutas públicas intencionales (`api/public/**`, `api/auth/**`, `api/cron/**` con `CRON_SECRET` + `timingSafeEqual`). Rate limit con scopes separados y magic bytes en uploads vigentes. |
| 3. Arquitectura y deuda técnica | Advertencia menor | Varios servicios siguen accediendo a `db` directamente (ver 11.4). El refactor de persistencia fue incremental y documentado como tal. |
| 4. Cobertura de pruebas | OK con observaciones | 50/50 rutas API, 13/13 servicios, 11/11 repositorios, 5/5 configs con test. 6 helpers triviales de `src/lib/` sin test (ver 10.4). 34 specs E2E cubren los flujos críticos solicitados. |
| 5. Documentación y variables de entorno | OK | 87 variables únicas en código/configs; **todas documentadas** en `.env.example`/`.env.e2e.example`/`AGENTS.md`/`README.md`/`environment.yaml`. Defaults verificados uno a uno: coinciden. Sin variables stale (0 referencias a `WHATSAPP` en `src/`). |
| 6. Rendimiento y bundle | OK con observaciones | `force-dynamic` vigente en páginas públicas críticas. Sin N+1 nuevos (los `UPDATE` de stock por fila con guarda `gte` son intencionales). `use-paginated-data` mantiene un `setInterval` propio (ver 11.4). |
| 7. Accesibilidad y UX | OK | 209 usos de `aria-*`/`role`/`htmlFor` en `src/components`; `aria-pressed` en métodos de pago; `role="alert"` en errores; estados de carga/error/vacío cubiertos; tour por rol con `skipMissingElement` y `useMemo`. |
| 8. Integridad de datos y flujos de negocio | OK | Reservas solo al recibir el pedido; liberación solo desde `in_process`; expiración sin tocar stock; snapshots de receta propagados; FKs `restrict`/`cascade`/`set null` coherentes; transacciones reentrantes; imagen de `updateProduct` post-commit; pagos mixtos validados con `dinero.js`. |
| 9. Despliegue, CI/CD y entornos | OK | `ci.yml` con verificación de secrets y `drizzle-kit migrate`; `playwright.config.ts` con carga filtrada de `.env.e2e`; 2 crons en `vercel.json` + `expire-orders` en GitHub Actions; `.env*` ignorados salvo ejemplos; 28 migraciones (`0000`–`0027`) consistentes. |

### 11.4 Hallazgos nuevos (todos menores o informativos)

No se detectaron hallazgos **críticos** ni **mayores**.

| Hallazgo | Clasificación | Evidencia | Recomendación |
|---|---|---|---|
| `GET /api/ventas` consulta el repositorio directamente, sin pasar por `saleService` | Menor | <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" /> usa `saleRepository.findByCashRegisterId` y `findByDateRange` | Mover el listado a `saleService` para mantener la capa de aplicación como único punto de orquestación. |
| Persistencia directa en servicios restantes | Menor (deuda conocida) | `userService.ts`, `branchService.ts`, `authService.ts`, `summaryService.ts`, `recipeService.ts`, `stockService.ts` y `cashRegisterService.ts` importan `db` y ejecutan queries/`db.transaction` sin repositorios dedicados (`userRepository`/`branchRepository` no existen) | Continuar la extracción incremental de persistencia a repositorios, priorizando `branchService.deleteBranch` (transacción masiva de ~110 líneas). |
| `findByImageKey` sin `orderBy` | Informativo | <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" /> — es un chequeo de existencia; el orden no altera la semántica | Sin acción; documentado por si `imageKey` llega a ser compartido entre productos. |
| `use-paginated-data` con `setInterval` propio en lugar de `useVisibilityPolling` | Menor | <ref_file file="C:/developer/paginas/pancheria/src/hooks/use-paginated-data.ts" /> — su semántica es "saltar tick si oculto" vs "pausar/reanudar" del hook unificado | Evaluar migrar a `useVisibilityPolling` si se quiere una única fuente de polling por visibilidad. `use-clock-interval` es un reloj de UI, no polling de datos: separación justificada. |
| Fragilidad de selectores E2E | Menor | ~64 `data-testid` vs ~493 `getByText`/`getByRole`/`locator` en `tests/e2e/` (ej. `login.spec.ts`, `productos-y-recetas.spec.ts`, `tour.spec.ts`) | Migración incremental ya en curso; priorizar specs con textos propensos a cambios de copy. |
| ~47 componentes sin test unitario | Informativo | `src/components/**` — la mayoría son wrappers/presentacionales cubiertos por E2E (21 `.test.tsx` existentes) | Sin acción obligatoria; priorizar tests unitarios en componentes con lógica de estado no trivial. |
| `process.env` directo en configs de raíz | Informativo | `next.config.ts`, `playwright.config.ts`, `scripts/drizzle-baseline.ts` — excepciones justificadas (los archivos de config de raíz no pueden depender del pipeline de `src/config` en todos los casos; `storage-origins.ts` es la excepción autocontenida documentada) | Sin acción; ya documentado. |
| Placeholders locales en archivos de ejemplo/históricos | Informativo | `.env.e2e.example` incluye `postgresql://postgres:postgres@localhost:5432/...` (comentario de ejemplo local) y `CRON_SECRET` con valor de ejemplo explícitamente marcado "no usar en producción"; informe archivado `plan-de-accion-2026-08-27.md` repite la URL local | Aceptable: son placeholders locales descartables, no credenciales reales. No se modifican archivos históricos. |
| `video-form.tsx` usa `setInterval` propio para progreso de subida | Informativo | <ref_file file="C:/developer/paginas/pancheria/src/components/videos/video-form.tsx" /> — intervalo de corta duración, local al componente, con cleanup | Sin acción. |

### 11.5 Plan de acción actualizado

| Prioridad | Acción |
|---|---|
| Media | Tests unitarios para `pagination.ts` y `logger.ts` (ver 10.4). |
| Baja | Mover el listado de `GET /api/ventas` a `saleService`. |
| Baja | Migrar `saveRecipe` y `deleteBranch` de `db.transaction` a `executeInTransaction` (riesgo latente de anidamiento, ver 12.2). |
| Baja | Continuar extracción de persistencia a repositorios en `branchService`, `userService`, `authService`, `cashRegisterService` y `recipeService` (inventario exacto en 12.2; `summaryService`/`stockService`/`saleService`/`orderService`/`productService`/`chatService` ya están limpios). |
| Baja | Migración incremental de `getByText`/`locator` a `data-testid` (~220 migrables; `getByRole` es correcto y los selectores de driver.js no migran, ver 12.4). |
| Baja | Evaluar `useVisibilityPolling` en `use-paginated-data` (mejora resume, ver 12.3); script `analyze:webpack` y documentación del warning de `storage.ts` (ver 10.3). |
| Baja | Tests para helpers `last-customer-*` (ver 10.4); normalización de `throw new Error` en hooks de cliente (ver 10.2). |
| Baja | Re-ejecutar `npm run test:e2e` y `npx drizzle-kit check` sobre la base de `.env.e2e` antes del próximo release o si hay cambios de esquema. |

### 11.6 Cierre de la re-verificación

- Baseline auditado: `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`).
- Verificaciones base re-ejecutadas con resultados idénticos a la sección 9.1: **sin regresiones**.
- Hallazgos clasificados: 0 críticos, 0 mayores, 4 menores, 5 informativos.
- No se modificaron archivos de negocio, configuración ni documentación salvo este informe.
- No se ejecutaron `npm run test:e2e`, `npx drizzle-kit check/generate/push/migrate`, `npx tsx src/db/seeds.ts` ni `npx vercel env pull` por requerir confirmación explícita y base descartable.
- Índices `.devin` sin cambios: no se crearon ni archivaron prompts o informes en esta pasada.

---

## 12. Auditoría profunda de los hallazgos menores/informativos (2026-09-06)

> Análisis detallado de cada hallazgo de la sección 11.4 con evidencia de código. Metodología: inspección directa de llamadores, inventario exhaustivo por patrón y verificación de semántica.

### 12.1 Rutas API que llaman repositorios directamente

**Inventario completo** — 6 rutas productivas importan `@/repositories/*`:

| Ruta | Repositorio | Naturaleza | Evaluación |
|---|---|---|---|
| `src/app/api/ventas/route.ts` (GET) | `saleRepository` (`findByCashRegisterId`, `findByDateRange`) | Listado de negocio | **Inconsistencia real**: es el único listado de negocio que salta la capa de servicios. |
| `src/app/api/productos/imagen/[key]/route.ts` | `productRepository.findByImageKey` | Servir archivo público con validación | Pragmático: lookup de existencia + guarda `product.id !== productId` + `isPublicSellableProduct`. |
| `src/app/api/productos/imagen/upload/route.ts` | `productRepository` | Validación en upload | Pragmático. |
| `src/app/api/productos/imagen/preparar/route.ts` | `productRepository` | Preparación de subida | Pragmático. |
| `src/app/api/chat/attachment/[key]/route.ts` | `orderRepository` | Servir adjunto con auth propia por token | Pragmático. |
| `src/app/api/cron/chat-attachments-cleanup/route.ts` | `orderMessageRepository` | Limpieza batch en cron | Pragmático: los crons operan a nivel repositorio por diseño. |

**Conclusión:** 5 de 6 son servicio de archivos/cron donde el acceso directo es razonable. Solo `GET /api/ventas` amerita mover el listado a `saleService` (p. ej. `listSales`/`listSalesByCashRegister`) por consistencia de capas. **Clasificación: menor.** <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" />

### 12.2 Persistencia directa con `db` en servicios — inventario exacto

Grep exhaustivo de `db\.(query|insert|update|delete|transaction|select)` en `src/application/services/` (excluyendo tests):

| Servicio | Accesos directos | Detalle |
|---|---|---|
| `userService.ts` | 6 | `db.query.users` ×5 (líneas 17, 51, 86, 103, 152, 171) + `db.delete` (línea 164, `deleteUser`). `updatePassword` **sí** usa `executeInTransaction` + `tx` correctamente (líneas 182–204). |
| `branchService.ts` | 8 | `db.query.branches` ×7 (líneas 26, 32, 47, 84, 98, 126, 220) + **`db.transaction`** en `deleteBranch` (línea 281, cascada multi-tabla de ~110 líneas). |
| `authService.ts` | 1 | `db.query.users.findFirst` (línea 43, lookup de login). |
| `cashRegisterService.ts` | 1 | `db.query.products.findMany` (línea 183, insumos críticos activos). |
| `recipeService.ts` | 1 | **`db.transaction`** en `saveRecipe` (línea 86). |

**Limpios (falsos positivos del reporte preliminar):** `summaryService`, `stockService`, `saleService`, `orderService`, `productService` y `chatService` importan `db` solo como tipo (`typeof db` en parámetros `tx`/`dbOrTx`) o lo pasan explícitamente a repositorios (`recipeRepository.findBySupplyId(db, id)` en `productService.ts:190`). No ejecutan queries directas.

**Sub-hallazgo relevante — `db.transaction` vs `executeInTransaction`:** `recipeService.saveRecipe` y `branchService.deleteBranch` usan `db.transaction`, que **siempre abre una transacción física nueva**, mientras `executeInTransaction` (AsyncLocalStorage en `transactionService.ts`) reutiliza la transacción activa. Verificación de llamadores: `saveRecipe` solo se invoca desde `POST /api/recetas` y `deleteBranch` solo desde `deleteBranchAction` (server action) — ambos de nivel superior, **sin anidamiento actual, no hay bug activo**. Riesgo latente: si un refactor futuro los compone dentro de otra transacción, las escrituras internas escaparían a la atomicidad del padre. Recomendación: migrar ambos a `executeInTransaction` por uniformidad.

**Clasificación: menor (deuda de capas incremental, ya documentada).** Prioridad sugerida de extracción: `branchService` (`db.transaction` + cascada masiva) → `userService` → `authService` → `recipeService` → `cashRegisterService`.

### 12.3 `use-paginated-data` vs `useVisibilityPolling`

**Uso real del intervalo:** de los 4 consumidores (`sales-history`, `stock-history`, `use-cash-register-history`, `pedidos-list`), **solo `pedidos-list` pasa `refreshIntervalMs`** (`getPedidosRefreshIntervalMs()`, deshabilitado por defecto con `0`, mínimo 10 s si se habilita — `src/config/orders.ts:40-49`). En los otros tres el `setInterval` nunca se crea.

**Diferencia semántica:**
- `use-paginated-data`: el intervalo **sigue corriendo** pero omite el tick cuando `document.visibilityState === 'hidden'`; al volver a visible **no hay refresco inmediato** (espera hasta el próximo tick). Además el intervalo vive dentro del `useEffect` de carga, por lo que se recrea en cada `refresh`/cambio de página.
- `useVisibilityPolling`: **pausa** el intervalo al ocultar y al reanudar ejecuta `onResume` + callback inmediato antes de reiniciar.

**Evaluación:** migrar es factible (`refresh` ya es `useCallback` estable; bastaría `useVisibilityPolling(refresh, intervalMs, intervalMs > 0, false)`) y además **mejoraría la UX** con refresco inmediato al volver a la pestaña. Impacto actual: bajo (polling deshabilitado por defecto; si se habilita, el dato puede quedar hasta un intervalo desactualizado tras volver a la pestaña). `use-clock-interval` queda descartado del hallazgo: es un reloj de UI, no polling de datos. **Clasificación: menor.** <ref_file file="C:/developer/paginas/pancheria/src/hooks/use-paginated-data.ts" />

### 12.4 Fragilidad de selectores E2E — medición precisa

Conteo por tipo en los 34 specs (`tests/e2e/*.spec.ts`):

| Tipo | Total | Fragilidad real |
|---|---|---|
| `getByTestId`/`data-testid` | 221 | Robusto |
| `getByRole` | 223 | **No frágil** — patrón recomendado por Playwright (accesibilidad primero) |
| `getByText` | 121 | Frágil ante cambios de copy |
| `locator(...)` | 146 | Frágil si apunta a clases/ids; parte es inevitable |

**Corrección al hallazgo preliminar:** el total "frágil" real es **267** (`getByText` + `locator`), no ~490, porque `getByRole` es una buena práctica.

**Specs más expuestos** (getByText + locator): `productos-y-recetas` (33), `tour` (22), `pedido` (23), `roles-y-sucursales` (19), `ventas-disponibilidad` (21), `pedido-sucursal-y-stock` (18).

**Fragilidad justificada:** `tour.spec.ts` (22 `locator`) y `prod-login-and-tour.spec.ts` apuntan al DOM interno de driver.js (`.driver-popover*`), que no admite `data-testid`; `responsive.spec.ts` usa selectores de estructura. Eso deja ~220 selectores migrables.

**Recomendación:** migración incremental priorizando `getByText` con copy literal (`login.spec.ts:11` `'Usuario o contraseña incorrectos.'`, `caja-aislamiento-y-trazabilidad` `'Abierta por:'`) y `locator` con ids/clases propios (`productos-y-recetas` `#isActive`, `#promo-price`; `paso3` `nav`). No migrar selectores de driver.js. **Clasificación: menor.**

### 12.5 `findByImageKey` sin `orderBy` — resuelto

Único llamador: `src/app/api/productos/imagen/[key]/route.ts:32`. La clave de imagen **embebe el ID del producto** (`extractProductIdFromKey`, formato `products/{id}/...`) y la ruta verifica `product.id !== productId` → 404. Como `productId` es único, dos productos no pueden compartir la misma clave: el `findFirst` es determinista de facto y `orderBy` sería ruido. **Clasificación: informativo — cerrado, sin acción.**

### 12.6 `process.env` en configs de raíz — resuelto

`next.config.ts` lee `NODE_ENV` (compresión y HSTS condicional) y `ANALYZE` (bundle analyzer); `playwright.config.ts` y `scripts/drizzle-baseline.ts` leen variables de entorno de tooling. Estos archivos **se evalúan fuera del runtime de la app** (build/test config) y no pueden depender de path aliases — aun así `next.config.ts` ya importa `./src/config/storage-origins` y `./src/config/product-images` con rutas relativas, lo que demuestra que la centralización se aplica donde es posible. La regla del proyecto apunta al código de runtime, no al bootstrap de configuración. **Clasificación: informativo — cerrado, sin acción.**

### 12.7 Placeholders en `.env.e2e.example` y doc archivada — resuelto

- `.env.e2e.example:9` contiene `postgresql://postgres:postgres@localhost:5432/pancheria_e2e` **en un comentario** como ejemplo local; la variable `DATABASE_URL` está vacía.
- `.env.e2e.example:87` define `CRON_SECRET=un_secreto_largo_para_e2e_no_usar_en_produccion` — valor de ejemplo explícitamente etiquetado y **funcionalmente necesario** (los specs de expiración requieren un `CRON_SECRET` no vacío en local).
- `archivados/plan-de-accion-2026-08-27.md` repite la URL local (registro histórico; no se editan informes archivados).

Ninguno es una credencial real ni apunta a producción. **Clasificación: informativo — cerrado, sin acción.**

### 12.8 `setInterval` en `video-form.tsx` — resuelto

`video-form.tsx:494-500` crea un `setInterval` de **progreso simulado** (avanza 5% cada 500 ms hasta 90%) mientras dura la subida del archivo, con cleanup en `finally`. Es un timer de UX local al componente y de vida corta, no polling de datos ni dependiente de visibilidad. **Clasificación: informativo — cerrado, sin acción.**

### 12.9 Síntesis de la auditoría profunda

| Hallazgo original | Resultado del análisis | Clasificación final |
|---|---|---|
| `GET /api/ventas` → `saleRepository` | Confirmado; es el único listado de negocio sin servicio (las otras 5 rutas son servir archivos/cron, justificadas) | Menor |
| `db` directo en 7 servicios | Acotado a 5 servicios reales (16 accesos); `summaryService`/`stockService`/`saleService`/`orderService`/`productService`/`chatService` están limpios | Menor |
| `db.transaction` no reentrante | Confirmado en `saveRecipe` y `deleteBranch`; sin anidamiento actual → riesgo latente | Menor |
| `use-paginated-data` intervalo propio | Confirmado; solo activo en `pedidos-list` y deshabilitado por defecto; migración mejoraría resume | Menor |
| Selectores E2E frágiles | Recontados: 267 reales (121 `getByText` + 146 `locator`); `getByRole` (223) es buena práctica; ~45 de driver.js no migrables | Menor |
| `findByImageKey` sin `orderBy` | Determinista por diseño (clave embebe `productId` + guarda de igualdad) | Informativo — cerrado |
| `process.env` en configs de raíz | Justificado (bootstrap de build/test, fuera del runtime) | Informativo — cerrado |
| Placeholders locales en ejemplos | Sin credenciales reales; etiquetados "no usar en producción" | Informativo — cerrado |
| `setInterval` en `video-form` | Progreso simulado local, con cleanup | Informativo — cerrado |

**Acciones concretas derivadas** (para el plan, por orden de valor/esfuerzo):

1. Migrar `saveRecipe` y `deleteBranch` a `executeInTransaction` (cambio de una línea por archivo, elimina el riesgo latente de anidamiento).
2. Mover el listado de `GET /api/ventas` a `saleService` (`listSales`/`listSalesByCashRegister`).
3. Extraer `userRepository`/`branchRepository` en la próxima iteración del refactor de persistencia.
4. Migrar `use-paginated-data` a `useVisibilityPolling` (habilita refresco inmediato al reanudar la pestaña).
5. Migración incremental de `getByText`/`locator` a `data-testid`, empezando por `productos-y-recetas`, `pedido` y `ventas-disponibilidad`.

Ninguna acción es bloqueante; todas son de deuda técnica de bajo riesgo.

---

## 13. Implementación de las acciones derivadas — 2026-09-06

Las cinco acciones de la sección 12.9 fueron implementadas en el working tree. Resultado: **cero accesos directos a `db` en `src/application/services/`** (verificado con búsqueda de `db.select/insert/update/delete/transaction` y `db.query.*` sobre los archivos de servicio, excluyendo tests).

### 13.1 Arquitectura: repositorios y transacciones

| Cambio | Archivos |
|---|---|
| Nuevo `userRepository` (`findAll`, `findById`, `findByUsername`, `findByUsernameWithBranch`, `findByUsernameExcludingId`, `insert`, `update`, `deleteById`) con `resolveClient` que respeta `dbOrTx` y `getCurrentTransaction()` | `src/repositories/userRepository.ts` (nuevo) |
| Nuevo `branchRepository` con CRUD, consultas de impacto (`countBranchDeletionImpact`, `findProductIdsByBranch`, `findUsernamesByBranch`, `findOrderIdsByBranch`, `findAttachmentKeysByOrderIds`, `findVideoFileUrlsByBranch`, `findProductImageKeysByBranch`) y `deleteCascade(tx, ...)` | `src/repositories/branchRepository.ts` (nuevo) |
| `authService`, `userService` y `branchService` delegan toda la persistencia a los repositorios; `deleteBranch` pasó de `db.transaction` a `executeInTransaction` | `src/application/services/authService.ts`, `userService.ts`, `branchService.ts` |
| `recipeService.saveRecipe` pasó de `db.transaction` a `executeInTransaction` y delega en `recipeRepository.deleteByCompoundProductId` + nuevo `recipeRepository.insertMany` | `src/application/services/recipeService.ts`, `src/repositories/recipeRepository.ts` |
| `cashRegisterService` dejó la consulta directa de insumos críticos; usa el nuevo `productRepository.findActiveCriticalSupplies` | `src/application/services/cashRegisterService.ts`, `src/repositories/productRepository.ts` |
| `summaryService` delega la carga de recetas/productos en repositorios | `src/application/services/summaryService.ts` |
| `GET /api/ventas` ya no importa `saleRepository`; delega en las nuevas `saleService.listSalesByCashRegister` y `saleService.listSalesByDateRange`, que a su vez llaman a `saleRepository.findActiveWithDetailsByCashRegister` (nuevo) | `src/app/api/ventas/route.ts`, `src/application/services/saleService.ts`, `src/repositories/saleRepository.ts` |

Tests actualizados por el refactor: `recipeService.test.ts`, `cashRegisterService.test.ts` (mock de `transactionService` con `getCurrentTransaction`), `route.test.ts` de ventas (mocks ahora sobre `saleService`).

### 13.2 Polling unificado

`use-paginated-data.ts` eliminó su `setInterval` propio y ahora usa `useVisibilityPolling(refresh, refreshIntervalMs, enabled, /* immediate */ false)`. Se pasa `immediate: false` porque el efecto de carga ya dispara el fetch inicial. Beneficio adicional sobre la implementación anterior: el intervalo se detiene por completo con la pestaña oculta y ejecuta un refresh inmediato al volver a visible. Los 9 tests del hook siguen en verde.

### 13.3 Selectores E2E → `data-testid` (incremento aplicado)

Se migraron los selectores frágiles (`getByText` de copy literal y `locator` por tag/id/atributo) en **12 specs** y se agregaron `data-testid` en **19 componentes/páginas**. Se conservaron: `getByRole` (patrón accesible recomendado), `getByText` dentro de elementos ya anclados por `data-testid`/`data-product-name`, selectores de `driver.js` (DOM interno del paquete) y textos dinámicos generados en runtime. Los atributos `data-tour` se mantienen intactos (el tour interactivo los usa). El suite E2E se ejecutó posteriormente con resultado 110/110 (ver 13.6).

### 13.4 Tests nuevos y tooling

- 4 suites nuevas de helpers: `src/lib/pagination.test.ts`, `logger.test.ts`, `last-customer-name.test.ts`, `last-customer-phone.test.ts` (39 tests). En `logger.test.ts` se usa `jest.replaceProperty` para `process.env.NODE_ENV` (propiedad de solo lectura en los tipos de Node).
- Nuevo script `analyze:webpack` (`cross-env ANALYZE=true next build --webpack`) en `package.json`; documentado en `AGENTS.md` y `README.md`.
- Comentario en `src/lib/storage.ts` explicando que los `await import` con nombre de módulo en variable son intencionales y que el warning de webpack (`Critical dependency: the request of a dependency is an expression`) es esperado.

### 13.5 Verificaciones finales (post-implementación)

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **148 suites, 1444 tests** (antes 144/1405; +4 suites / +39 tests nuevos) |
| `npm run build` | Build exitoso, 73 rutas/páginas, `ƒ Proxy (Middleware)` presente |
| `npm run knip` | Pasa (se eliminaron los tipos `UserRow`/`BranchRow` sin uso que marcó inicialmente) |
| `npm run test:e2e` | **110/110 tests en verde** (autorizado por el usuario contra la base descartable de `.env.e2e`, nombre `*_e2e` validado por `global-setup.ts`) |
| `npx drizzle-kit check` | No ejecutado — sin cambios de esquema en esta iteración |

### 13.6 Resultado E2E y corrección posterior

La corrida completa arrojó **109/110** con un único fallo en `roles-y-sucursales.spec.ts` ("crear, editar y eliminar un usuario operador"): la migración había cambiado `locator('#password')` por `getByLabel('Contraseña')`, que en `/usuarios` resuelve dos elementos (el input y el botón `aria-label="Mostrar contraseña"` del `user-form`), y `getByLabel('Sucursal')` era ambiguo con el combobox "Sucursal activa" del header. Se corrigió con selectores de rol únicos (`getByRole('textbox', { name: 'Contraseña' })` y `getByRole('combobox', { name: 'Sucursal', exact: true })`); la re-corrida del spec pasó **12/12**. Resultado efectivo: **110/110 E2E en verde**, sin regresiones de negocio.

### 13.7 Estado final de hallazgos

Todos los hallazgos menores de la auditoría profunda quedaron **implementados o cerrados** y el suite E2E completo valida los selectores migrados y la refactorización de servicios sin regresiones. La migración de selectores continúa siendo incremental para los `getByText`/`locator` restantes no priorizados.

---

## 14. Segundo incremento — 2026-09-06 (pendientes de baja prioridad)

Se completaron los dos pendientes restantes: la migración incremental de selectores E2E categoría "migrable" y la normalización de errores en cliente.

### 14.1 Normalización de `throw new Error` en cliente → `ApiError`

Se agregaron a `src/lib/fetch.ts`:

- `ApiError` — error de respuesta HTTP que conserva `status` (permite a la UI reaccionar por código, p. ej. 401/409).
- `throwApiError(response, fallback)` — lee el campo `error` del body JSON y lanza `ApiError` con ese mensaje (o el `fallback` si el body no lo trae o no es JSON).

Se migraron **~45 sitios** en 17 archivos de cliente (`useDashboard`, `useCashRegister`, `usePedidoClient`, `usePedidoDetail`, `useOrderChat`, `use-cash-register-history`, `stock-list`, `stock-history`, `caja-history`, `cash-register-detail-actions`, `sales-terminal`, `sales-history`, `pedidos-list`, `promo-form`, `product-form`, `order-tracker`, `video-form`, `product-image-upload-client`). Donde el body ya estaba consumido se usa `ApiError` directamente conservando `response.status`.

**Efecto adicional:** los sitios que antes descartaban el `error` del body del servidor ahora lo propagan (mensajes de error más fieles al backend).

**Casos que quedan como `Error` genérico (justificados):** `tour-context` (invariante de programación, no es HTTP), `order-tracker`/`video-form`/`product-image-upload-client` (condiciones sin respuesta HTTP fallida: "pedido no encontrado", "URL pública no obtenida").

**Ajustes de tests:** `product-image-upload-client.test.ts` (mock de `@/lib/fetch` ahora usa `requireActual` para exponer `throwApiError` real) y `stock-list.test.tsx` (la expectativa ahora refleja que el mensaje del servidor se propaga).

### 14.2 Migración de selectores E2E — segunda pasada

El inventario clasificó 218 selectores restantes: **45 migrables** (categoría A), 30 anclados, 47 dinámicos, 96 estructurales/ARIA/driver.js — estos últimos justificados y no migrables.

Se migraron los **45 migrables** en 13 specs + `helpers.ts`. Nuevos `data-testid` en componentes: `order-status` (+`data-status`) en `pedido-header`, `cancel-order-button` en `pedido-actions`, `order-success-title` en `pedido-success-dialog`, `chat-title` en `chat-message-list`, `user-password-input`/`user-branch-select` en `user-form`, `video-file-ready` en `video-form`, `video-player`/`video-source` en `video-player`. Las tablas de `responsive.spec.ts` migraron a `getByRole('table')` (patrón accesible, sin tocar componentes). Los textos 'Confirmando...'/'Cancelando...' quedaron anidados dentro de los botones con testid (`getByTestId(...).getByText(...)`), robustos aunque el botón se desmonte.

**Fallo posterior y corrección:** la primera re-corrida E2E arrojó 109/110 — en `pedido-reserva-flujo.spec.ts` se eliminó accidentalmente el `click` en "Finalizar pedido" al reemplazar la aserción (el badge quedaba en 'Pagado'). Se restauró el click; re-corrida del spec: **3/3 en verde** junto a `pedido-cancelacion-panel`. Resultado efectivo: **110/110 E2E**.

### 14.3 `drizzle-kit check`

**No aplica esta iteración:** `git diff` sobre `src/db/schema.ts` y `drizzle/` no muestra cambios de esquema ni de migraciones. Queda como paso previo a release solo cuando haya cambios de esquema.

### 14.4 Verificaciones del segundo incremento

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores |
| `npx tsc --noEmit` | Limpio |
| `npm test` | **148 suites / 1444 tests** en verde |
| `npm run test:e2e` | **110/110** (tras corrección del click eliminado; verificado con re-corrida del spec afectado) |
| `npm run knip` | Limpio (verificado en el incremento anterior; los nuevos exports `ApiError`/`throwApiError` están en uso) |

**Estado:** no quedan pendientes abiertos de la auditoría. Los selectores restantes (`getByText`/`locator` anclados, dinámicos o de `driver.js`) están justificados y no requieren acción.

---

## 15. Auditoría del estado actual y sincronización de documentación — 2026-09-06

> Ejecutada a partir del prompt `.devin/prompts/auditoria-estado-actual-y-documentacion.md` sobre el mismo baseline `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`), con el working tree del 2026-09-06.

### 15.1 Verificaciones base (re-ejecutadas)

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores, 0 advertencias |
| `npx tsc --noEmit` | Limpio |
| `npm test` | **148 suites / 1444 tests** en verde |
| `npm run build` | Build exitoso; rutas/páginas dinámicas y proxy detectados |
| `npm run knip` | Limpio |

> `npm run test:e2e` y `npx drizzle-kit check` no se re-ejecutaron en esta pasada por requerir una base de datos descartable y confirmación explícita. El estado de 110/110 E2E y esquema consistente reportado en secciones anteriores sigue vigente salvo cambios de esquema.

### 15.2 Áreas auditadas

| Área | Estado | Observaciones |
|---|---|---|
| Calidad de código y consistencia | OK | `lint`, `tsc`, `test`, `build` y `knip` pasan sobre el working tree. |
| Seguridad | OK | Sin credenciales hardcodeadas en `src/`. `process.env` centralizado en `src/config/*`. |
| Arquitectura y deuda técnica | OK | Nuevos repositorios (`userRepository`, `branchRepository`) y uso de `executeInTransaction` en `recipeService`/`branchService` confirman la separación de capas descripta en sección 13. |
| Cobertura de pruebas | OK | 148 suites / 1444 tests. Nuevos tests de `pagination`, `logger`, `last-customer-name` y `last-customer-phone` en verde. |
| Documentación y variables de entorno | Menor | `.env.example`, `AGENTS.md`, `README.md` alineados. `.devin/environment.yaml` no documentaba `analyze:webpack` ni el comportamiento del analyzer bajo Turbopack (corregido en esta pasada). |
| Rendimiento y bundle | OK | `force-dynamic` vigente en páginas públicas. `npm run analyze:webpack` documentado y funcional. |
| Accesibilidad y UX | OK | Selectores migrados a `data-testid`/`getByRole` en sección 14. |
| Integridad de datos y flujos de negocio | OK | No se detectaron regresiones. Flujos críticos cubiertos por tests. |
| Configuración de despliegue, CI/CD y entornos | OK | `ci.yml`, `playwright.config.ts`, `vercel.json`, `next.config.ts` y `package.json` consistentes con el working tree. |

### 15.3 Hallazgos de la auditoría

No se detectaron hallazgos **críticos** ni **mayores**.

| Hallazgo | Clasificación | Evidencia | Recomendación |
|---|---|---|---|
| `environment.yaml` sin documentación de `analyze:webpack` | Menor | <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" /> (sección `build`) no mencionaba `npm run analyze:webpack` ni la limitación de Turbopack | Agregar sección `analyze` en `.devin/environment.yaml` con el propósito de cada script. **Corregido en esta pasada.** |
| Variables `NEXT_PUBLIC_WHATSAPP_*` en `.env.local` | Informativo | `.env.local` contenía `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` y `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING`; el código ya no las consume | ✅ Resuelto: variables eliminadas de `.env.local` (sección 16). |
| ~~`.env.e2e` no existe~~ → existe pero con variable huérfana | Informativo | `.env.e2e` ya existe en el working tree y conservaba `NEXT_PUBLIC_WHATSAPP_NUMBER`, que el código ya no consume (`.env.e2e.example` está limpio) | ✅ Resuelto: se eliminó `NEXT_PUBLIC_WHATSAPP_NUMBER` de `.env.e2e` junto con las 3 variables `NEXT_PUBLIC_WHATSAPP_*` huérfanas de `.env.local`. |
| Solapamiento entre prompts de auditoría y documentación | Informativo | `.devin/prompts/auditoria-y-documentacion.md` y `.devin/prompts/auditoria-estado-actual-y-documentacion.md` cubren tareas similares | ✅ Resuelto: se mantienen ambos diferenciados por contexto de uso; nota aclaratoria agregada en `prompts/README.md` (sección 16). |

### 15.4 Acciones correctivas aplicadas

- Se agregó la sección `analyze` en `.devin/environment.yaml` documentando `npm run analyze`, su limitación bajo Turbopack y la alternativa `npm run analyze:webpack`.
- Se actualizaron los índices `.devin/README.md` y `.devin/prompts/README.md` con el nuevo prompt `auditoria-estado-actual-y-documentacion.md`.
- No se modificaron archivos de negocio.

### 15.5 Cierre

- Baseline auditado: `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`) con working tree del 2026-09-06.
- Verificaciones base (`lint`, `tsc`, `test`, `build`, `knip`) pasan sobre el working tree actual.
- Documentación prioritaria (`reporte-estado.md`, `auditoria-masiva.md`, `auditoria-masiva-resumen.md`) refleja el estado del proyecto. Se detectó y corrigió una omisión menor en `.devin/environment.yaml`.
- No quedan hallazgos abiertos de la auditoría.

---

## 16. Auditoría y limpieza del directorio `.devin` — 2026-09-06

> Auditoría dirigida exclusivamente a `.devin` (estructura, índices, blueprint e informes), sobre el mismo baseline `c667f8835475a729dfc97eae05391effbc65f9ba` (`main`).

### 16.1 Alcance y método

- Inventario completo de `.devin/` (42 archivos Markdown + `environment.yaml`).
- Verificación de enlaces internos relativos en todos los Markdown: **sin enlaces rotos**.
- Cruzado de `environment.yaml` con `package.json`, `AGENTS.md` y la documentación oficial de blueprints de Devin (secciones `initialize`/`maintenance`/`knowledge`).

### 16.2 Hallazgos y correcciones aplicadas

| Hallazgo | Clasificación | Acción |
|---|---|---|
| Entrada `knowledge` con `name: e2e` duplicada en `environment.yaml` | Menor | **Corregido:** se fusionaron ambas entradas en una sola, conservando la lista de tablas truncadas por `global-setup.ts`. |
| Bloque "Estructura" de `.devin/README.md` sin `auditoria-masiva.md` ni `auditoria-masiva-resumen.md` | Menor | **Corregido:** índice actualizado. |
| Hallazgo 15.3 "`.env.e2e` no existe" desactualizado | Menor | **Corregido:** `.env.e2e` existe; se actualizó la fila indicando que conserva `NEXT_PUBLIC_WHATSAPP_NUMBER` huérfana. |
| Directorio `.devin/tmp/` vacío, sin referencias en el repo | Informativo | **Corregido:** eliminado (vacío, no trackeado por Git). |
| `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=memory` duplicada en `.env.e2e.example` (líneas 51 y 81) | Menor | **Corregido:** se eliminó la segunda ocurrencia; la primera conserva su comentario explicativo. |

### 16.3 Verificaciones de consistencia (sin acción requerida)

- Sintaxis `uses: github.com/actions/setup-node@v4` en `initialize` es válida según la documentación oficial de blueprints.
- Scripts de `package.json` (`dev`, `dev:e2e`, `build`, `start`, `lint`, `test`, `test:e2e`, `test:accessibility`, `knip`, `analyze`, `analyze:webpack`) están todos documentados en `AGENTS.md` y `environment.yaml`.
- Los 18 prompts archivados están listados en `.devin/prompts/README.md`; no hay prompts resueltos activos ni informes duplicados.
- `.env.local`, `.env.e2e` y `.devin/tmp` no están commiteados; `.gitignore` cubre `.env*`.
- No se encontraron referencias a `NEXT_PUBLIC_WHATSAPP_*` en `src/` ni en los ejemplos `.env.example`/`.env.e2e.example`.

### 16.4 Pendientes (acción del usuario)

1. ~~**Limpiar variables huérfanas de WhatsApp**~~ ✅ Resuelto: eliminadas `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` y `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` de `.env.local`, y `NEXT_PUBLIC_WHATSAPP_NUMBER` de `.env.e2e`.
2. ~~**Commitear los cambios de `.devin`**~~ ✅ Resuelto en esta iteración (commit `docs:` con las correcciones de `.devin` y `.env.e2e.example`).
3. ~~**Solapamiento `auditoria-y-documentacion.md` vs `auditoria-estado-actual-y-documentacion.md`**~~ ✅ Resuelto: se mantienen ambos diferenciados por contexto de uso (nota en `prompts/README.md`).
4. **Verificar/publicar el blueprint en Devin Cloud**: confirmar con `devin cloud drs blueprint-list` que el blueprint del repo existe y ejecutar `devin cloud drs build` tras los cambios de `environment.yaml` para validar el snapshot. Requiere `devin auth login`.
5. **Checklist manual de producción** (`guia-funcionamiento-pancheria.md`, sección 16): variables de Vercel, migraciones con `npx drizzle-kit migrate`, seed y `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` si se escala horizontalmente.

### 16.5 Recomendaciones

- ~~**`maintenance` con `npm ci`**~~ ✅ Aplicado: `environment.yaml` usa `npm ci` para reproducibilidad del snapshot (existe `package-lock.json`); la entrada `install` documenta ambas variantes.
- ~~**Renombrar `start` → `dev-server`**~~ ✅ Aplicado: la entrada `knowledge` ahora usa el nombre convencional de la documentación oficial.
- **Mantener `initialize` con `setup-node`:** aunque los snapshots suelen traer Node preinstalado, fijar la versión 20 evita deriva de toolchain.
- **Regla de índices** ✅ Aplicada: `prompts/README.md` ahora exige actualizar los índices (incluido el bloque Estructura de `.devin/README.md`) al crear o archivar archivos.
- **Frecuencia:** repetir esta auditoría de `.devin` cuando se archive un prompt/informe nuevo o cambien scripts de `package.json`, para mantener los índices sincronizados.
