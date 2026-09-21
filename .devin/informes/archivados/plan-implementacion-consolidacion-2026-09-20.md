# Plan de implementación — Consolidación pre-multi-tenant

> **Fecha:** 2026-09-20
> **Estado:** completado — archivado el 2026-09-20
> **Objetivo:** cerrar todos los pendientes del plan de escalabilidad (`plan-implementacion-escalabilidad-2026-09-19.md`) **excepto T14 (multi-tenant)**, que queda explícitamente diferido hasta que el proyecto quede firme.
> **Fuente:** pendientes reportados al 2026-09-20 sobre `aee6f39` (`main`).

## Alcance

| # | Pendiente origen | Tarea | Tipo |
|---|---|---|---|
| E1 | T15 (Fase 2) | Caché de servidor con `unstable_cache` + invalidación por tag en lecturas calientes | Código |
| E2 | Observación de diseño (corrida E2E, 2ª pasada) | `validateCartAvailability` descuenta reservas activas también fuera de transacción (preview del terminal pesimista) | Código |
| E3 | M3 ⚠️ (cron GH Actions corre cada ~2–5 h) | Expiración lazy de pedidos `pending` en lecturas + documentación de cadencia real | Código + docs |
| E4 | T9 opt-in | Activar `ORDER_MESSAGES_RETENTION_DAYS=90` en producción | Config prod |
| E5 | Fase M residual | Verificar migración `0031` en prod, corregir `POSTGRES_URL_NON_POOLING`, revisar `DATABASE_POOL_MAX` | Ops prod |
| E6 | T16 + decisiones | Documentar evaluación de réplicas/agregaciones y decisiones SSE (off) / sharding E2E (diferido) | Docs |

**Decisiones del usuario (2026-09-20):** retención de mensajes = **90 días**; SSE = **mantener deshabilitado**; sharding E2E = **diferir**; producción = **verificar y corregir** vía MCPs.

**Fuera de alcance:** T14 (multi-tenant) y sus complementos §3.9. Las tareas aquí no deben contradecir el plan multi-tenant (tags y scopes ya pensados para prefijarse por tenant más adelante).

---

## E1 — Caché de servidor (T15)

**Diseño (verificado contra Next 16.3.3):** `unstable_cache` sigue soportado sin `cacheComponents` (guía "Caching without Cache Components"). `revalidateTag` exige 2.º argumento en Next 16: se usa `{ expire: 0 }` (invalidación dura: la próxima request revalida bloqueante) porque las mutaciones las dispara el operador y deben reflejarse de inmediato.

**Nota de serialización:** el data cache serializa valores; los `Date` pueden volver como `string`. Los wrappers reviven `createdAt`/`updatedAt`/`deletedAt` con `new Date(...)` (idempotente si el serializer preserva `Date`).

### Archivos

- **Nuevo `src/config/cache.ts`:** `getDataCacheRevalidateSeconds()` → `DATA_CACHE_REVALIDATE_S` (default `60`; `≤0` deshabilita la capa entera = kill switch sin deploy).
- **Nuevo `src/lib/server-cache.ts`:** wrappers + helpers de invalidación:
  - `DATA_CACHE_TAGS = { branches: 'branches', publicCatalog: 'public-catalog' }`
  - `getCachedBranchById(id)` → tag `branches`
  - `getCachedBranchIdByName(name)` → tag `branches` (devuelve `number | null`, para `getDefaultBranchId`)
  - `getCachedBranchList(limit)` → tag `branches` (para `listPublicBranches`)
  - `getCachedPublicCatalogBase(branchId, limit, offset)` → `{ products, total }`, tag `public-catalog` (productos + count; **sin disponibilidad**: se sigue calculando en vivo)
  - `invalidateBranchesCache()` / `invalidatePublicCatalogCache()` → `revalidateTag(tag, { expire: 0 })`
- **`src/application/services/branchService.ts`:** `getBranchById` delega al wrapper cacheado (beneficia a todos los callers calientes: chat, catálogo, estado, auth). `getBranchByName` **no** se cachea (la usa `createBranch` para unicidad — debe ser fresca).
- **`src/lib/branch-resolver.ts`:** `listPublicBranches` → `getCachedBranchList`; `getDefaultBranchId` → `getCachedBranchIdByName`.
- **`src/application/services/catalogService.ts`:** `findPublicProducts` + `countPublicProducts` → `getCachedPublicCatalogBase`. `getBranch` queda igual (ya pasa por el servicio cacheado).
- **`src/app/api/public/sucursal/estado/route.ts`:** sin cambios (usa `branchService.getBranchById`, ya cacheado; `getOpenCashRegister` sigue en vivo → `isOpen` fresco).
- **Invalidación** (`revalidateTag` en la capa de rutas/actions, no en servicios — convención existente de `revalidatePath` y compatibilidad con Jest):
  - Tag `branches`: `(panel)/sucursales/actions.ts` (create/update/delete).
  - Tag `public-catalog`: `(panel)/productos/actions.ts` (delete/restore/permanent), `POST /api/productos`, `PUT`/`DELETE /api/productos/[id]`, `DELETE /api/productos/eliminadas` (emptyTrash). En `deleteBranchAction` se invalidan **ambos** tags.
  - No hace falta invalidar en ventas/stock/pedidos: el payload cacheado no incluye stock ni disponibilidad (calculada en vivo). Recetas tampoco afectan `findPublicProducts` (filtro = `isActive` + tipo vendible).

### Tests

- `jest.config.ts`: `moduleNameMapper` global `'^next/cache$' → tests/mocks/next-cache.ts` (stub: `unstable_cache` passthrough, `revalidateTag`/`revalidatePath`/etc. no-op). Evita que la capa de caché rompa tests unitarios fuera del runtime de Next.
- `src/config/cache.test.ts`: defaults, parseo, deshabilitado.
- Tests existentes de `catalogService`, `branchService`, `branch-resolver` deben seguir verdes sin tocarlos (el stub hace passthrough y los repos siguen mockeados).

### Riesgos

- Staleness ≤ `DATA_CACHE_REVALIDATE_S` (60 s) en datos de sucursal si una mutación no pasara por los puntos de invalidación listados — mitigado por TTL corto + invalidación explícita. En prod se suma al `s-maxage` del CDN (T1): peor caso percibido ≈ TTL + 40 s para datos de sucursal; precio/disponibilidad del catálogo se recalculan en vivo salvo la ventana CDN.
- Entradas cacheadas de `null` (sucursal inexistente) expiran por TTL o al crear la sucursal (tag `branches`).

---

## E2 — Preview de disponibilidad consciente de reservas

**Problema:** `validateCartAvailability` solo descuenta reservas `in_process` cuando se invoca dentro de transacción (guarda `&& dbOrTx`, `product-helpers.ts`). El preview del terminal (`POST /api/ventas/disponibilidad`, sin tx) y `validatePublicCart` con ítems quedan optimistas: muestran stock que ya está reservado.

**Cambio:** quitar la guarda `&& dbOrTx` y usar `dbOrTx ?? db` — dentro de tx lee con el cliente transaccional (consistencia con los locks); fuera de tx lee con el pool global, igual que `calculateAvailabilityForProductIds` (que ya descuenta siempre).

**Efecto:** el terminal de ventas y el checkout público muestran la misma disponibilidad pesimista que el catálogo. La confirmación transaccional ya era correcta; esto alinea el preview.

**Tests:** el mock `findActiveReservationsByProductIds` ya devuelve `[]` por defecto en `saleService.test.ts` → suite intacta. Agregar test: preview sin tx descuenta reservas (mock con reserva activa → availability reducida + shortage si aplica).

---

## E3 — Expiración lazy de pendings + cadencia real del cron (M3)

**Problema:** `expire-orders` corre por GitHub Actions `*/5` pero en la práctica cada ~2–5 h; Vercel Hobby solo permite 2 crons/día (ya usados por `rate-limit-cleanup` y `chat-attachments-cleanup`), así que no hay slot para un cron nativo. Mientras tanto un `pending` vencido sigue mostrándose como vigente en seguimiento público y en el panel.

**Cambio (código):** helper privado en `orderService` que expira pedidos `pending` con `createdAt` más viejo que `ORDER_EXPIRATION_MS`, reusando `cancelExpiredOrder` (idempotente, con lock). Se aplica en:

- `trackOrder` (seguimiento público): si el pedido estaba vencido se devuelve `status: 'cancelled'` sin `cancellationToken`/`expiresAt`.
- `getOrderById` (detalle operador): refleja `cancelled` si se expiró.
- `getPendingOrders` y `getOrders` (listados del panel): expiran los pendings vencidos de la página y los remueven de `items`/`total`.

Las lecturas del chat **no** expiran (siguen siendo read-only y ya reportan `isExpired`). `receiveOrder` no cambia: si el operador recibe un pending vencido es una decisión humana explícita.

**Docs:** `AGENTS.md` y `entornos.md` documentan la cadencia real (~2–5 h) y que la expiración efectiva es `max(ORDER_EXPIRATION_MS, cadencia real)` salvo lecturas (que expiran en el momento). Si se necesita precisión: upgrade de plan Vercel o cron externo.

**Tests:** unitarios en `orderService.test.ts` — pedido vencido se cancela al leerlo (trackOrder/getOrderById/getPendingOrders), pendiente fresco intacto, `DomainError` tolerado.

---

## E4 — Retención de mensajes (90 días)

- `ORDER_MESSAGES_RETENTION_DAYS=90` en el environment de **producción** de Vercel (vía MCP). Ya implementado en `chat-attachments-cleanup`; libera `attachmentKey` de storage.
- No se define en desarrollo/E2E (preserva fixtures).
- Documentar la activación en `reporte-estado.md`.

## E5 — Verificaciones de producción (MCP Neon/Vercel)

1. Neon: confirmar que la migración `0031` (índices T4) está en `drizzle.__drizzle_migrations` de la base productiva; si falta, aplicarla según `entornos.md` §Producción.
2. Vercel: `POSTGRES_URL_NON_POOLING` apunta al host `-pooler` (mal rotulado) → corregir al endpoint directo (mismo valor que `DATABASE_URL_UNPOOLED`).
3. Vercel: revisar si `DATABASE_POOL_MAX` está definida; con 0.25 CU fijos mantenerla baja (≤5) o sin definir. Documentar.

## E6 — Evaluaciones y decisiones (docs)

- **T16 (réplicas/agregaciones):** decisión = **no implementar** a esta escala. Con pooler + pool configurable + resumen paginado (`CAJA_SUMMARY_PAGE_SIZE`) y caché E1, el volumen actual no lo justifica. Umbral de revisión documentado: latencia p95 del resumen de caja > 2 s, saturación de pool, o >50k ventas/caja.
- **SSE:** permanece opt-in deshabilitado (`NEXT_PUBLIC_CHAT_STREAM_ENABLED` sin definir). El spike queda disponible si el polling vuelve a ser cuello de botella.
- **Sharding E2E:** diferido; la suite (127 tests) corre dentro del timeout de 20 min. Criterio para activar: duración > ~10 min de reloj → aprovisionar `E2E_DATABASE_URL_SHARD<N>` por shard + `E2E_SHARDS`.

## Verificación final

`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run knip`, `npm run build`. Actualizar `reporte-estado.md` §6 (pendientes) al cerrar.

---

## Resultados de ejecución (2026-09-20)

| Tarea | Resultado |
|---|---|
| E1 | ✅ `src/config/cache.ts`, `src/lib/server-cache.ts`, `tests/mocks/next-cache.ts` + mapping en `jest.config.ts`; consumidores cableados (`branchService`, `branch-resolver`, `catalogService`); invalidación en actions/rutas de productos y sucursales. `getBranchByName` quedó sin uso y se eliminó (knip). |
| E2 | ✅ `validateCartAvailability` descuenta reservas con `dbOrTx ?? db` (`product-helpers.ts`); test nuevo en `saleService.test.ts` (stock 8 − 4 reservadas − 2 del carrito → disponibilidad 1). |
| E3 | ✅ Expiración lazy en `trackOrder`/`getOrderById`/`getPendingOrders`/`getOrders` vía `cancelExpiredOrder` (lock `findByIdForUpdate`, razón `Expiración automática por inactividad`); tests nuevos en `orderService.test.ts`; cadencia real documentada en `AGENTS.md`. |
| E4 | ✅ `ORDER_MESSAGES_RETENTION_DAYS=90` creada en Vercel production (MCP). Toma efecto en el próximo deploy. |
| E5 | ✅ Migración `0031` aplicada manualmente en Neon `main` (9 índices + fila en `__drizzle_migrations`, hash sha256 `a59147…a5c`, `created_at` `1789855919182`); 32 migraciones verificadas. `POSTGRES_URL_NON_POOLING` corregida al endpoint directo. `DATABASE_POOL_MAX=5` definida (0.25 CU). `DATA_CACHE_REVALIDATE_S` y `NEXT_PUBLIC_CHAT_STREAM_ENABLED` sin definir → defaults correctos. |
| E6 | ✅ Documentado en `AGENTS.md` (`DATA_CACHE_REVALIDATE_S`, expiración lazy), `.env.example`, `entornos.md` §Producción/6 y `reporte-estado.md` §10. T16 diferido con umbral; SSE off; sharding diferido. |

**Verificación:** `tsc` ✅ · `lint` ✅ · `npm test` 1827/1827 ✅ · `knip` ✅ · `build` ✅ · `test:e2e` **127/127** ✅ (tras el fix del hallazgo abajo).

**Hallazgo E2E post-corrida (resuelto):** `pedido-chat.spec.ts` ("operador comparte la ubicación de la sucursal") falló flaky en la primera pasada. Causa raíz: `setBranchLocation` y el resto de helpers de `tests/e2e/helpers.ts` mutan `branches`/`cash_registers` escribiendo directo en la base, sin pasar por la app — la invalidación por tag nunca se dispara y `getCachedBranchById` sirvió la sucursal sin `location` (400 "La sucursal no tiene ubicación configurada"). En producción no puede ocurrir (toda mutación pasa por actions/rutas que invalidan), pero en E2E la capa quedó deshabilitada vía `DATA_CACHE_REVALIDATE_S=0` en `.env.e2e`, `.env.e2e.example` y el job E2E de `ci.yml`. El fix expuso además un bug del kill switch: `unstable_cache` rechaza `revalidate: 0` al registrarse (invariant: `false` o `> 0`), así que con la capa apagada el módulo crasheaba — resuelto registrando con un placeholder válido (`REVALIDATE_OPTION`); el bypass `isCacheDisabled()` garantiza que esas funciones nunca se invocan. Verificado: spec completo 6/6 en el primer intento con la capa apagada.
