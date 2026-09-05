# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-05  
**Proyecto:** `pancheria`  
**Baseline:** `99f05d65003edeecd3e49e27e15ddfdc9d4cee61` (`main`) — merge de `fix/hallazgos-auditoria-2026-09-05` completado; pendiente `npx drizzle-kit check`  
**Auditoría:** Masiva integral — 9 áreas — **con implementación de todos los hallazgos abiertos**  
**Histórico:** Fases anteriores en `.devin/informes/archivados/reporte-estado-2026-09-04.md`

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo y las verificaciones base (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`) pasan correctamente. La suite de tests unitarios alcanza **144 suites y 1393 tests**; el build genera **73 rutas/páginas**. El suite E2E cuenta con **34 specs (~110 tests)**.

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
   - Selectores endurecidos con `data-testid` (`product-availability`, `cash-register-cash-total`, `cash-register-transfer-total`, `cash-register-sales-count`, `cash-register-id-*`, `branch-phone`).
   - Docs: `BASE_URL`/`NO_GLOBAL_SETUP` documentadas, `NEXT_PUBLIC_WHATSAPP_NUMBER` como opcional, mínimos de intervalos documentados, `environment.yaml` sincronizado, `.env.e2e` ya no pisa variables con valores vacíos, CI E2E usa `drizzle-kit migrate`, versiones `@next/*`/`eslint-config-next` alineadas a `16.3.3`.

Los tests E2E se ejecutaron contra la base descartable de `.env.e2e` con resultado completo: **110/110 pasaron**. No se ejecutó `drizzle-kit push` (no hubo cambios de esquema).

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
| `npm test` | **144 suites, 1393 tests pasan** |
| `npm run build` | Build exitoso, 73 rutas/páginas |
| `npm run knip` | Pasa (sin exports/dependencias sin uso) |
| `npx drizzle-kit check` | No ejecutado (esquema sin cambios desde `0027`) |
| `npm run analyze` | No ejecutado (limitación conocida bajo Turbopack) |
| `npm run test:e2e` | **Pasa: 110/110 tests (18.1 min)** contra la base descartable de `.env.e2e` |

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
| `validateCartAvailability` (~217 líneas) | Menor | **Diferido**: la extracción tocaba lógica validada; queda como deuda aceptada. |
| `key={product.imageUrl}` / `key={index}` en `product-card.tsx` | Resuelto | `ProductImage` guarda `failedUrl` (resetea el error al cambiar `src` sin remount); breakdown usa `key={item.supplyName}`. |
| Duplicación `product-card.tsx` vs `sales-product-card.tsx` | Menor | **Diferido**: requiere diseño de componente compartido; no bloquea. |
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
| Servicios monolíticos | Mayor → Resuelto (parcial) | La persistencia fue extraída a repositorios; los servicios quedaron como orquestadores. La longitud absoluta se reduce; la división fina de `orderService`/`saleService`/`validateCartAvailability` queda como deuda futura no bloqueante. |
| Soft vs hard delete | OK | Decisión funcional confirmada: `deleteBranch` es hard delete en cascada con liberación post-commit. |

### 5.4 Cobertura de pruebas

| Hallazgo | Clasificación | Estado |
|---|---|---|
| Unitarios: 144 suites / 1393 tests | OK | `npm test` |
| E2E: 34 specs / ~110 tests | OK | `tests/e2e` |
| Rutas API, servicios, repositorios | OK | 100% con test |
| Helpers de `src/lib/` sin test | Resuelto | Agregados `csp-helpers.test.ts` y `product-image-upload-client.test.ts`; quedan sin test solo helpers triviales (`utils`, `logger`, `last-customer-*`, `product-style`, `pagination`). |
| `dashboard-client.tsx` y `video-player.tsx` sin cobertura | Resuelto | Suites nuevas: 13 y 8 tests respectivamente. |
| `branch-form.tsx` sin `data-testid` | Menor | **Diferido**: cubierto indirectamente por E2E. |
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
| Catálogo completo en memoria | Resuelto (parcial) | `productRepository.findAll`, `videoRepository.findAll`, `catalogRepository.findPublicProducts` y `findAllAttachmentKeys` aceptan `limit`/`offset`; el cron de adjuntos procesa en lotes. El catálogo público/terminal sigue cargando completo por decisión de UX (catálogo acotado para este negocio). |
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
| `vercel.json` crons | OK | 3 crons (`rate-limit-cleanup`, `chat-attachments-cleanup`, `expire-orders` cada 5 min) |
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
| Catálogo paginado en cliente | Parcial — capacidad `limit`/`offset` agregada en repositorios; la carga completa del catálogo queda por diseño de UX (catálogo acotado) |
| `data-testid` en `branch-form` y consolidación `product-card`/`sales-product-card` | Diferido — no bloqueante |
| División de `validateCartAvailability` | Diferido — extracción riesgosa sin ganancia inmediata |

### Pendiente de ejecución
1. ✅ `npm run test:e2e` — ejecutado sobre `.env.e2e`: **110/110 tests pasaron** (incluye accesibilidad axe-core, responsive, pagos mixtos, chat con adjuntos, expiración y aislamiento por sucursal).
2. `npx drizzle-kit check` — sin cambios de esquema, pero conviene verificar drift si la base local se sincronizó por SQL directo. **No ejecutado**: la base configurada en `.env.local` no cumple el patrón descartable (`test/e2e/testing/qa/staging`). Requiere `.env.e2e` con una base de prueba.

## 8. Cierre

- Baseline: `99f05d65003edeecd3e49e27e15ddfdc9d4cee61` en `main` — merge de `fix/hallazgos-auditoria-2026-09-05` (commit `d9692bd`) completado.
- Verificaciones base ejecutadas sobre el estado final: `npm run lint`, `npx tsc --noEmit`, `npm test` (144 suites / 1393 tests), `npm run build` (73 rutas), `npm run knip` y `npm run test:e2e` (110/110 tests) — todas pasan.
- Sin cambios de esquema: no se generaron migraciones; queda pendiente `npx drizzle-kit check` sobre base de prueba.
- Índices `.devin` actualizados: prompt de implementación de hallazgos archivado en `prompts/archivados/` y READMEs actualizados.
- No se ejecutaron `npx tsx src/db/seeds.ts`, `npx drizzle-kit generate/push/migrate` ni `npx vercel env pull` por requerir confirmación explícita (el seed de la base E2E lo realizó `global-setup.ts` como parte del suite).
