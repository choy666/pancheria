# Plan de implementación — Auditoría de escalabilidad

> **Fecha:** 2026-09-19
> **Estado:** Fase 0 implementada, verificada y commiteada (`90b7c54`) + Fase M ejecutada (2026-09-19, migración `0031` aplicada en desarrollo y E2E). **Fase 1 implementada y verificada** (T7–T13; suite unitaria verde, `lint`/`tsc`/`knip` limpios, **E2E completo 127/127 verde** en base descartable) — pendiente el aprovisionamiento de bases extra si se activa el sharding. Fase 2 pendiente.
>
> **Archivado el 2026-09-20 — plan resuelto:** todas las tareas tienen estado final. T1–T13 y Fase M implementadas y verificadas; T15 ejecutada vía `plan-implementacion-consolidacion-2026-09-20.md` (E1); T16 evaluada con decisión "no implementar a esta escala" (umbral de revisión documentado); T14 (multi-tenant) diferido por decisión del usuario — su fuente de verdad es `prompts/plan-implementacion-multi-tenant.md` y el pendiente queda trackeado en `informes/reporte-estado.md` §6 junto con las re-evaluaciones condicionales (SSE, sharding E2E).
>
> **Revisión post-implementación (2026-09-20):** se auditaron T1–T13 contra el código; todas conformes. Dos correcciones menores aplicadas: (a) las rutas `.../chat/stream` ahora dan prioridad al header `Last-Event-ID` sobre `?after=` (la query queda desactualizada en las reconexiones automáticas de `EventSource` tras el cierre por budget) — cubierto por tests nuevos en ambas rutas; (b) `export const maxDuration = 300` en `src/app/(panel)/sucursales/page.tsx` para que `deleteBranchAction` (server action) herede el mismo límite que las rutas pesadas.
>
> **Corrida E2E de cierre (2026-09-20, primera pasada):** 116/127 verdes; las 11 fallas fueron regresiones de tests por la paginación introducida en T7/T6, no bugs de producto:
>
> 1. `concurrencia-stock` (2 tests): el spec creaba insumos `critical_supply` tipo `bread` para pedidos públicos — el canal público solo vende `compound`, `service` y bebidas (regla de `src/lib/catalog.ts`). Se cambiaron los fixtures a bebidas vendibles.
> 2. `/stock` paginado (default 10) dejó fuera de la primera página los insumos buscados (`paso3`, `paso4`, `stock-y-movimientos`, `roles-y-sucursales`): `StockList` pasó a paginación URL-driven (`?page=&limit=` con `useSearchParams` + `ServerPagination`, igual que `/usuarios` y `/videos`) y los specs navegan `/stock?limit=100`.
> 3. `GET /api/productos?limit=100` alcanzaba el cap cuando la suite acumulaba >100 productos (orden alfabético, insumos seed como `Salchichas`/`Vaso de gaseosa` caían fuera): nuevo helper `listAllProductsViaApi` que pagina hasta agotar `total`; reemplazó los fetch de una sola página en `paso3`, `paso4`, `caja-cierre-vacios`, `ventas-historial`, `productos-y-recetas`.
> 4. `/pedido` cargaba solo la primera página del catálogo (48): `NEXT_PUBLIC_CATALOG_PAGE_SIZE=200` en `.env.e2e` para que el catálogo E2E entre en una página (los specs no ejercitan "Cargar más").
> 5. `chat-stream` 429 en `POST /api/public/pedido`: `page.setExtraHTTPHeaders` no aplica a `page.request` (solo a requests iniciados por la página), así que los posts compartían el bucket de IP por defecto con `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2`. `setUniqueClientIp` ahora también setea los headers a nivel **contexto** y devuelve el IP; los specs que crean pedidos por API pasan `X-Forwarded-For` explícito (patrón ya usado por `concurrencia-stock`). Mismo fix preventivo en `sucursal-eliminacion`.
> 6. Videos: listado y papelera (`/videos`, `/videos/eliminados`) paginados por título → specs usan `?limit=100`. `/usuarios` igual por precaución.
>
> Las lecciones quedan en `lecciones-aprendidas.md`: paginar endpoints rompe tests que asumen listados completos — al introducir paginación hay que actualizar en el mismo commit todos los consumidores E2E que buscan filas/ítems por nombre.
>
> **Corrida E2E de cierre (2026-09-20, segunda pasada):** 126/127 verdes; la única falla (`concurrencia-stock` recibir duplicado) corrió con el spec previo al último fix — al re-correr el spec aislado pasaron los 3 tests (2.5 min). **Resultado efectivo: 127/127 verdes.** Dos correcciones adicionales de esta pasada:
>
> 1. `concurrencia-stock` validaba reservas activas con `POST /api/ventas/disponibilidad`, que usa `validateCartAvailability` y **no descuenta reservas fuera de transacción** (guarda `&& dbOrTx`, diseño preexistente del commit `6f4b3a3`). El spec ahora usa `POST /api/public/disponibilidad` (`calculateAvailabilityForProductIds`, que sí las descuenta). **Observación de diseño:** el preview de disponibilidad del terminal de ventas no contempla reservas de pedidos `in_process`; la venta igual se valida transaccionalmente al confirmar, así que no hay oversell real — solo el preview es optimista.
> 2. `?limit=100` en `/stock` sigue acotado a 100 ítems: nuevo helper `gotoStockWithProduct(page, productId)` que consulta `/api/stock?page=&limit=` hasta ubicar la página exacta del producto y navega a ella — determinista sin importar cuántos insumos acumule la sucursal. Reemplazó los `goto('/stock?limit=100')` en `paso3`, `paso4`, `stock-y-movimientos` y `roles-y-sucursales`.
>
> **Estado de ejecución de la Fase 1 (2026-09-19):**
> - **T7 Paginación** ✅ — `GET /api/productos` y `GET /api/stock` aceptan `page`/`limit` (contrato `{items,total,page,limit}`); usuarios y videos paginan por `searchParams` con `ServerPagination`; filtro de stock en SQL; `fetchAllPages` conserva el catálogo completo para el terminal de ventas y `PromoForm`; `listPublicBranches` con límite defensivo y `getDefaultBranchId` por lookup directo.
> - **T8 Batching/presupuesto** ✅ — `EXPIRE_ORDERS_TIME_BUDGET_MS` en `expirePendingOrders`, `CAJA_SUMMARY_PAGE_SIZE` paginando el resumen de caja, `TRASH_RESTORE_BATCH_SIZE` por transacción al vaciar la papelera.
> - **T9 Retención + huérfanos** ✅ — `ORDER_MESSAGES_RETENTION_DAYS` (opt-in, solo pedidos terminales, libera `attachmentKey`); cleanup de huérfanos cubre `chat/`, `products/` y `videos/` en `chat-attachments-cleanup`.
> - **T10 Observabilidad** ✅ — `GET /api/health`; `withApiErrorHandling` deriva el label de `method + pathname` y loguea `durationMs` siempre; los tres crons usan `withCronAuth` (`CRON_SECRET`) con logs estructurados.
> - **T11 Concurrencia + sharding** ✅ spec `tests/e2e/concurrencia-stock.spec.ts` (oversell, carrera recibir/cancelar, reserva única) — verificado en verde el 2026-09-20; CI con reporter `blob` + `merge-reports` y matriz `E2E_SHARDS` opt-in (default 1 shard — cada shard requiere su propia base descartable porque `global-setup.ts` trunca).
> - **T12 Lookups con scope** ✅ — `findByOrderNumberAndCustomer` exige `branchId`; seguimiento público propaga `branchId` del cliente; `GET /api/productos/imagen/[key]` exige `branchId` y las URLs locales lo incluyen (provider `local`; remotos apuntan directo al storage).
> - **T13 Spike SSE** ✅ — endpoints `.../chat/stream` (operador + público) con heartbeat, `budget` acotado por `CHAT_STREAM_BUDGET_MS` y `maxDuration=60`; `useOrderChat` usa `EventSource` con `Last-Event-ID` solo si `NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`, con fallback automático a polling y cierre en pestañas ocultas. **Decisión: SSE implementado como opt-in deshabilitado; el polling REST sigue siendo el default** (ver `informes/archivados/spike-sse-chat-2026-09-19.md`).
> **Revisión:** 2026-09-19 — correcciones verificadas contra el código en T2 (seguimiento es POST), T6-B (cableado de `productIds`), T9 (prefijo `product-images/`), T10.2 (la duración ya se loguea con `routeLabel`) y T12 (propagación de `branchId`).
> **Fuente:** `informes/archivados/auditoria-escalabilidad-2026-09-19.md` §2 (cuadro de riesgo), §4 (orden de quiebre) y §5 (plan de acción)
> **Baseline de la auditoría:** `62a644dd95d047a4a92c9215d74023fcf5e0e06b` (`main`)
> **Documentación de referencia:** `AGENTS.md`, `informes/reporte-estado.md`, `informes/entornos.md`, `informes/lecciones-aprendidas.md`, `informes/guia-funcionamiento-pancheria.md`, `informes/checklist-pre-push.md`, `prompts/plan-implementacion-multi-tenant.md`

Este documento convierte los 14 hallazgos de la auditoría de escalabilidad en un plan ejecutable por fases. Cada tarea indica los hallazgos que resuelve, los archivos a tocar, el detalle de implementación, los tests esperados y las verificaciones.

---

## 1. Objetivo y alcance

Preparar el sistema para sostener **10×–50× la carga actual** de un solo comercio y habilitar después la **migración multi-tenant** (objetivo documentado: 10–50 comercios). El plan sigue la priorización de la auditoría:

- **Fase 0 — Quick wins (<1 día):** tareas de bajo esfuerzo y alto impacto que absorben el grueso del primer cuello de botella (polling → escrituras y lecturas a Neon).
- **Fase 1 — Corto plazo (<1 sprint):** paginación, trabajos pesados acotados, retenciones, observabilidad, tests de concurrencia y el cierre de los lookups sin scope (prerequisito de multi-tenant).
- **Fase 2 — Estratégico (>1 sprint):** migración multi-tenant, capa de caché de servidor y separación de lecturas pesadas.
- **Fase M — Verificaciones manuales en producción:** ítems no verificables desde el código (ejecutables en cualquier momento, sin deploy).

Queda **fuera de alcance** implementar el código: este documento es la guía. Cada tarea se puede ejecutar como unidad de trabajo independiente (un PR o una sesión) respetando las dependencias del §6.

### Reglas transversales para todas las tareas

1. **Sin valores hardcodeados:** todo parámetro nuevo (límites, ventanas, TTLs, tamaños de pool, presupuestos de tiempo) se lee con getters de `src/config/*` desde variables de entorno con defaults documentados. Cada variable nueva se agrega a `.env.example`, `AGENTS.md`, `README.md` (si aplica) y `.devin/environment.yaml` (lección §6).
2. **Migraciones:** todo cambio en `src/db/schema.ts` se acompaña de `npx drizzle-kit generate`, la migración commiteada en `drizzle/` y `drizzle/meta/`, verificación con `npx drizzle-kit check` y aplicación con `npx drizzle-kit migrate` (ver `entornos.md`). `drizzle-kit push` desincroniza el historial.
3. **E2E solo en base descartable** (nombre terminado en `test`, `e2e`, `testing`, `qa` o `staging`).
4. **Verificaciones estándar antes de cada push** según `checklist-pre-push.md`: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`.
5. **Convenciones de errores:** `NotFoundError` → 404, `DomainError` → 400, `ForbiddenError` → 403; sanitización de payloads públicos (no exponer datos internos de stock).
6. **Rate limit en tests:** los tests unitarios de rutas mockean `createRateLimiter`; en E2E el rate limit de pedidos se activa solo con las variables documentadas en `checklist-pre-push.md`.

---

## 2. Matriz de trazabilidad

| Tarea | Hallazgo(s) | Fase | Esfuerzo | Depende de |
|---|---|---|---|---|
| T1 Caché CDN en rutas públicas calientes | H3 | 0 | Bajo | — |
| T2 Rate limit: polls GET fuera del store DB | H2 | 0 | Bajo | — |
| T3 Cleanup de `login_attempts` | H5 | 0 | Bajo | — |
| T4 Índices en FKs hijas + `image_key` | H4 | 0 | Bajo (migración) | — |
| T5 Pool de conexiones explícito | H7 | 0 | Bajo | M1 (verificación prod) |
| T6 `maxDuration` + refresh de catálogo acotado | H14, H3 | 0 | Bajo-Medio | — |
| T7 Paginación de listados | H8 | 1 | Medio | — |
| T8 Batching con presupuesto de tiempo | H6 | 1 | Medio | T6 |
| T9 Retención de `order_messages` + huérfanos | H10 | 1 | Bajo-Medio | — |
| T10 Observabilidad: health, duraciones, crons | H11 | 1 | Bajo | — |
| T11 Tests de concurrencia + sharding E2E | H12 | 1 | Medio | — |
| T12 Cierre de lookups sin scope | H9 | 1 | Bajo | — |
| T13 SSE para chat/panel (spike + decisión) | H2, H3 | 1-2 | Medio-Alto | T1, T2 |
| T14 Migración multi-tenant | H1 | 2 | Alto | T2, T4, T12 |
| T15 Caché de servidor (`unstable_cache`/tags) | H3 | 2 | Medio | T1 |
| T16 Réplicas de lectura / agregaciones separadas | — | 2 | Evaluación | — |

> T12 (cierre de H9) es **prerequisito obligatorio** de T14: la auditoría lo marca como fuga cross-tenant directa una vez que exista el segundo tenant.

---

## 3. Fase 0 — Quick wins

### T1. Caché CDN corto en `/api/public/catalogo` y `/api/public/sucursal/estado` (H3)

**Problema:** cada poll de visitante pega directo a PostgreSQL (~6 + 2 roundtrips cada 30 s por cliente). Es la palanca de mayor impacto/costo según la auditoría §3.3–§3.4.

**Archivos:**
- `src/app/api/public/catalogo/route.ts` — hoy responde `NextResponse.json(result)` sin headers de caché.
- `src/app/api/public/sucursal/estado/route.ts` — `dynamic = 'force-dynamic'`, sin headers de caché.
- `src/config/catalog.ts` y/o `src/config/branch.ts` — nuevos getters.
- `.env.example`, `AGENTS.md`, `.devin/environment.yaml` — documentar variables.

**Implementación:**
1. Agregar getters de configuración (sin hardcodear):
   - `PUBLIC_CATALOG_CACHE_S_MAXAGE` (default `10`)
   - `PUBLIC_CATALOG_CACHE_SWR` (default `30`)
   - `PUBLIC_BRANCH_STATUS_CACHE_S_MAXAGE` (default `10`)
   - `PUBLIC_BRANCH_STATUS_CACHE_SWR` (default `30`)
   - Un valor `0` o vacío en `s-maxage` deshabilita el header (comportamiento actual), para poder apagarlo sin deploy de código.
2. En ambas rutas, construir la respuesta exitosa con:
   `Cache-Control: public, max-age=0, s-maxage=<conf>, stale-while-revalidate=<conf>`
   - `s-maxage` lo honra el CDN de Vercel (cachea la respuesta por query string; `branchId`, `limit`, `offset` e `includeAvailability` ya van en la URL).
   - `max-age=0` evita que el navegador cachee: el cliente sigue recibiendo datos frescos en su poll, el CDN absorbe la carga entre clientes.
   - Aplicar **solo a respuestas 200**; errores 400/404/500 no cacheables (`no-store` implícito o explícito).
3. Staleness máximo percibido: ~`s-maxage + SWR` ≈ 40 s, dentro de lo que el cliente ya tolera (poll de 30 s). Documentar en el código y en `AGENTS.md`.

**Tests:**
- Tests de ruta existentes (`route.test.ts` de ambas): assert del header `Cache-Control` en la respuesta 200 y de su ausencia/`no-store` en errores.
- Test de los getters nuevos en `src/config/*.test.ts` (default, parseo, deshabilitado).

**Riesgos/decisiones:**
- `includeAvailability=true` queda hasta ~40 s desfasado: aceptable (el propio cliente refresca cada 30 s); la validación fuerte de stock sigue ocurriendo en `POST /api/public/pedido` y `POST /api/public/disponibilidad` al confirmar.
- `sucursal/estado.isOpen` puede quedar ~40 s desfasado tras abrir/cerrar caja: aceptable; si se quiere frescura exacta, el envío de pedido valida en servidor (`createOrder` consulta `getOpenCashRegister` — lección §1).

---

### T2. Sacar los GET de polling del rate limit con store DB (H2)

**Problema:** `createRateLimiter` → `DbPublicOrderRateLimitStore.recordRequest` ejecuta un `INSERT ... ON CONFLICT DO UPDATE` por **cada poll** de chat/estado. Con ~100 chats abiertos a 5 s ≈ 20 upserts/s sostenidos antes de cualquier lectura (auditoría §3.2).

**Estado actual verificado (corregido 2026-09-19):**
- `src/app/api/public/pedido/[id]/chat/route.ts` — GET y POST comparten `createRateLimiter('chat', …)` (líneas 20-24, 44, 89). El GET es el poll dominante: `useOrderChat` lo llama cada `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (default 5 s) por chat abierto.
- `src/app/api/public/pedido/[id]/estado/route.ts` — GET con rate limit DB (scope `'estado'`, reusando `getChatRateLimitWindowMs`/`getChatRateLimitMaxRequests` de `config/chat.ts`). **No es un poll de 5 s:** lo llama `recent-orders-banner` una vez por pedido reciente por visita, más usos puntuales del flujo de pedido.
- `.../seguimiento/route.ts` — **solo expone POST** (lookup de identidad por número + nombre/teléfono del cliente). Es sensible a enumeración, por lo que **conserva** el store DB; no migra al limiter en memoria.
- Escrituras que **conservan** rate limit DB: `POST /api/public/pedido`, `.../chat` (POST), `.../chat/upload`, `.../chat/leido`, `.../cancelar`, `.../seguimiento` (POST), `POST /api/pedidos/[id]/chat/ubicacion` (usa `branchId` como clave).
- El chat del operador (`/api/pedidos/[id]/chat` y subrutas autenticadas) **no usa `createRateLimiter`**: sus requests ya no escriben en `public_order_rate_limits`. El alcance de esta tarea son solo las rutas públicas.

**Archivos:**
- `src/lib/rate-limit.ts` — nuevo helper de limiter ligero.
- `src/lib/public-order-rate-limit-store.ts` — reutilizar `InMemoryPublicOrderRateLimitStore`.
- Rutas GET listadas arriba.
- `src/config/rate-limit.ts` — nuevos getters + `.env.example`, `AGENTS.md`, `environment.yaml`.

**Implementación:**
1. Nuevo `createPollRateLimiter(scope, windowMs, maxRequests)` en `rate-limit.ts` que:
   - Usa `InMemoryPublicOrderRateLimitStore` (veto por instancia, sin escrituras a DB).
   - Mantiene las mismas guardas de entorno (`isTest`/`isDevelopment` con sus flags) que `createRateLimiter`.
2. Nuevas variables con defaults generosos (veto anti-abuso, no límite de negocio):
   - `PUBLIC_POLL_RATE_LIMIT_WINDOW_MS` (default `60000`)
   - `PUBLIC_POLL_RATE_LIMIT_MAX_REQUESTS` (default `240`)
3. Cambiar los GET de polling (`chat` GET y `estado`) a scope propio (`'chat_poll'`, `'pedido_poll'`) con el limiter ligero. Al migrar, `estado` deja de usar los getters de `config/chat.ts` y pasa a las nuevas variables `PUBLIC_POLL_*`. Los POST conservan el store DB y sus scopes actuales.
4. `getClientIp` se mantiene (barato, sin DB).

**Decisión registrada:** la auditoría ofrece "scope separado con ventana generosa, solo escrituras, o ETag/304". Se elige **limiter en memoria para lecturas** porque un scope separado en DB seguiría escribiendo una fila por poll (no resuelve el costo), y quitar el check por completo elimina el veto anti-abuso. La división por instancia es aceptable: es un veto, no la frontera de seguridad. `ETag`/`304` queda como alternativa evaluable dentro de T13.

**Tests:**
- Unit: nuevos tests del poll limiter (memoria, ventana, max) y actualización de los tests de ruta que mockean `createRateLimiter` para cubrir también `createPollRateLimiter`.
- E2E: `rate-limit-pedidos.spec.ts` no se toca (cubre POST). Si se agrega spec de poll-limit, requiere sus propias variables en `webServer.env` (ver `checklist-pre-push.md`).

---

### T3. Cleanup de `login_attempts` (H5)

**Problema:** `login_attempts` crece sin retención; `verifyCredentials` registra intentos aunque el usuario no exista (endpoint público) → crecimiento no acotado más una escritura por intento.

**Archivos:**
- `src/lib/rate-limit-store.ts` — agregar `cleanupStale` a `RateLimitStore`/`DbRateLimitStore`.
- `src/app/api/cron/rate-limit-cleanup/route.ts` — invocar el cleanup adicional.
- `src/config/rate-limit.ts` — getter de retención.
- Tests del store y de la ruta.

**Implementación:**
1. `LOGIN_ATTEMPTS_RETENTION_MS` (default sugerido 7 días; documentar en `.env.example`/`AGENTS.md`/`environment.yaml`).
2. `DbRateLimitStore.cleanupStale(retentionMs)`: `DELETE FROM login_attempts WHERE last_attempt < now - retentionMs` (drizzle `lt()`), devuelve cantidad borrada. `InMemoryRateLimitStore` implementa el método por paridad (borrado por `lastAttempt`).
3. El cron `rate-limit-cleanup` ejecuta ambos cleanups y devuelve `{ ok, deletedRateLimits, deletedLoginAttempts }`.
4. **Decisión registrada:** se sigue persistiendo el intento para usuarios inexistentes — es lo que permite rate-limitar por username; el cleanup acota el crecimiento. Evaluar en Fase 1 no persistir si el volumen lo justifica.

**Tests:** unit del store (borra solo filas viejas), unit de la ruta (llama ambos cleanups, respeta 401 sin secreto).

---

### T4. Índices en FKs hijas + `products.image_key` (H4)

**Problema:** FKs hijas sin índice provocan seq scans en `findReferencedProductIds` (pre-hard-deletes) y `findByImageKey` (servido de imágenes no cacheado), y crecen con el volumen histórico.

**Archivos:**
- `src/db/schema.ts` — nuevos `index(...)` en las tablas.
- `drizzle/` + `drizzle/meta/` — migración generada.

**Índices a crear (verificado contra `schema.ts` actual):**

| Tabla | Columna(s) | Nombre sugerido |
|---|---|---|
| `sale_items` | `product_id` | `sale_items_product_id_idx` |
| `order_items` | `product_id` | `order_items_product_id_idx` |
| `recipes` | `supply_id` | `recipes_supply_id_idx` |
| `sale_item_recipes` | `supply_id` | `sale_item_recipes_supply_id_idx` |
| `order_item_recipes` | `supply_id` | `order_item_recipes_supply_id_idx` |
| `stock_movements` | `sale_id` | `stock_movements_sale_id_idx` |
| `stock_movements` | `order_id` | `stock_movements_order_id_idx` |
| `orders` | `converted_sale_id` | `orders_converted_sale_id_idx` |
| `products` | `image_key` | `products_image_key_idx` |

**Implementación:**
1. Agregar los `index()` en cada definición de tabla.
2. `npx drizzle-kit generate` → revisar el SQL generado → commitear `drizzle/` + `drizzle/meta/`.
3. `npx drizzle-kit check` (sin drift), `npx drizzle-kit migrate` en desarrollo y en la base E2E.
4. Producción: seguir `entornos.md` §Producción (`vercel env pull`, `DATABASE_URL_UNPOOLED`, `drizzle-kit migrate`, borrar `.env.production.local`). **Nota:** el SQL generado usa `CREATE INDEX` común (sin `CONCURRENTLY`), que toma lock de escritura. Con el volumen actual es irrelevante; si las tablas históricas crecen antes de aplicarla en producción, evaluar `CREATE INDEX CONCURRENTLY` manual o aplicarla en horario de baja.

**Tests:** no aplica (sin cambio de comportamiento). Verificación: `npm test` + `drizzle-kit check`.

---

### T5. Pool de conexiones explícito (H7)

**Problema:** `src/db/index.ts` crea `NeonPool`/`PgPool` sin `max`, `connectionTimeoutMillis` ni `idleTimeoutMillis`; cada instancia serverless caliente abre ~10 conexiones hacia Neon.

**Archivos:**
- `src/db/index.ts` — pasar opciones al pool solo cuando estén definidas.
- `src/config/database.ts` — getters `getDbPoolMax()`, `getDbConnectionTimeoutMs()`, `getDbIdleTimeoutMs()` (devuelven `number | undefined`; si no hay env, se conserva el default de la librería — comportamiento actual).
- `.env.example`, `AGENTS.md`, `environment.yaml` — `DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_IDLE_TIMEOUT_MS` (opcionales).

**Implementación:**
1. Construir el objeto de opciones del pool solo con las propiedades definidas (verificar compatibilidad de `@neondatabase/serverless` `Pool` con `max`/`connectionTimeoutMillis`/`idleTimeoutMillis` — la API es compatible con `pg.PoolConfig`).
2. Documentar valores recomendados para producción en `AGENTS.md` una vez verificado el plan de Neon (ver Fase M).
3. Complemento manual (Fase M): confirmar que `DATABASE_URL` usa el endpoint `-pooler` de Neon.

**Tests:** unit de los getters; el wiring del pool se cubre con `npm test`/`npm run build` existentes.

---

### T6. `maxDuration` en crons/rutas pesadas + refresh de catálogo acotado (H14 + H3 parcial)

**Parte A — `maxDuration`:**
- Agregar `export const maxDuration = <valor>` a `src/app/api/cron/expire-orders/route.ts`, `.../rate-limit-cleanup/route.ts`, `.../chat-attachments-cleanup/route.ts` y a las rutas que ejecutan trabajo pesado (`emptyTrash`/restauración de stock de cajas eliminadas — localizar la ruta que invoca `cashRegisterService.emptyTrash`, y rutas de cierre de caja si el resumen es pesado).
- `maxDuration` es una directiva estática de Next.js (no puede leer env); el valor efectivo depende del plan de Vercel → **verificar en producción (Fase M)** antes de fijar el número. Documentar el valor elegido y el motivo en `AGENTS.md`.
- Nota: `expire-orders` se dispara desde GitHub Actions cada 5 min (no desde `vercel.json`), así que `maxDuration` protege la invocación remota igualmente.

**Parte B — refresh de catálogo acotado:**
- `src/components/pedido/usePedidoClient.ts` `refreshCatalog` (~línea 288): hoy pide `limit = max(loadedCount, pageSize)` — hasta 200 productos con disponibilidad cada 30 s.
- **Recomendada:** refrescar la **primera página completa** (`limit = resolvedPageSize`, productos nuevos/actualizados) y la **disponibilidad de los IDs ya cargados** por páginas siguientes vía `POST /api/public/disponibilidad` (payload liviano, sin re-descargar el catálogo).
  - **Cableado necesario (verificado):** `cartAvailabilitySchema` ya acepta `productIds` opcional (`zod-schemas.ts:214`), pero la ruta pública lo descarta — llama `validatePublicCart(branchId, data.items)` y ese servicio no recibe `productIds`. Replicar el patrón del endpoint autenticado `/api/ventas/disponibilidad`, que sí reenvía `data.productIds` a `saleService.validateCartAvailability(branchId, items, productIds)` (`route.ts:11-15`): extender `validatePublicCart` con el parámetro. Verificar que `availabilityByProduct` sea semánticamente equivalente al `availability` del catálogo (que sale de `calculateAvailabilityForProductIds`, incluyendo config de receta).
  - **Semántica del merge (definir al implementar):** `refreshCatalog` hoy reemplaza `products` completo. Con la estrategia mixta hay que fusionar: actualizar las entradas de la página 1, actualizar `availability` de los IDs ya cargados en páginas siguientes, y decidir qué hacer con productos eliminados/desactivados entre refrescos (la respuesta de disponibilidad no los incluye — opciones: marcarlos `availability: 0` o removerlos del estado). Mantener `total`/`hasMore` consistentes con la respuesta.
  - **Interacción con T1:** una vez cacheado el catálogo en CDN, el refresh actual ya se amortiza entre clientes (una ida al origen por ventana por URL). Esta tarea sigue valiendo por bytes transferidos y trabajo en cache-miss, pero su prioridad relativa baja tras T1.
  - **Trade-off aceptado:** `POST /api/public/disponibilidad` no es cacheable en CDN (es POST); se cambian ~6 queries de catálogo por ~3 de validación — net win, pero sin absorción entre clientes.
- **Alternativa simple (si se prioriza esfuerzo):** refrescar solo la primera página y resetear la paginación; pierde el progreso de "Cargar más" cada 30 s — peor UX, solo si la recomendada se complica.
- Tests del hook (`usePedidoClient` tiene suite propia): refresh no excede `pageSize` en la query de catálogo y pide disponibilidad para IDs cargados.

**Verificación Fase 0 completa:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`, `npx drizzle-kit check` (T4), E2E si se tocó rate limit/rutas públicas.

---

## 4. Fase 1 — Corto plazo (<1 sprint)

### T7. Paginación de listados (H8)

**Listados sin paginar:** `GET /api/productos`, `GET /api/stock`, listado de usuarios (server actions de `src/app/(panel)/usuarios/`), `GET` de videos y `listBranches` por request pública.

**Implementación:**
1. **Análisis de consumidores primero** (riesgo principal): el terminal `/ventas` precalcula disponibilidad de todo el catálogo (lección §14 — no quitar `productIds` del endpoint de disponibilidad) y `/pedido` ya pagina (`NEXT_PUBLIC_CATALOG_PAGE_SIZE`). Definir por endpoint si pagina o si el consumidor migra a otro contrato.
2. Aplicar el patrón existente: `PaginationParams`/`PaginatedResult` en repositorio (lección §2 — paginar en repositorio, no `slice` en handler), constantes de `src/config/pagination.ts` (`MAX_LIMIT = 100`), respuesta `{ items, total, page, limit }` y UI con paginador o "Cargar más".
3. `listBranches` pública: cachear dentro de T15 o resolver con `unstable_cache`; mínimo, filtrar solo activas y limitar.
4. Mantener compatibilidad: parámetros `page`/`limit` opcionales con default paginado; los clientes se actualizan en el mismo PR.

**Tests:** unit de repositorio/servicio con paginación (página intermedia, última página, total), unit de rutas, E2E de los listados tocados.

---

### T8. Batching con presupuesto de tiempo y limpiezas por lotes (H6)

**Trabajo pesado identificado por la auditoría:**
- `orderService.expirePendingOrders` — lotes de 200, una transacción por pedido, sin corte de tiempo.
- `cashRegisterService.restoreStockForDeletedCashRegisters` — cajas × ventas dentro de **una** transacción (invocado por `emptyTrash`).
- `cashRegisterService.calculateSummaryFromSales` — carga todas las ventas activas con items+snapshots+pagos al cerrar/recalcular.
- `branchService.deleteBranch` — recolección de claves antes de la cascada (ya borra archivos fuera de la transacción; mantener el patrón).

**Implementación:**
1. `expirePendingOrders`: presupuesto de tiempo `EXPIRE_ORDERS_TIME_BUDGET_MS` (env, default coherente con `maxDuration` de T6 menos margen). Al agotarse, cortar la corrida, loguear `expired`/`remaining` y devolver lo procesado — el cron cada 5 min retoma el resto. Mantener la guarda `attemptedOrderIds` y el lock `findByIdForUpdate`.
2. `emptyTrash`/`restoreStockForDeletedCashRegisters`: una transacción por caja (no una global), tamaño de lote por env `TRASH_RESTORE_BATCH_SIZE` (default razonable, p. ej. 20) y log de progreso. Evaluar cortar al superar presupuesto de tiempo con reanudación manual segura (la operación es reentrante).
3. `calculateSummaryFromSales`: cargar ventas por páginas (o agregación SQL) en lugar de materializar items+snapshots+pagos completos cuando el volumen supere un umbral configurable.
4. Todos los umbrales nuevos → `src/config/*` + `.env.example` + `AGENTS.md` + `environment.yaml`.

**Tests:** unit de `expirePendingOrders` (corte por presupuesto con reloj mockeado, reanudación en la siguiente corrida, `DomainError` tolerado), unit de restauración por lotes (caja aislada fallida no aborta el resto).

---

### T9. Retención de `order_messages` + huérfanos de `products/` y `videos/` (H10)

**Implementación:**
1. **Retención de mensajes:** variable `ORDER_MESSAGES_RETENTION_DAYS` (sin valor = no purga; preserva la auditoría por defecto). Cuando está definida, nuevo cleanup (dentro de `chat-attachments-cleanup` o cron propio) que borra mensajes de pedidos en estado terminal (`finished`/`cancelled`) más viejos que el período. Mensajes con `attachmentKey` deben liberar el objeto de storage en el mismo flujo (o quedar cubiertos por el cleanup de huérfanos del punto 2).
2. **Huérfanos ampliados (prefijos corregidos):** extender `chat-attachments-cleanup` (hoy solo prefijo `chat/`) a `product-images/` (contra `products.image_key` — las claves se generan como `product-images/{productId}/{nanoid}.{ext}` en `generateProductImageKey`, `product-image-storage.ts:98`) y `videos/` (contra `videos.file_url`; la clave se deriva con `extractVideoKeyFromUrl`, `storage.ts:480`). Generalizar el servicio de limpieza: hoy la lógica está inline en la ruta del cron por provider — extraerla a `src/lib/` o un servicio con la forma lista-por-prefijo del provider → compara contra claves vivas en DB → borra sobrantes. Revisar `storage.ts` (`list` por prefijo ya usado para `chat/`).
3. Umbrales y tamaños de lote por env; la frecuencia se mantiene en `vercel.json` (los schedules no son env — lección §1).

**Tests:** unit del servicio de huérfanos por prefijo (conserva claves vivas, borra sobrantes), unit del cleanup de mensajes (solo terminales + antiguos), unit de la ruta cron.

---

### T10. Observabilidad básica (H11)

**Implementación:**
1. **`GET /api/health`:** `{ ok, db: 'up'|'down', now }` con `SELECT 1`; sin datos sensibles, sin auth. Aprovechar para eliminar el directorio vacío `src/app/api/debug/` (residuo sin archivos) o alojar ahí el endpoint.
2. **Duración por request — ampliar cobertura (el mecanismo ya existe):** `withApiErrorHandling` ya loguea `{method, url, status, durationMs}` en respuestas y errores, **pero solo cuando la ruta pasa `routeLabel`** (`api-handler.ts:57-71`). Hoy varias rutas calientes no lo pasan (`catalogo`, `chat` GET/POST, `estado`, `seguimiento`, `leido`, `cancelar`) y las rutas de cron **no usan el wrapper** (son `GET` planos con auth por `CRON_SECRET`). La tarea es hacer el label obligatorio o derivarlo de `method + pathname` cuando falte, y decidir si los crons adoptan el wrapper o conservan su logging propio (punto 3). No agregar un segundo log sobre el existente.
3. **Visibilidad de crons:**
   - `logger.info` estructurado al inicio/fin de cada cron con duración y resultados (`deleted`, `expired`).
   - Fallo de `expire-orders`: el workflow de GitHub Actions ya notifica por email en fallo de job — documentarlo en `entornos.md`/runbook; opcionalmente persistir `lastRun`/`lastSuccess` en una tabla mínima (`cron_runs`) expuesta por `/api/health` para detectar silencio (evaluar costo/beneficio; alternativa gratuita: job de GH Actions que verifique la última ejecución registrada).

**Tests:** unit de `/api/health` (DB up/down → 200/503), unit del wrapper (log con duración), unit de crons (log estructurado).

---

### T11. Tests de concurrencia + sharding de Playwright (H12)

**Implementación:**
1. **Spec E2E de concurrencia** (base descartable): `tests/e2e/concurrencia-stock.spec.ts`
   - *Oversell:* N `page.request` en paralelo confirmando ventas/pedidos sobre el mismo producto con stock acotado → stock nunca negativo, solo K confirmaciones exitosas, movimientos consistentes.
   - *Carrera cancelación/recepción/expiración:* cancelar y recibir/convertir en paralelo → un solo ganador, sin estados inválidos ni doble liberación de reservas.
   - Usar `Promise.all` sobre `request` de Playwright (sin depender de timing fino; la protección real está en locks + `ON CONFLICT`).
2. **Sharding:** `ci.yml` con `strategy.matrix.shard: [1..N]`, `npx playwright test --shard=$i/$N`, reporter `blob` + job de merge (`npx playwright merge-reports`). Elegir N por duración actual de la suite (documentar en `ci.yml` el criterio).
3. Actualizar `checklist-pre-push.md` y `AGENTS.md` si cambian los comandos de E2E.

**Tests:** los specs son la entrega; el merge de reportes se valida en CI.

---

### T12. Cierre de lookups sin scope (H9) — prerequisito de multi-tenant

**Implementación:**
1. `orderRepository.findByOrderNumberAndCustomer`: agregar `branchId` obligatorio y filtrar. La ruta pública de seguimiento (`/api/public/pedido/seguimiento`, hoy solo POST con `orderTrackingSchema` sin `branchId`) resuelve `branchId` del body/query o de la sucursal por defecto y lo propaga por `orderService.trackOrder` (que tampoco recibe `branchId` hoy). **Nota (verificado):** el cliente `order-tracker.tsx` es standalone y no tiene el `branchId` a mano — la página `/pedido` que lo embebe debe pasárselo como prop, o leerlo de `localStorage` (`pancheria-branch-id`).
2. `GET /api/productos/imagen/[key]`: exigir `branchId` en query y pasarlo a `findByImageKey` (la firma ya lo acepta como opcional; el servido público lo omite). La URL pública de imagen se genera con `?branchId=<id>`. **Nota (verificado):** `getProductImagePublicUrlForLocal(key)` solo recibe la key — hay que propagar `branchId` desde `resolveProductImage(product)` (`product.branchId`). Este fix endurece solo el provider `local`: con `vercel-blob`/`s3`/`r2` la URL pública apunta directo al storage y la ruta API no se usa.
3. Tests: mismo `orderNumber` en dos sucursales no resuelve datos cruzados; imagen de otra sucursal → 404; contratos públicos actualizados.

> Sin esta tarea, abrir el segundo tenant expone seguimiento de pedidos e imágenes entre comercios (auditoría §3.5).

---

### T13. SSE para chat/panel — spike + decisión (H2/H3 estructural)

**Contexto honesto (restricción de plataforma):** en Vercel serverless una conexión SSE mantiene viva la función y se **factura por duración**; `maxDuration` acota el stream y el cliente debe reconectar. Puede salir más caro que el propio polling. Por eso esta tarea arranca como **spike acotado**, no como compromiso de implementación.

**Implementación:**
1. **Spike (tiempo acotado):** prototipo `GET /api/pedidos/[id]/chat/stream` con `ReadableStream` + heartbeat, `maxDuration` explícito y reconexión del cliente. Medir: duración de conexión, costo de función vs. polls equivalentes, comportamiento con pestañas ocultas.
2. **Diseño si se avanza:**
   - SSE por pedido para chat cliente/operador (reemplaza el poll de 5 s; los POST siguen REST).
   - Reconexión con `Last-Event-ID`/cursor `after` (los cursores ya existen en `listClientMessages`).
   - Fallback automático al polling actual ante error/corte (conservar `useVisibilityPolling` + backoff).
   - Presupuesto de conexión: cortar el stream antes de `maxDuration` y reconectar (no depender de conexiones infinitas).
3. **Alternativas si el spike descarta SSE:** subir intervalo de poll + `ETag`/`304` en el GET de chat (la respuesta cambia poco), o pub/sub externo (Upstash/Pusher) solo si el volumen lo justifica — nueva dependencia, evaluar costo.
4. **Puerta de decisión:** ejecutar **después** de T1+T2; esas tareas ya eliminan la mayoría de escrituras por poll y absorben lecturas vía CDN, por lo que el beneficio marginal de SSE queda en la frescura percibida del chat.

**Tests:** unit del stream (emisión de mensajes nuevos, cierre, cursor), E2E de chat en modo SSE y en fallback polling.

---

## 5. Fase 2 — Estratégico (>1 sprint)

### T14. Migración multi-tenant (H1)

**Fuente de verdad:** `prompts/plan-implementacion-multi-tenant.md` (fases 0–4 ya diseñadas). Este plan **no lo duplica**: agrega los complementos que fija la auditoría §3.9 como trabajo previo/durante:

1. **Backfill e índices compuestos:** además de `tenant_id` en ~15 tablas, rehacer los índices `branch_*` como `(tenant_id, branch_id, ...)`. Incorporar los índices de T4 ya con prefijo `tenant_id` para no pagar dos migraciones.
2. **Cerrar T12 (H9) antes de abrir el segundo tenant.**
3. **Resolución por subdominio cacheada:** `tenant-resolver` + `getDefaultBranchId`/`listBranches` deben resolver por subdominio con caché (T15), no por scan + env por request (`branch-resolver.ts` hoy hace `SELECT` de todas las sucursales por request sin `branchId`).
4. **Config por tenant en DB:** `tenant_settings` para nombre/branding/horarios/límites en lugar de `DEFAULT_*`/`NEXT_PUBLIC_*` por despliegue.
5. **Rate limit por tenant:** PKs compuestas `(tenantId, ip)`/`(tenantId, username)` en `public_order_rate_limits`/`login_attempts` (ya en el plan original); T2 debe quedar compatible (el limiter en memoria de polls recibe scope por tenant).
6. **Storage namespaced** `tenants/{tenantId}/branches/{branchId}/` y validación de pertenencia en endpoints de descarga (ya en el plan original).

**Puerta de entrada a T14:** T2, T4, T12 completados + Fase M verificada.

### T15. Caché de servidor con invalidación por tag

1. `unstable_cache` (o Redis solo si hace falta invalidación cross-instance inmediata) sobre lecturas calientes: `getBranchById`, `getDefaultBranchId`/`listBranches`, catálogo público y, en multi-tenant, `tenant_settings`/resolución de dominio.
2. Tags por dominio (`branch:{id}`, `catalog:{branchId}`, `tenant:{slug}`) + `revalidateTag` en los puntos de mutación (productos, stock, sucursales, cajas, settings).
3. Nota técnica: `force-dynamic` en las rutas no impide `unstable_cache` dentro del handler; verificar interacción con los headers `s-maxage` de T1 (capas complementarias: CDN por URL, data-cache por tag).
4. Cuidado con datos sensibles: solo datos públicos/no sensibles entran a la capa compartida.

### T16. Réplicas de lectura / separación de agregaciones

Evaluación (no implementación directa): mover resúmenes pesados (`calculateSummaryFromSales`, dashboards) a réplica de lectura o a agregaciones SQL/materializadas cuando el volumen lo justifique. Documentar decisión y umbrales observados (métricas de T10).

---

## 6. Dependencias y orden sugerido

```
Fase 0 (paralelizable, cualquier orden):
  T4 ─┐
  T1 ─┤
  T2 ─┼─→ desbloquean Fase 1 y Fase 2
  T3 ─┤
  T5 ─┤
  T6 ─┘

Fase 1:
  T12 (H9) ────────────┐
  T7, T8, T9, T10, T11 ─┼─→ T14 (multi-tenant)
  T13 (spike SSE) ← después de T1+T2

Fase 2:
  T14 ← T2, T4, T12
  T15 ← T1 (y recomendado antes de T14 §3.9.3)
  T16 ← métricas de T10
```

Orden sugerido dentro de Fase 0 (minimiza riesgo y da alivio inmediato): **T4 → T1 → T2 → T3 → T5 → T6**.

---

## 7. Fase M — Verificaciones manuales en producción (sin deploy)

> **Ejecutada 2026-09-19.** Resultados verificados:

| # | Verificación | Resultado |
|---|---|---|
| M1 | `DATABASE_URL` usa el endpoint `-pooler` de Neon y límites del plan | ✅ `DATABASE_URL` (prod) → `ep-long-meadow-…-pooler.c-11.us-east-1.aws.neon.tech` (pooler); `DATABASE_URL_UNPOOLED` → endpoint directo. Proyecto Neon `noisy-paper-53350862` (free): **0.25 CU fijos** (sin autoscaling), **512 MB**/branch, auto-suspend. ⚠️ Menor: `POSTGRES_URL_NON_POOLING` apunta al host `-pooler` (mal rotulado; sin impacto porque `DATABASE_URL_UNPOOLED` tiene precedencia). Si se define `DATABASE_POOL_MAX`, mantenerlo bajo (compute de 0.25 CU). |
| M2 | `maxDuration` efectivo aplicable según plan de Vercel | ✅ Plan **Hobby** con Fluid Compute (proyecto creado ago-2026, posterior al default): **máx. 300 s**. Se fijó `maxDuration = 300` en crons y rutas pesadas (el `60` inicial quedaba por debajo del default de 300 s). Documentado en `AGENTS.md`. |
| M3 | Schedule real de `expire-orders` y `VERCEL_PRODUCTION_URL` vigente | ⚠️ Schedule `*/5 * * * *` corre en realidad cada **~2–5 h** (historial de Actions: todas las corridas `success` pero con gaps de 2–5 h — best-effort severo). `VERCEL_PRODUCTION_URL` = `https://pancheria-alpha.vercel.app` (vigente, coincide con `AUTH_URL`). `CRON_SECRET` existe como repo secret. Documentado en `AGENTS.md`. Refuerza H11: la expiración efectiva de `pending` es `max(ORDER_EXPIRATION_MS, cadencia real)` — considerar cron nativo de Vercel o servicio externo si se necesita precisión. |
| M4 | Rate-limit stores en producción | ✅ `RATE_LIMIT_STORE_PROVIDER=db` definido en prod. `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` no definido → default `db` (hay `DATABASE_URL`). Correcto. |
| M5 | `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS` no activo | ✅ No está definida en producción (ni preview). `TRUSTED_PROXY_IP_HEADER` tampoco → se usa `x-vercel-forwarded-for` en Vercel. Correcto. |

---

## 8. Criterios de aceptación del plan

- **Fase 0 completa:** los polls GET ya no escriben en `public_order_rate_limits`; las dos rutas públicas calientes responden con `s-maxage`; `login_attempts` tiene retención; las 9 FKs indexadas y migración aplicada; pool configurable; `maxDuration` definido; refresh de catálogo acotado a `pageSize` + disponibilidad.
- **Fase 1 completa:** listados paginados; `expirePendingOrders` y limpiezas masivas acotados por presupuesto; retención de mensajes opt-in; huérfanos cubren `chat/`+`products/`+`videos/`; `/api/health` activo; duración por request logueada; tests de concurrencia en E2E; suite E2E con sharding; lookups con `branchId` obligatorio.
- **Fase 2:** multi-tenant operativo según `plan-implementacion-multi-tenant.md` + complementos §3.9; caché de servidor con invalidación por tag; decisión documentada sobre réplicas/agregaciones.

## 9. Riesgos y decisiones abiertas

1. **Staleness de catálogo/estado (T1):** aceptado ~40 s máximo; revisar si quejas de clientes → bajar `s-maxage` por env.
2. **Veto en memoria por instancia (T2):** los límites de poll se dividen entre instancias; aceptable como veto anti-abuso — si se observa abuso real, volver a DB con ventana más larga o agregar store compartido liviano.
3. **SSE en serverless (T13):** puede costar más que polling por facturación por duración — spike con medición antes de comprometerse.
4. **Paginación vs. terminal `/ventas` (T7):** el terminal necesita el catálogo completo para precalcular disponibilidad; no romper el contrato sin migrar el consumidor (lección §14).
5. **Retención de mensajes (T9):** borra historial de chat; opt-in por env y solo pedidos terminales — confirmar con el negocio el período antes de habilitarla.
6. **Migración multi-tenant (T14):** es la operación más riesgosa del roadmap (backup + staging + rollback, ya detallado en el plan original).

## 10. Referencias cruzadas

- `informes/archivados/auditoria-escalabilidad-2026-09-19.md` — hallazgos H1–H14, orden de quiebre y estimaciones.
- `prompts/plan-implementacion-multi-tenant.md` — diseño completo de la migración multi-tenant (T14 lo ejecuta + complementos).
- `informes/reporte-estado.md` §6 — pendientes volcados de la auditoría.
- `informes/entornos.md` — procedimiento de migraciones por entorno.
- `informes/checklist-pre-push.md` — verificaciones y variables de CI/E2E.
- `informes/lecciones-aprendidas.md` — patrones obligatorios (paginación en repositorio, errores por tipo, stores atómicos, E2E seguro).
- `informes/archivados/spike-sse-chat-2026-09-19.md` — spike T13: implementación SSE del chat, modelo de costo y decisión (opt-in deshabilitado).
