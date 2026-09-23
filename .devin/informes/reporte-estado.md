# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-23 (actualizado)
**Proyecto:** `pancheria`
**Histórico:** snapshots anteriores en `.devin/informes/archivados/historico/`

---

## 0. Estado actual (2026-09-23)

### En `main` (mergeado y verificado)

- Auditoría QA ronda 1 (PR #4, `35b54a1`): QA-01 expiración en mutaciones → 409; QA-02 `idempotencyKey` estable por intento; QA-03 upload no-multipart → 400; QA-05 `catch` en handlers async de UI.
- E4 sucursal eliminada (PR #3 `2cd9dda` + PR #5 `9efad8d`): JWT con `branchId` huérfano → 403 `BRANCH_REMOVED` → logout forzado vía `/sesion-finalizada` → login con mensaje. Blindaje de `product-form` y tests de `throwApiError`.
- `npm test`: 174 suites / 1880 tests verdes post-merge; `tsc`/`lint`/`knip` limpios.

### PRs abiertos

Ninguno — última ola mergeada el 2026-09-23:

- **PR #6** (`5615500`): P0 — `/pedido/seguimiento` estática sin nonce CSP → no hidrataba en prod (fix `force-dynamic`, verificado en producción: 16/16 scripts con nonce); menor — info-leak de env vars en rate limit → 500 genérico. Informe: `archivados/auditoria-qa-ronda-2-2026-09-23.md`.
- **PR #7** (`96b0db1`): `concurrency` por shard en job E2E + timeout 18→25 min (suite ya rondaba los ~19 min). Ticket: `archivados/ci-e2e-base-compartida.md`.

### Deuda abierta consolidada (única fuente)

| Ítem | Severidad | Fuente |
| --- | --- | --- |
| T14 multi-tenant (diferido por decisión) | Alta | `prompts/plan-implementacion-multi-tenant.md` + `archivados/auditoria-escalabilidad-2026-09-19.md` §3.9 |
| QA-04: misma `idempotencyKey` + payload distinto devuelve recurso original (propuesta: huella + 409) | Media | `archivados/auditoria-qa-2026-09-21.md` |
| Soft-delete de `branches` | Media | auditoría de escalabilidad (próxima ronda) |
| Neon efímera por `run_id` / sharding E2E opt-in (`E2E_SHARDS` + secrets por shard) | Baja | `archivados/ci-e2e-base-compartida.md` |
| `/_not-found` estático sin nonce CSP (navbar no hidrata; `<Link>` funciona) | Baja | `archivados/auditoria-qa-ronda-2-2026-09-23.md` |
| Verificación periódica de `VERCEL_PRODUCTION_URL` | Recurrente | `checklist-pre-push.md` |

### Regla documental vigente

- `informes/` raíz = solo docs operativos + tickets **abiertos**.
- `archivados/` = solo guías con valor futuro, implementadas **completas** (o con pendiente explícito trackeado en §0). Marcador `Estado:` obligatorio.
- `archivados/historico/` = snapshots sin valor de guía (solo historia).
- Los informes de PRs abiertos se archivan cuando su trabajo mergea a `main`.

### Reorganización documental (2026-09-23)

Raíz de `informes/` pasó de 12 a 6 archivos operativos; 5 informes implementados/mergeados archivados con marcador de estado; 10 snapshots a `archivados/historico/`; referencias rotas corregidas en `.devin/README.md`, `prompts/auditoria-qa-integral.md` e internas entre archivados.

---

## Secciones históricas (2026-09-15 → 2026-09-20)

Las secciones 1–12 documentan el estado al 2026-09-20 y las sesiones de esa semana. Se conservan como contexto; para el estado actual ver §0.

---

## 1. Resumen ejecutivo

El proyecto se mantiene operativo y todas las verificaciones base pasan sobre el `working tree` actual (limpio, `main` al día). Desde el informe anterior (2026-09-11) se integraron:

1. **Contactos de sucursal** (commit `9741f7f`): las sucursales ahora tienen `phones` (etiqueta + número) y `social_links` (red + URL normalizada) en JSONB, con migración `0030_branch_contacts` que migró `phone` → `phones[0]` y eliminó la columna. Se exponen en `/pedido`, en el diálogo de pedido creado y en el encabezado del chat. El seed los configura con `DEFAULT_BRANCH_PHONE`/`DEFAULT_BRANCH_SOCIAL_LINKS` y `NEW_BRANCH_PHONE`/`NEW_BRANCH_SOCIAL_LINKS`.
2. **Avisos de caja por turnos** (mismo commit): `getCashRegisterShiftStatus`/`resolveCashRegisterAlert` calculan `estadoTurno` y `alertaCaja` en el servidor contra los horarios vigentes de la sucursal, con soporte de turnos overnight (`close < open`) y timezone `NEXT_PUBLIC_BRANCH_TIMEZONE`. Fallback legacy (`dia_anterior`, `excedida` con `CAJA_OVERDUE_HOURS`, default 12 h) solo cuando la sucursal no tiene horarios.
3. **Plan de observaciones implementado** (commit `a3d70d5`): doble punto en `message` corregido, `branch-list` con columnas de resumen (dirección, teléfono, horarios), `CashRegisterShiftBadge` consumiendo `estadoTurno` en UI y warning de hidratación corregido en `cash-register-summary.tsx`.
4. **Corrección de flakiness en tests de caja** por timezone mismatch (commits `cba7e1c`, `5206be5`).
5. **Auditoría del deploy de Vercel** documentada en `.devin/informes/archivados/auditoria-deploy-vercel-2026-09-14.md` (recomendaciones implementadas; pendiente recurrente en §6).

Esta sesión ejecutó una **auditoría documental de `.devin` y la documentación vigente**: se archivaron dos informes ya resueltos, se sincronizaron los índices, se corrigieron defaults desactualizados y se actualizó este reporte.

Además se implementó el prompt `datos-sucursal-y-mapa-en-pedido` (archivado en `prompts/archivados/`): la tarjeta de datos de sucursal (`BranchInfoCard`) se muestra al inicio del catálogo `/pedido`, la ubicación se embebe como iframe lazy dentro de un `<details>` cuando `buildMapEmbedUrl` la valida contra `getMapsFrameOrigins` (con fallback "Ver en mapa" para short links y orígenes no soportados), `frame-src` deriva sus orígenes de la configuración de mapas y el select de redes sociales del formulario de sucursal migró a `Select` de base-ui.

## 2. Stack y arquitectura

- Next.js `16.3.3` (App Router + Turbopack)
- React `19.2.8`, TypeScript `5.x`, Tailwind CSS `4`, shadcn/ui
- Drizzle ORM `0.45.2`, PostgreSQL (Neon / `pg`)
- NextAuth v5 (`5.0.0-beta.32`)
- Jest `30.x`, Playwright `1.62.x`
- Vercel (despliegue recomendado)

La arquitectura mantiene la separación por capas: `src/app/` (UI y API), `src/application/` (servicios/casos de uso), `src/repositories/` (acceso a datos), `src/lib/` (utilidades transversales), `src/config/` (getters de variables de entorno), `src/domain/` (tipos y errores) y `src/db/` (esquema y seeds).

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja con avisos por turno y badge de turno, pedidos por estado, alertas de stock, accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito rediseñado, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock al recibir el pedido (`receiveOrder`), chat integrado (texto, imágenes y ubicación) y pagos mixtos.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público; snapshots de receta en `sale_item_recipes` y `order_item_recipes`.
- **Stock y caja**: movimientos con razones, cierre automático opcional (`CAJA_AUTO_CLOSE_HOURS`, deshabilitado por defecto), avisos por turnos con fallback por umbral, cierres diarios históricos, soft delete de cajas, vaciado masivo de papelera.
- **Sucursales**: horarios con turnos overnight, dirección, ubicación (con mapa embebido en `/pedido` para orígenes soportados y fallback "Ver en mapa" para el resto), teléfonos con etiqueta y redes sociales expuestos públicamente; eliminación en cascada con liberación de archivos.
- **Chat de pedidos**: texto, imágenes (con validación de magic bytes), paginación con cursores, polling con pausa por visibilidad, compartir ubicación del cliente y de la sucursal.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **155 suites, 1640 tests pasan** (ejecutado 2026-09-15) |
| `npm run knip` | Pasa (sin exports/dependencias sin uso) |
| `npm run build` | Pasa (ejecutado 2026-09-15 tras agregar la validación de `next.config.ts`); la validación de producción se verificó con `CI=1 VERCEL_ENV=production` (falla correctamente por `CRON_SECRET` ausente en `.env.local`) |
| `npx drizzle-kit check` | No ejecutado (sin cambios de esquema desde `0030`) |
| `npm run test:e2e` | **121 tests** sobre `neondb_e2e` (base remota descartable): 120 pasan + el spec nuevo `sucursal-contactos-y-turnos` (3 tests) verde tras ajustar el escenario `cierre_recomendado` para no disparar `CAJA_AUTO_CLOSE_HOURS=1` |

El esquema Drizzle cuenta con **31 migraciones** (`0000`–`0030`) y el journal termina en `0030_branch_contacts`, consistente con `src/db/schema.ts`. La suite E2E cuenta con **35 specs**.

## 5. Auditoría documental 2026-09-15

### 5.1 Hallazgos

| Hallazgo | Clasificación | Estado | Evidencia / Acción |
|---|---|---|---|
| `plan-observaciones-auditoria-sucursales-caja.md` figuraba como **pendiente** pero sus 5 ítems ya estaban implementados (commits `a3d70d5` y `73f1af5`) | Menor | Resuelto | Archivado en `informes/archivados/plan-observaciones-auditoria-sucursales-caja-2026-09-13.md` con nota de resolución. |
| `auditoria-sucursales-y-caja-por-turnos.md` estaba implementada y auditada (§8 confirma D1–D6) pero seguía como vigente | Menor | Resuelto | Archivada en `informes/archivados/auditoria-sucursales-y-caja-por-turnos-2026-09-13.md`; sus decisiones quedaron resumidas en `lecciones-aprendidas.md` §16. |
| `informes/README.md` no listaba `auditoria-deploy-vercel-2026-09-14.md` ni la auditoría de sucursales; `.devin/README.md` tampoco las reflejaba | Menor | Resuelto | Índices actualizados en ambos README (entradas nuevas y bloque de estructura). |
| `reporte-estado.md` desactualizado: baseline `7cdf286` (7 commits atrás), 1582 tests, 30 migraciones, sin las features de sucursales | Mayor | Resuelto | Reescrito con baseline `cfb1b41`, 1640 tests, 31 migraciones y las funcionalidades nuevas. Versión anterior en `archivados/historico/reporte-estado-2026-09-11.md`. |
| `guia-funcionamiento-pancheria.md` documentaba `CAJA_AUTO_CLOSE_HOURS` con default `12 h` y "cierre automático después de 12 horas" | Menor | Resuelto | El código usa `0` (deshabilitado) en `src/config/caja.ts`. Corregido en §5.2, §13 y §15; agregadas secciones de avisos por turno y contactos de sucursal. |
| `lecciones-aprendidas.md` tenía numeración desordenada (§13 → §15 → §14) | Informativo | Resuelto | Reordenado a §14 (ventas) → §15 (moneda) preservando la referencia histórica "sección 14 = ventas" usada por prompts archivados; agregada §16 (sucursales/turnos). |
| `.devin/environment.yaml` no listaba `CAJA_OVERDUE_HOURS`, `NEXT_PUBLIC_CAJA_OVERDUE_HOURS`, `NEXT_PUBLIC_BRANCH_TIMEZONE`, `DEFAULT_BRANCH_SOCIAL_LINKS` ni `NEW_BRANCH_SOCIAL_LINKS`, y declaraba default `12 h` para el cierre automático | Menor | Resuelto | Agregadas al knowledge `database` (vars de seed y caja/sucursal) y `deploy`; lista de informes actualizada. |
| `checklist-pre-push.md` no mencionaba la variable de repositorio `VERCEL_PRODUCTION_URL` requerida por `expire-orders.yml` | Menor | Resuelto | Agregada la verificación en la sección de secretos/variables de GitHub Actions (recomendación pendiente de la auditoría de Vercel). |
| `prompts/plan-implementacion-multi-tenant.md` referenciaba `daily_closures`, tabla eliminada en la migración `0025` | Menor | Resuelto | Eliminadas las dos referencias obsoletas (lista de tablas e índice `daily_closures_branch_date_unique_idx`). |
| `README.md` no listaba las variables nuevas de sucursal ni los avisos por turno | Menor | Resuelto | Agregadas `DEFAULT_BRANCH_SOCIAL_LINKS`, `NEW_BRANCH_SOCIAL_LINKS`, `NEXT_PUBLIC_BRANCH_TIMEZONE`, `CAJA_OVERDUE_HOURS`/`NEXT_PUBLIC_CAJA_OVERDUE_HOURS` y descripción de contactos/avisos en la sección multi-sucursal. |

### 5.2 Archivos afectados en esta auditoría

- **Archivados:**
  - `.devin/informes/archivados/auditoria-sucursales-y-caja-por-turnos-2026-09-13.md`
  - `.devin/informes/archivados/plan-observaciones-auditoria-sucursales-caja-2026-09-13.md`
  - `.devin/informes/archivados/historico/reporte-estado-2026-09-11.md`
- **Actualizados:**
  - `.devin/informes/reporte-estado.md` (este archivo)
  - `.devin/informes/README.md`
  - `.devin/README.md`
  - `.devin/informes/lecciones-aprendidas.md`
  - `.devin/informes/guia-funcionamiento-pancheria.md`
  - `.devin/informes/checklist-pre-push.md`
  - `.devin/environment.yaml`
  - `.devin/prompts/plan-implementacion-multi-tenant.md`
  - `README.md`

## 6. Pendientes por abordar

Pendientes abiertos provenientes de la auditoría del deploy de Vercel (`informes/archivados/auditoria-deploy-vercel-2026-09-14.md`) y de auditorías previas. Los ítems implementados después se marcan como **resueltos**:

| Prioridad | Pendiente | Estado |
|---|---|---|
| Media | Validación build-time de variables críticas en producción | **Resuelto** — `next.config.ts` falla el build cuando `VERCEL_ENV=production` si falta `CRON_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, URL de base de datos, o si `STORAGE_PROVIDER=local`. No aplica en preview/development, por lo que no rompe builds locales ni CI |
| Media | Endurecer la validación de `STORAGE_PROVIDER=local` en producción | **Resuelto** — cubierto por la misma validación de `next.config.ts`; el warning de `src/config/videos.ts` se mantiene como defensa en runtime |
| Baja | Verificar periódicamente que `VERCEL_PRODUCTION_URL` (variable de repo) siga apuntando al dominio productivo, sobre todo tras cambios de dominio | Abierto (recurrente) — documentada en `checklist-pre-push.md` |
| Baja | Monitoreo de carga del script de Vercel Analytics (`NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`) | **Resuelto** — `ConditionalAnalytics` registra `logger.warn` en `onerror` del script |
| Baja | Documentar en `AGENTS.md` una sección de variables con comportamiento distinto por entorno | **Resuelto** — sección "Variables con comportamiento distinto por entorno" en `AGENTS.md` |
| Baja | Script pre-commit que valide variables críticas en `.env.local`; endpoint interno de estado de configuración (sin valores) | Abierto (largo plazo) |
| Baja | Ejecutar `npm run test:e2e` en base descartable antes del próximo release | **Resuelto** — ejecutado 2026-09-15 sobre `neondb_e2e`: 121 tests, todos en verde |
| Baja | Specs E2E para contactos y avisos/turnos de sucursal | **Resuelto** — `tests/e2e/sucursal-contactos-y-turnos.spec.ts` cubre alta/edición de teléfonos y redes sociales, exposición en listado y API pública, badge `En turno` y aviso `cierre_recomendado`. La cobertura de ubicación por chat ya existía en `pedido-chat.spec.ts` |
| Baja | `productRepository.findByImageKey` sin orden determinista (`image_key` no es unique) | **Resuelto** — `orderBy: asc(products.id)` agregado |
| Baja | Plan multi-tenant (`prompts/plan-implementacion-multi-tenant.md`): propuesta futura, no iniciada; recordar que `daily_closures` ya no existe al retomarla | Abierto (propuesta futura) — complementado por la auditoría de escalabilidad 2026-09-19 (§3.9: backfill de `tenant_id`, índices compuestos, lookups sin scope) |
| Alta | Auditoría de escalabilidad 2026-09-19 — quick wins: caché CDN corto en `catalogo`/`sucursal/estado`, sacar polls GET del rate limit, cleanup de `login_attempts`, índices en FKs hijas, pool explícito, `maxDuration` en crons | **Resuelto** — Fase 0 (T1–T6) implementada 2026-09-19 según `informes/archivados/plan-implementacion-escalabilidad-2026-09-19.md`: migración `0031` con los 9 índices aplicada en desarrollo y E2E, headers `s-maxage`/`stale-while-revalidate` configurables en `catalogo` y `sucursal/estado`, polls GET con limiter en memoria (`PUBLIC_POLL_RATE_LIMIT_*`), retención de `login_attempts` (`LOGIN_ATTEMPTS_RETENTION_MS`), pool configurable (`DATABASE_POOL_MAX`/`DATABASE_CONNECTION_TIMEOUT_MS`/`DATABASE_IDLE_TIMEOUT_MS`), `maxDuration` en crons y rutas pesadas, y refresh de catálogo acotado a primera página + disponibilidad por IDs |
| Media | Auditoría de escalabilidad 2026-09-19 — corto plazo: paginar `productos`/`stock`/usuarios/videos, batching en `expirePendingOrders` y limpiezas masivas, retención de `order_messages`, health check/alertas, tests de concurrencia, SSE para chat | **Resuelto** — Fase 1 (T7–T13) implementada 2026-09-19: paginación en `productos`/`stock`/usuarios/videos, batching con presupuesto en `expirePendingOrders`, retención opt-in de `order_messages` (`ORDER_MESSAGES_RETENTION_DAYS`), `GET /api/health` y duración por request en todas las rutas, tests de concurrencia y spike SSE (implementado, deshabilitado). Retención activada en producción (90 días) el 2026-09-20 |
| Media | Auditoría de escalabilidad 2026-09-19 — Fase 2 sin multi-tenant: caché de servidor (T15), preview de disponibilidad consciente de reservas, expiración lazy de pendings, evaluación de réplicas (T16) | **Resuelto** — plan `informes/archivados/plan-implementacion-consolidacion-2026-09-20.md` ejecutado: caché de servidor con `unstable_cache` + tags (`src/lib/server-cache.ts`), preview del terminal que descuenta reservas activas, expiración lazy de `pending` en lecturas, T16 diferido con umbral de revisión documentado |
| Alta | Migración multi-tenant (T14) + complementos §3.9 del plan de escalabilidad | **Diferido** — decisión del usuario 2026-09-20: dejar firme el proyecto antes de avanzar. El proyecto quedó consolidado (Fases 0, 1, M y plan de consolidación); la puerta de entrada de T14 está abierta |
| Baja | Sharding E2E en CI (T11 opt-in) | **Diferido** — infra lista (reporter blob + `merge-reports`); activar cuando la suite supere ~10 min de reloj aprovisionando `E2E_DATABASE_URL_SHARD<N>` por shard |
| Baja | SSE de chat (T13 opt-in) | **Deshabilitado** — decisión del usuario 2026-09-20: `NEXT_PUBLIC_CHAT_STREAM_ENABLED` sin definir en producción; el polling sigue siendo el default. El spike queda disponible si el polling vuelve a ser cuello de botella |
| Media | Verificar en producción: `DATABASE_URL` con pooler de Neon, `maxDuration` efectivo según plan de Vercel | **Resuelto** — Fase M ejecutada 2026-09-19 (resultados en `informes/archivados/plan-implementacion-escalabilidad-2026-09-19.md` §7): `DATABASE_URL` usa el pooler de Neon; plan Hobby con Fluid Compute → `maxDuration` subido a 300 s en crons/rutas pesadas; schedule real de `expire-orders` ~2–5 h (documentado en `AGENTS.md`); rate-limit stores en `db`; `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS` inactivo |

## 7. Cierre

- Baseline: `cfb1b41358bb06b51937660467e6674590837622` en `main`; auditoría ejecutada sobre el `working tree` limpio.
- Verificaciones ejecutadas en esta sesión: `npm run lint`, `npx tsc --noEmit`, `npm test` (155 suites / 1640 tests), `npm run knip`, `npm run build` y `npm run test:e2e` (121 tests sobre `neondb_e2e`) — todas pasan. `npx drizzle-kit check` no se ejecutó (sin cambios de esquema).
- Los únicos informes vigentes además de este son los documentos de referencia (`lecciones-aprendidas.md`, `entornos.md`, `checklist-pre-push.md`, `guia-funcionamiento-pancheria.md`); `auditoria-deploy-vercel-2026-09-14.md` quedó archivada con su pendiente recurrente documentado en `checklist-pre-push.md`.
- No se ejecutaron `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npx drizzle-kit migrate` ni `npm run test:e2e` por requerir confirmación explícita o base de prueba.

## 8. Mantenimiento documental 2026-09-19

Sesión de corrección documental sobre `.devin` (sin cambios de código ni verificaciones ejecutadas):

1. **Nuevo prompt activo** `prompts/auditoria-escalabilidad.md`: auditoría de escalabilidad a futuro (9 áreas) con documentación obligatoria, reglas de solo lectura, destino de entregable e índices, taxonomía crítico/mayor/menor/informativo y estimaciones etiquetadas. Corrige el borrador externo: roles `admin`/`operator`, providers de storage (`local`, `vercel-blob`, `s3`, `r2`), lista completa de capas y lectura de `src/config/*`.
2. **Referencias rotas corregidas** en archivos activos: `.devin/README.md`, `prompts/README.md`, `pancheria.prompt.md`, `auditoria-pre-release.md`, `informes/README.md`, `checklist-pre-push.md`, `environment.yaml` y este archivo apuntaban a `prompts/auditoria-masiva.md`, `prompts/auditoria-masiva-resumen.md` e `informes/auditoria-deploy-vercel-2026-09-14.md`, que están en `archivados/`.
3. **Índices sincronizados**: `auditoria-masiva.md` y `auditoria-masiva-resumen.md` pasaron a figurar como archivados (reemplazados por `auditoria-pre-release.md` como punto de entrada para auditorías masivas), y `auditoria-escalabilidad.md` se agregó a `.devin/README.md`, `prompts/README.md` y el bloque Estructura.

## 9. Auditoría de escalabilidad 2026-09-19

Auditoría de solo lectura ejecutada sobre baseline `62a644dd95d047a4a92c9215d74023fcf5e0e06b` (`main`), según `prompts/auditoria-escalabilidad.md`. Sin cambios de código de negocio ni comandos destructivos.

- **Entregable:** `informes/archivados/auditoria-escalabilidad-2026-09-19.md` — veredicto "sí, con condiciones", 14 hallazgos clasificados, orden de quiebre estimado (10×/50×/100×), plan de acción priorizado y complementos al plan multi-tenant.
- **Verificaciones corridas:** `npm run lint`, `npx tsc --noEmit`, `npm test` (157 suites / 1691 tests), `npm run knip`, `npm run build` y `npm run analyze:webpack` — todas en verde; el analyzer emite los warnings intencionales de `src/lib/storage.ts` (imports dinámicos de AWS SDK).
- **Pendientes nuevos:** volcados en §6 (quick wins, corto plazo y verificaciones de producción).

## 10. Consolidación pre-multi-tenant 2026-09-20

Sesión de implementación según `informes/archivados/plan-implementacion-consolidacion-2026-09-20.md`. Cierra todos los pendientes del plan de escalabilidad **excepto T14 (multi-tenant)**, diferido por decisión del usuario.

### Código

- **E1 — Caché de servidor (T15):** nuevo `src/lib/server-cache.ts` con `unstable_cache` sobre sucursales (por ID, por nombre, lista pública) y la base del catálogo público (productos + total; **sin** disponibilidad — se calcula en vivo junto con recetas, reservas y estado de caja). TTL por `DATA_CACHE_REVALIDATE_S` (default 60 s; `<= 0` deshabilita la capa). Invalidación inmediata con `revalidateTag(tag, { expire: 0 })` en actions/rutas que mutan productos o sucursales (Next 16 exige el segundo argumento). Consumidores: `branchService.getBranchById`, `branch-resolver` (`listPublicBranches`, `getDefaultBranchId`) y `catalogService` (`findPublicProducts`/`countPublicProducts`).
- **E2 — Preview pesimista:** `validateCartAvailability` descuenta reservas activas de pedidos `in_process` también fuera de transacción (`dbOrTx ?? db`), alineando el preview del terminal de ventas con la validación transaccional y el catálogo.
- **E3 — Expiración lazy:** `trackOrder`, `getOrderById`, `getPendingOrders` y `getOrders` expiran pedidos `pending` vencidos durante la lectura (`cancelExpiredOrder` con lock transaccional, razón `Expiración automática por inactividad`); los listados los filtran y ajustan `total`. Compensa la cadencia real del cron de GitHub Actions (~2–5 h).
- **Tests:** nuevo stub global `tests/mocks/next-cache.ts` (mapeado en `jest.config.ts`), tests de `src/config/cache.ts`, expiración lazy en `orderService.test.ts`, preview con reservas en `saleService.test.ts`, mocks ajustados en `branch-resolver.test.ts` y `product-helpers.test.ts`.

### Producción (vía MCPs)

- **Migración `0031` aplicada** en Neon `main` (faltaba; producción estaba en `0030`): 9 `CREATE INDEX` ejecutados en transacción + fila en `drizzle.__drizzle_migrations` con hash SHA-256 del archivo y `created_at` del journal. Verificado: 32 migraciones registradas, los 9 índices existen.
- **`POSTGRES_URL_NON_POOLING`** corregida al endpoint directo de `main` (antes apuntaba al host `-pooler`).
- **`ORDER_MESSAGES_RETENTION_DAYS=90`** y **`DATABASE_POOL_MAX=5`** creadas en producción. `DATA_CACHE_REVALIDATE_S` sin definir (default 60 s) y `NEXT_PUBLIC_CHAT_STREAM_ENABLED` ausente (SSE off).
- Las variables nuevas toman efecto en el próximo deploy.

### Decisiones

- **T14 multi-tenant:** diferido (decisión explícita).
- **T16 réplicas/agregaciones:** no implementar a esta escala; umbral de revisión = p95 del resumen de caja > 2 s, saturación de pool o >50k ventas/caja.
- **SSE chat:** deshabilitado en producción.
- **Sharding E2E:** diferido; activar si la suite supera ~10 min.

### Verificaciones

`npx tsc --noEmit`, `npm run lint`, `npm test` (1827 tests), `npm run knip`, `npm run build` y `npm run test:e2e` (**127/127** sobre la base descartable) — todas en verde. La primera corrida E2E expuso un flaky de `pedido-chat` causado por la caché de servidor (los helpers de E2E mutan `branches` directo en la base y no disparan la invalidación por tag) y un bug del kill switch (`unstable_cache` no acepta `revalidate: 0` al registrarse); ambos resueltos — capa deshabilitada en E2E vía `DATA_CACHE_REVALIDATE_S=0` (`.env.e2e`, `.env.e2e.example`, CI) y placeholder válido en el registro con bypass en las funciones exportadas.

## 11. Archivado documental 2026-09-20

Sesión de mantenimiento documental (sin cambios de código ni verificaciones):

- **Archivados en `informes/archivados/`** con nota de resolución:
  - `plan-implementacion-escalabilidad-2026-09-19.md` — plan resuelto: T1–T13, T15 y Fase M implementadas/verificadas; T16 decidido "no implementar a esta escala"; T14 (multi-tenant) diferido por decisión del usuario.
  - `plan-implementacion-consolidacion-2026-09-20.md` — E1–E6 completados y verificados.
  - `spike-sse-chat-2026-09-19.md` — T13 cerrado con decisión (SSE opt-in deshabilitado; polling REST default).
- **Queda vigente como referencia archivada:** `informes/archivados/auditoria-escalabilidad-2026-09-19.md` — su §3.9 (complementos multi-tenant de T14) sigue siendo fuente directa del trabajo pendiente, y §4/§7 el marco de umbrales para re-evaluar las decisiones diferidas.
- **Referencias actualizadas:** `informes/README.md`, `.devin/README.md`, `AGENTS.md`, `.env.example` y las rutas internas de este archivo.

## 12. Auditoría integral del proyecto 2026-09-20

Auditoría general de estado posterior al archivado documental — informe completo en `informes/archivados/auditoria-proyecto-2026-09-20.md`. Verificaciones en verde: `npm run lint`, `npx tsc --noEmit`, `npm test` (1859 tests), `npm run build` y `npm run knip`. Sin hallazgos críticos ni altos.

- **Menores (resueltos en la misma sesión):** `POST /api/public/disponibilidad` quedó con veto anti-abuso en memoria (`createPollRateLimiter('availability_poll')`, defaults de polls públicos) + test del 429; suites nuevas para `cache-control`, `fetch-all-pages`, `product-style`, `selected-branch`, `chat-poll-rate-limit` y `server-cache` (+6 suites, +32 tests).
- **Informativos:** bundle re-medido con `analyze:webpack` (~2,23 MB parsed / ~729 KB gzip de first-load; sin regresión relevante vs ~1,9 MB del 19/09); cadencia real de `expire-orders` ~2–5 h (riesgo operativo ya documentado, mitigado por expiración lazy); `next-auth` v5 beta con plan de migración documentado.
- **Pendiente estructural:** T14 multi-tenant, diferido por decisión — fuente `prompts/plan-implementacion-multi-tenant.md` + §3.9 de `archivados/auditoria-escalabilidad-2026-09-19.md`.
- **Conclusión:** aprobado para producción a la escala actual (un tenant, múltiples sucursales).
