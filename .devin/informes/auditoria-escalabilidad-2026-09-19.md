# Auditoría de escalabilidad — Proyecto Panchería

**Fecha:** 2026-09-19
**Proyecto:** `pancheria`
**Baseline:** `62a644dd95d047a4a92c9215d74023fcf5e0e06b` (`main`, `feat: datos de sucursal al inicio de /pedido con mapa embebido`)
**Prompt:** `.devin/prompts/auditoria-escalabilidad.md`
**Alcance ejecutado:** lectura de las 9 áreas del prompt sobre el working tree (con cambios documentales preexistentes no atribuibles a esta auditoría); sin modificación de código de negocio ni comandos destructivos.

**Comandos corridos (solo lectura):**

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **157 suites, 1691 tests pasan** |
| `npm run knip` | Pasa (sin código/dependencias muertas) |
| `npm run build` | Pasa (51 rutas API, páginas públicas `force-dynamic`) |
| `npm run analyze:webpack` | Completa; reportes en `.next/analyze/`. Emite warnings `Critical dependency: the request of a dependency is an expression` originados en `src/lib/storage.ts:327-349` — son **intencionales** (imports dinámicos con nombre en variable para no cargar el SDK de AWS salvo `s3`/`r2`, documentado en el comentario de `src/lib/storage.ts:323-326`) |

**Nota de baseline:** el working tree ya traía cambios documentales sin commitear (`.devin/README.md`, `.devin/environment.yaml`, `informes/README.md`, `checklist-pre-push.md`, `reporte-estado.md`, `prompts/README.md`, `prompts/auditoria-pre-release.md`, `prompts/pancheria.prompt.md` y el nuevo `prompts/auditoria-escalabilidad.md`). Son la "mantenimiento documental 2026-09-19" registrada en `reporte-estado.md` §8; no se atribuyen a esta auditoría.

---

## 1. Veredicto

**Sí, con condiciones.** El sistema está bien preparado para escalar el negocio actual (una empresa con varias sucursales): las transacciones multi-tabla son atómicas, los locks tienen orden consistente, la idempotencia está resuelta a nivel DB, el rate limiting tiene store compartido por defecto en producción y las consultas calientes están indexadas. **No escala** en dos frentes concretos: (a) la carga de fondo de polling —todo el estado fresco se obtiene con requests HTTP que pegan directo a PostgreSQL, sin capa de caché ni canal push— se vuelve el primer cuello de botella alrededor de 10–50× el tráfico actual, principalmente por el upsert de rate limit por poll y por el refresco completo del catálogo público; y (b) **no existe frontera de tenant**: el aislamiento es solo por `branchId` pasado explícitamente, sin `tenantId`, sin resolución por subdominio y sin scope obligatorio en repositorios, por lo que el objetivo documentado de 10–50 comercios requiere la migración ya planificada en `prompts/plan-implementacion-multi-tenant.md` antes de ser viable.

## 2. Cuadro de riesgo

| # | Área | Hallazgo | Severidad | Probabilidad | Esfuerzo |
|---|---|---|---|---|---|
| H1 | Negocio / multi-tenancy | Sin frontera de tenant: aislamiento solo por `branchId` explícito | 🔴 Crítico (para el objetivo 10–50 comercios) | Certeza si se vende multi-tenant | Alto (plan ya documentado) |
| H2 | Backend / DB | Rate limit con upsert a DB por **cada poll** de chat/estado público | 🟡 Mayor | Alta a 10× | Bajo |
| H3 | Backend / Frontend | Refresco completo del catálogo público por visitante cada 30 s (limit = cargados, hasta 200) + `sucursal/estado`; sin caché CDN | 🟡 Mayor | Alta a 10× | Bajo-Medio |
| H4 | DB | FKs hijas sin índice: `sale_items.product_id`, `order_items.product_id`, `recipes.supply_id`, `sale_item_recipes.supply_id`, `order_item_recipes.supply_id`, `stock_movements.sale_id`/`order_id`, `orders.converted_sale_id`, `products.image_key` | 🟡 Mayor | Media (crece con el volumen histórico) | Bajo |
| H5 | DB | `login_attempts` crece sin retención y escribe una fila por intento fallido incluso para usuarios inexistentes (endpoint público) | 🟡 Mayor | Media | Bajo |
| H6 | Backend | Trabajo pesado dentro de una sola transacción/invocación: `restoreStockForDeletedCashRegisters` (cajas × ventas), `emptyTrash`, `calculateSummaryFromSales`, `expirePendingOrders` en lotes secuenciales | 🟡 Mayor | Media a 50× | Medio |
| H7 | DB / Serverless | Pool sin parámetros explícitos (`max`, timeouts); presión de conexiones si `DATABASE_URL` no usa el pooler de Neon | 🟡 Mayor | Media — **verificar en producción** | Bajo |
| H8 | Backend | Listados sin paginar: `GET /api/productos`, `GET /api/stock`, usuarios, videos, `listBranches` por request pública | 🟢 Menor | Alta a 50× (crece con catálogo) | Bajo |
| H9 | Multi-tenancy / Seguridad | `findByOrderNumberAndCustomer` sin filtro de sucursal y `findByImageKey` público sin `branchId` | 🟢 Menor hoy / 🟡 en multi-tenant | Media | Bajo |
| H10 | Storage | Limpieza de huérfanos solo cubre `chat/`; imágenes de producto y videos huérfanos no se purgan | 🟢 Menor | Media | Bajo |
| H11 | Observabilidad | Sin health check, métricas ni alerta de cron fallido; `expire-orders` depende del schedule best-effort de GitHub Actions | 🟢 Menor | Media | Bajo |
| H12 | Testing / CI | Sin tests de concurrencia/carga (oversell, carreras de cancelación); suite E2E sin sharding crece lineal | 🟢 Menor | Media | Medio |
| H13 | Frontend | Bundle acotado (~1,9 MB JS total, chunk mayor ~240 KB); warnings de webpack intencionales | ⚪ Informativo | — | — |
| H14 | Serverless | Sin `maxDuration` explícito en crons ni rutas pesadas | 🟢 Menor | Media | Bajo |

## 3. Hallazgos detallados

### 3.1 Base de datos

**Índices — cobertura buena en lo caliente, con huecos en FKs hijas (H4).** Las consultas frecuentes están cubiertas: `orders` tiene índices por `branch_id`, `status`, `created_at`, compuesto `branch_status_deleted_at`, `order_number`, `customer_name`, `customer_phone` y unique compuesto `(branch_id, idempotency_key)` (`src/db/schema.ts:352-372`); `order_messages` por `order_id`, `order_id+created_at`, `sender+read_at` y `attachment_key` (`schema.ts:490-500`); `sales` por sucursal/fecha/caja e idempotencia única (`schema.ts:274-286`); `order_stock_reservations` por pedido, producto y `branch+product` (`schema.ts:461-463`). Sin embargo, varias FKs "hijas" carecen de índice y las tablas asociadas crecen con cada venta/pedido: `sale_items.product_id` (`schema.ts:314`, solo se indexa `sale_id` en `:322`), `order_items.product_id` (`:384`, solo `order_id` en `:392`), `recipes.supply_id` (`:185`, solo `compound_product_id` en `:195`), `sale_item_recipes.supply_id` (`:403`), `order_item_recipes.supply_id` (`:427`), `stock_movements.sale_id`/`order_id` (`:517-518`), `orders.converted_sale_id` (`:342`) y `products.image_key` (`:152`). Estas columnas se consultan en `findReferencedProductIds` (`src/repositories/productRepository.ts:366+`) antes de hard-deletes y en `findByImageKey` (`productRepository.ts:338-359`) en cada servido de imagen no cacheado por CDN. **Demostración:** con 100k `sale_items`, borrar productos referenciados o resolver `GET /api/productos/imagen/[key]` ejecuta seq scans. **Fix:** migración Drizzle con índices en las columnas listadas.

**Transacciones y concurrencia — correctas (lo que está bien).** `executeInTransaction` propaga el `tx` por AsyncLocalStorage (`src/application/transactionService.ts`); el orden de locks es consistente — productos ordenados por id (`productRepository.lockForUpdate`, `ORDER BY id ASC` + `FOR UPDATE`) antes que la fila de caja — en confirmación de venta, cancelación y conversión de pedido; el decremento es atómico (`stock - quantity` con guarda `stock >= quantity`); pedidos y ventas insertan con `onConflictDoNothing`/lookup por `(branch_id, idempotency_key)` (`orderRepository.ts:315-322`, `schema.ts:284-286,370-372`). Un `pending` expirado **no retiene stock**: las reservas se crean recién en `receiveOrder` (`orderService.ts:611+`), y `cancelExpiredOrder` libera reservas legadas por las dudas (`orderService.ts:791-804`). La contención real aparece en productos populares compartidos y en la única caja abierta por sucursal — aceptable hoy, contar en el orden de quiebre.

**Crecimiento sin retención (H5 + informativo).** `login_attempts` solo se depura al login exitoso o al eliminar el usuario (`rate-limit-store.ts:81-87`); el cron `rate-limit-cleanup` solo borra `public_order_rate_limits` (`public-order-rate-limit-store.ts:113-119`, `vercel.json:4-6`). Como `verifyCredentials` registra el intento aunque el usuario no exista (`authService.ts:44-46`), un atacante puede inflar la tabla con usernames arbitrarios — crecimiento no acotado más una escritura por intento. `order_messages` y `stock_movements` tampoco tienen retención (auditoría deliberada para movimientos; los mensajes de pedidos cerrados hace >N días son candidatos a purga). **Fix:** extender `rate-limit-cleanup` con TTL por `lastAttempt`/`resetAt`, y política de retención de mensajes.

**Neon serverless (H7).** `src/db/index.ts:29-46` crea un pool lazy a nivel módulo — `NeonPool` si la URL contiene `neon.tech`, `PgPool` si no — sin `max`, `connectionTimeoutMillis`, `idleTimeoutMillis` ni `statement_timeout`. El default de `pg`/`@neondatabase/serverless` es ~10 conexiones por instancia; cada instancia serverless caliente abre su propio pool. Con M instancias concurrentes la presión hacia Neon es ~10·M. **Verificar en producción:** que `DATABASE_URL` apunte al endpoint `-pooler` de Neon (si apunta directo, el límite de conexiones del plan se agota mucho antes), límites de compute del plan y si conviene fijar `max`/`connectionTimeoutMillis` explícitos.

### 3.2 Backend / API

**Estado en memoria — acotado y con default correcto.** Los únicos `Map`/singletons de proceso son los rate-limit stores en modo `memory` (`rate-limit-store.ts:21-52`, `public-order-rate-limit-store.ts:27-80`) y los singletons de store (`rate-limit-store.ts:90-97`) y de `db` (`db/index.ts:29`). En producción con DB el default es el store `db` atómico (`public-order-rate-limit-store.ts:137-139`, `rate-limit-store.ts:118-120`), correcto para multi-instancia. Riesgo residual: `RATE_LIMIT_STORE_PROVIDER=memory`/`PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=memory` en producción divide los límites entre instancias y crece en memoria — la decisión queda a la configuración; la guarda existe.

**Rate limit cobra en escrituras de DB por cada poll (H2).** `createRateLimiter` envuelve `store.recordRequest` (`rate-limit.ts:66-86`) y se aplica también a los GET de polling: `GET /api/public/pedido/[id]/chat` (`route.ts:44`), `GET .../estado` (`route.ts:40`), `/seguimiento`, `/cancelar`, `/chat/leido`, `/chat/upload` y `/api/pedidos/[id]/chat/ubicacion`. En modo `db` cada llamada ejecuta `INSERT ... ON CONFLICT DO UPDATE` (`public-order-rate-limit-store.ts:93-108`). Con el default de `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS=5000` (`config/chat.ts:7-15`), 100 chats abiertos ≈ **20 upserts/s sostenidos** antes de cualquier lectura — y a eso se suman ~5 roundtrips del propio `listClientMessages` (`chatService.ts:229-262`: `findByIdWithToken` + `getBranchById` + `listMessages` + `countByOrderId` + escritura condicional `markAllAsDelivered`). **Fix recomendado:** no contabilizar los GET de polling en el mismo contador que los POST (scope separado con ventana generosa, o rate-limit solo en escrituras), o servir el poll con `ETag`/`304`.

**Polling — estimación de carga con defaults.** Cada request pega a Neon (todo `force-dynamic`, sin `unstable_cache`):

| Fuente | Intervalo default | Roundtrips aprox. por poll |
|---|---|---|
| Chat cliente `useOrderChat` | 5 s (`config/chat.ts:9`) | 1 upsert + ~5 (chatService.ts:240-250) |
| Catálogo `/pedido` `usePedidoClient` | 30 s (`config/catalog.ts:10`) | ~6: `getBranch` + `findPublicProducts` + `countPublicProducts` + `calculateAvailabilityForProductIds` (3) — `catalogService.ts:95-123` |
| `sucursal/estado` (mismo poll de 30 s) | 30 s | 2 (`getBranchById` + `getOpenCashRegister`) |
| Panel `/api/panel/resumen` | 30 s (`config/dashboard.ts:9`) | ~5: resumen caja + todos los productos activos (`stockService.listStockAlerts`, `stockService.ts:13-25`) + `countOrdersByStatus` — `route.ts:13-17` |
| Caja `/api/caja/resumen` | 5 s (`config/caja.ts:32-33`) | ~3-4 |
| Pedidos operador | deshabilitado (`config/orders.ts:41-47`) | paginado si se activa |

A favor: `useVisibilityPolling` pausa en pestañas ocultas (`use-visibility-polling.ts:58-75`) y el chat aplica backoff exponencial hasta 8× ante errores (`useOrderChat.ts:449-475`). En contra: `refreshCatalog` pide `limit = max(loadedCount, pageSize)` — un visitante que cargó 4 páginas refresca ~200 productos con disponibilidad cada 30 s (`usePedidoClient.ts:284-291`); y `getDefaultBranchId` hace `SELECT` de todas las sucursales + búsqueda en memoria por request sin `branchId` (`branch-resolver.ts:51-65`).

**Serverless — duración y trabajo pesado (H6, H14).** Ninguna ruta exporta `maxDuration`; el límite del plan de Vercel aplica — **verificar en producción**. Los puntos pesados: `expirePendingOrders` procesa pedidos en lotes de 200 con una transacción por pedido (`orderService.ts:725-772`); `restoreStockForDeletedCashRegisters` recorre cajas × ventas activas reconstruyendo contexto de producto por venta dentro de **una** transacción (`cashRegisterService.ts:389-437`, invocado por `emptyTrash` en `:465-475`); `calculateSummaryFromSales` carga todas las ventas activas con items+snapshots+pagos al cerrar/recalcular caja (`cashRegisterService.ts:144-164`); `branchService.deleteBranch` junta claves de archivos y metadatos antes de la cascada. Los uploads remotos **no** pasan por la función: `preparar` devuelve instrucciones y el binario va directo a Blob/S3/R2 vía presigned post (`storage.ts:361-379`); `/api/videos/upload` rechaza providers no-`local` (`route.ts`). **Fix:** `maxDuration` explícito en crons, batching con presupuesto de tiempo en `expirePendingOrders`, y mover limpiezas masivas a lotes fuera de la transacción principal.

**Cron `expire-orders` por GitHub Actions (H11).** `.github/workflows/expire-orders.yml:6` corre `*/5 * * * *`; los schedules de GitHub son best-effort (demoras frecuentes de minutos). Confirmado en código: un `pending` atrasado no retiene stock (`orderService.ts:791-792`), así que el impacto es solo de higiene del panel. Riesgo real: silencio — si el cron falla no hay alerta.

### 3.3 Frontend

- **Bundle acotado (H13):** ~1,9 MB de JS total en 126 archivos, ~2,4 MB bajo `.next/static`, chunk mayor ~240 KB (`analyze:webpack`). Los warnings `Critical dependency` de `storage.ts` son intencionales (ver encabezado).
- **`force-dynamic` en lo público:** `/pedido`, `/pedido/[id]/chat` y todas las APIs dinámicas → cada visita es SSR + queries. Correcto para stock/precio en vivo, pero el catálogo **podría** cachearse unos segundos en CDN (`s-maxage` corto + `stale-while-revalidate`) sin romper la frescura percibida: el propio cliente ya tolera 30 s de staleness entre polls. Esta es la palanca de mayor impacto/costo para absorber el H3.
- **Waterfalls:** el flujo `/pedido` encadena SSR (resolver sucursal + catálogo) y luego polls; `recent-orders-banner` verifica estado una sola vez por pedido (`recent-orders-banner.tsx:44-72`) — sin polling extra. OK.

### 3.4 Caching y consistencia

No existe estrategia de caché de servidor: ni `unstable_cache`, ni `revalidate`, ni headers de caché en APIs de lectura (la única excepción es el servido de imágenes con `Cache-Control: public, max-age=86400` — `api/productos/imagen/[key]/route.ts:53`; adjuntos de chat van `private, no-store` — `api/chat/attachment/[key]/route.ts:90`, correcto por privacidad). Consecuencia: toda la carga de polling del §3.2 pega directo a PostgreSQL. Recomendación concreta: `s-maxage=5-15, stale-while-revalidate=30` en `GET /api/public/catalogo` y `/api/public/sucursal/estado`, e invalidación por tag (`revalidateTag`) al mutar productos/stock si se adopta `unstable_cache` más adelante.

### 3.5 Autenticación, seguridad y multi-tenancy

- **Sesiones JWT** (`auth.config.ts:41-42`) — escalan sin consultas a DB por request; los datos de sucursal viajan en el token (`auth.config.ts:75-78`). Riesgo de versión beta ya documentado en auditorías previas.
- **Autorización por sucursal:** el patrón `getCurrentBranchIdOrRedirect` (SC) / `getCurrentBranchId`→403 (API) se sostiene; admin cambia de sucursal por cookie `activeBranchId`. Es una defensa por convención: cada ruta/servicio debe recordar filtrar — sin una frontera central, un olvido es una fuga (ver H9).
- **H9 — lookups sin scope:** `findByOrderNumberAndCustomer` filtra por `order_number` + nombre/teléfono pero **no** por sucursal (`orderRepository.ts:408-435` — el propio comentario admite que `orderNumber` es único solo por sucursal); con tenants que compartan numeración, el seguimiento público puede resolver pedidos ajenos. `findByImageKey` acepta `branchId` opcional y el servido público lo omite (`api/productos/imagen/[key]/route.ts:32`). Hoy el daño es acotado (verificación por datos del cliente; imágenes no sensibles); en multi-tenant es una fuga cross-tenant directa.
- **Rate limit por IP:** resolución de IP correcta en Vercel (`x-vercel-forwarded-for`) con escape explícito y documentado para otros proxies (`rate-limit.ts:22-64`). En multi-tenant los límites siguen siendo por IP, no por tenant — el plan lo contempla.

### 3.6 Storage y archivos

- Uploads remotos presignados (el binario no pasa por la función) — bien. `/api/videos/upload` es solo para `local`.
- **`STORAGE_PROVIDER=local` en producción** está bloqueado a build-time (`next.config.ts:105-108`) con warning runtime adicional — resuelto por la auditoría de deploy.
- **H10 — huérfanos parciales:** `chat-attachments-cleanup` solo lista el prefijo `chat/`; una imagen de producto subida con éxito pero cuyo `createProduct` falla queda huérfana sin purga (ídem videos). Impacto: costo de storage creciente, no funcional.
- Servido de adjuntos de chat: `private, no-store` + lookup por `attachment_key` (indexado) — correcto; cada vista pega a DB + storage, aceptable por privacidad.

### 3.7 Observabilidad y operación

- `logger` emite JSON en producción y serializa `Error` de forma controlada (`logger.ts:33-55`) — suficiente para Vercel logs; sin datos sensibles por diseño.
- **H11:** no hay health check, ni métricas de duración de queries, ni alerta si un cron falla o si el rate limiter se dispara masivamente. El manejo de errores de API es consistente (`api-handler` mapea `NotFoundError`→404, `DomainError`→400, `ForbiddenError`→403) — bien.

### 3.8 Testing, CI/CD y deuda técnica

- Unit: 157 suites / 1691 tests — incluyen casos de rate limit, idempotencia y stock, pero **no hay tests de concurrencia real** (oversell con pedidos simultáneos, carrera cancelación-vs-recepción): la protección existe en código (locks + `ON CONFLICT`) sin prueba que la ejercite (H12).
- CI: gates `lint`/`typecheck`/`unit-tests`/`build`/`knip` paralelos + E2E con base remota descartable (`ci.yml`). La suite E2E (121 tests al 2026-09-15, ahora más) corre en un solo job — a medida que crece, el pipeline se alarga lineal; evaluar `playwright --shard`.
- Dependencias riesgosas ya conocidas: `next-auth@beta`, `drizzle-orm@0.x`, override de `nanoid` — documentado en `reporte-estado.md`/`lecciones-aprendidas.md`; no se re-deriva aquí.
- `knip` limpio — sin código muerto que oculte problemas.

### 3.9 Escalabilidad del negocio

**H1 — la brecha central.** Hoy el aislamiento es `branchId` explícito en cada firma de servicio/repositorio, sucursal activa por cookie para admin, y `?branchId=` o `DEFAULT_BRANCH_NAME` en lo público. No hay entidad tenant, ni resolución por subdominio, ni contexto obligatorio que haga imposible omitir el filtro. Para 10–50 comercios esto exige la migración ya diseñada en `prompts/plan-implementacion-multi-tenant.md` (entidades tenant, `tenantId` en tablas de negocio, resolución por subdominio, contexto `AsyncLocalStorage`, repositorios tenant-scoped, auth y rate limits por tenant, storage namespaced, tests de aislamiento). El trabajo adicional que esta auditoría suma al plan:

1. **Backfill e índices compuestos:** agregar `tenant_id` a ~15 tablas, rellenar con tenant default, y rehacer los índices `branch_*` como `(tenant_id, branch_id, ...)` — los índices actuales de `orders`/`sales`/`products` quedan cortos sin prefijo de tenant.
2. **Cerrar los lookups sin scope (H9)** antes de abrir el segundo tenant.
3. **`getDefaultBranchId`/`listBranches` por request pública** deben resolver por subdominio con caché, no por scan + variable de entorno (`branch-resolver.ts:51-65`).
4. **Configuración por tenant en DB** (nombre, branding, horarios, límites) en lugar de `DEFAULT_*`/`NEXT_PUBLIC_*` por despliegue.

**Pico "viernes a la noche" (200 pedidos simultáneos, 20 operadores):** el primer cuello no es el insert del pedido (idempotente, transacción corta) sino la combinación de: locks sobre los productos populares compartidos + la única caja abierta por sucursal durante `receiveOrder`→`paid`, y el ruido de polling concurrente de esos mismos operadores (caja 5 s + panel 30 s + chats). Sostenible a ese volumen puntual; a 10× sostenido entra el §4.

**Costos (estimación, no verificable en código):** con defaults actuales el gasto dominante al ×10 son las invocaciones serverless de Vercel y los roundtrips a Neon del polling (orden: cientos de miles de invocations/día extra por cada ~100 visitantes concurrentes sostenidos). Un `s-maxage` corto en las dos rutas públicas calientes reduce ese término de forma más que lineal. Storage y egress son menores mientras los uploads sigan presignados.

## 4. Orden de quiebre estimado

> **Estimación** con supuestos explícitos: una empresa, ~50–200 productos activos, defaults de intervalos (chat 5 s, catálogo/sucursal/panel 30 s, caja 5 s), `DATABASE_URL` con pooler de Neon, plan estándar de Vercel. "Carga" = multiplicador sobre el tráfico actual de un comercio.

**A 10×** (~10–20 operadores, ~500–1.000 visitantes públicos concurrentes, ~100 chats abiertos):
- Lo primero que degrada: **latencia y timeouts en chat público y catálogo** — ~20 upserts/s de rate limit + ~300–600 roundtrips/s de polling hacia Neon, y cada instancia serverless comparte su pool de ~10 conexiones; las colas de conexión se manifiestan como TTFB errático. `login_attempts` y `public_order_rate_limits` ya crecen visiblemente (la primera sin cleanup).
- Síntoma esperado: 429/timeout intermitentes en polls, no corrupción de datos.

**A 50×** (~50–100 operadores, ~2.500–5.000 visitantes):
- **Contención de locks en `products` y la caja abierta**: picos de pedidos sobre los mismos insumos serializan confirmaciones; transacciones largas (`emptyTrash`, cierre de caja con muchas ventas) sostienen locks y amplifican esperas.
- Los listados sin paginar (`/api/productos`, `/api/stock`, usuarios) pesan en memoria y payload; los seq scans por índices faltantes (H4) se notan en borrados y servido de imágenes frías.
- Presión de conexiones: ~10·M conexiones hacia Neon; si la URL no es la del pooler, **se agota el límite del plan** (verificar en producción).
- CI: la suite E2E en un solo shard se vuelve cuello del pipeline.

**A 100× / 10–50 tenants:**
- **Bloqueante estructural, no de capacidad:** sin `tenantId` no hay forma segura de hospedar comercios ajenos — `?branchId=` público, cookie de sucursal admin y los lookups sin scope (H9) mezclan datos entre tenants. No es "se degrada": es "no se puede abrir".
- Forzado igual: el polling multi-tenant satura el rate-limit DB y Neon (~100+ upserts/s solo de chat), `listBranches`/`getDefaultBranchId` por request pública, y los `COUNT(*)`+página de cada listado paginado se pagan ×50 tenants.

## 5. Plan de acción

**Quick wins (<1 día), ordenados por impacto/esfuerzo:**

1. **Caché CDN corto en las rutas públicas calientes** (H3): `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` en `GET /api/public/catalogo` y `/api/public/sucursal/estado`. Absorbe el grueso del polling masivo sin cambiar la frescura percibida (el cliente ya tolera 30 s).
2. **Sacar los GET de polling del contador de rate limit** (H2): scope separado con máximo alto o contar solo escrituras (POST/mensajes/upload); el check de IP puede quedar como veto solo ante abuso.
3. **Cleanup de `login_attempts`** (H5): extender `rate-limit-cleanup` con borrado por `lastAttempt` viejo; evaluar no persistir intentos de usuarios inexistentes.
4. **Índices en FKs hijas + `products.image_key`** (H4): una migración Drizzle, bajo riesgo.
5. **Pool explícito** (H7): fijar `max`, `connectionTimeoutMillis`, `idleTimeoutMillis` y **verificar en producción** que la URL use `-pooler`.
6. **`maxDuration` en crons y rutas pesadas** (H14) y `limit` del refresh de catálogo acotado a la primera página (H3 parcial).

**Corto plazo (<1 sprint):**

7. Paginación en `GET /api/productos`, `/api/stock`, usuarios y listado de videos (H8).
8. Batching con presupuesto de tiempo en `expirePendingOrders`; limpiezas masivas (`emptyTrash`, `deleteBranch`) en lotes fuera de una única transacción (H6).
9. Retención de `order_messages` de pedidos cerrados >N días y ampliar cleanup de huérfanos a `products/` y `videos/` (H10).
10. Health check + alerta de cron fallido (p. ej. chequear `last run` del endpoint) y logging de duración por request (H11).
11. Tests de concurrencia para oversell y carrera cancelación/expiración (H12); sharding de Playwright.
12. **SSE para chat/panel** (estimación: 1–2 sprints para chat) — elimina el polling de 5 s, que es el mayor generador de escrituras por rate limit; el catálogo puede seguir con polling + caché CDN.

**Estratégicos (>1 sprint):**

13. **Migración multi-tenant** según `plan-implementacion-multi-tenant.md` + los 4 puntos del §3.9 (backfill `tenant_id`, índices compuestos, resolución por subdominio cacheada, scope obligatorio en repositorios, cierre de H9, config por tenant en DB).
14. Capa de caché de servidor (`unstable_cache` o Redis) para catálogo/sucursal con invalidación por tag al mutar stock/productos.
15. Evaluar réplicas de lectura o separación de agregaciones pesadas (resúmenes de caja) del camino transaccional.

## 6. Lo que está bien

- Transacciones multi-tabla atómicas con propagación por AsyncLocalStorage y **orden de locks consistente** (productos por id → caja) en confirmar/cancelar/convertir — deadlock risk bajo.
- Idempotencia real en DB: unique `(branch_id, idempotency_key)` + `onConflictDoNothing` en pedidos y ventas.
- Decremento de stock atómico con guarda `stock >= quantity`; `FOR UPDATE` ordenado.
- Índices sobre las consultas calientes (pedidos por sucursal/estado, mensajes por pedido, reservas por producto, cajas por estado).
- Chat con cursores (`before`/`after`), paginación y backoff exponencial ante errores; `useVisibilityPolling` pausa en pestañas ocultas.
- Rate limiting con store `db` atómico y default correcto en producción; resolución de IP cuidadosa con escapes explícitos.
- Uploads presignados: el binario nunca atraviesa la función serverless con providers remotos.
- Validación de producción en build (`next.config.ts`): `CRON_SECRET`, auth, DB, `STORAGE_PROVIDER≠local`.
- Crons protegidos por `CRON_SECRET`; `pending` no reserva stock → un cron atrasado no corrompe inventario.
- Suite unitaria amplia (1691 tests), `knip` limpio, E2E con guardas anti-producción.
- Bundle acotado (~1,9 MB JS total).

## 7. Verificar en producción / no verificable

- Que `DATABASE_URL` use el endpoint `-pooler` de Neon y los límites de conexiones/compute del plan contratado.
- `maxDuration` efectivo aplicable a las rutas cron según el plan de Vercel.
- Schedule real de GitHub Actions para `expire-orders` (best-effort) y si el dominio `VERCEL_PRODUCTION_URL` sigue vigente (pendiente recurrente ya documentado).
- Cifras de costos del §3.9: estimación sobre supuestos declarados, no medida.

## 8. Referencias cruzadas

- Plan de migración: `.devin/prompts/plan-implementacion-multi-tenant.md` (propuesta no iniciada; este informe agrega los ítems del §3.9).
- Pendientes heredados de la auditoría de deploy: `informes/archivados/auditoria-deploy-vercel-2026-09-14.md` (verificación periódica de `VERCEL_PRODUCTION_URL`, ya en `checklist-pre-push.md`).
- Estado vigente y convenciones: `informes/reporte-estado.md`, `informes/lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md`.
