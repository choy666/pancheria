# Auditoría integral del proyecto — 2026-09-20

> **Estado:** completada. Auditoría general de estado posterior a las fases T1–T13,
> la Fase M y la consolidación E1–E6. Estructura según
> `prompts/auditoria-pre-release.md`. El pendiente estructural de fondo
> (multi-tenant, T14) sigue trackeado en `auditoria-escalabilidad-2026-09-19.md`.

## 1. Resumen ejecutivo

El proyecto está en **muy buen estado general**. Todas las verificaciones
automáticas pasan, la cobertura de tests es completa en las capas críticas
(servicios, repositorios y rutas API al 100%), la seguridad de endpoints está
bien delimitada (panel con sesión, públicos con rate limit, crons con secreto)
y la configuración está centralizada sin secretos ni URLs sensibles en el
código.

No se encontraron problemas críticos ni altos nuevos. Los hallazgos son
**menores** o **informativos**, y el único pendiente estructural sigue siendo
la migración multi-tenant (T14), diferida por decisión y documentada en la
auditoría de escalabilidad vigente.

**Conclusión:** el proyecto está listo para producción en su escala actual
(una empresa, múltiples sucursales, un solo tenant).

## 2. Baseline

- Commit: `5682952` (`main`).
- Working tree: cambios documentales del archivado de los tres planes/spike
  (2026-09-20), sin commitear al momento de la auditoría.
- Rama sin cambios de código respecto al último estado verificado.

## 3. Verificaciones automáticas

| Comando | Resultado |
| --- | --- |
| `npm run lint` | ✅ 0 errores |
| `npx tsc --noEmit` | ✅ |
| `npm test` | ✅ 173 suites / 1859 tests (incluye los tests agregados en §6) |
| `npm run build` | ✅ 79 rutas, 44 páginas estáticas |
| `npm run knip` | ✅ sin código ni dependencias muertas |
| E2E (`npm run test:e2e`) | ✅ 127/127 (última corrida documentada, base descartable) |

## 4. Inventario

| Capa | Total | Con test propio |
| --- | --- | --- |
| Servicios (`src/application/services`) | 14 | 14 (100%) |
| Repositorios (`src/repositories`) | 12 | 12 (100%) |
| Rutas API (`route.ts`) | 55 | 55 (100%) |
| Migraciones Drizzle | 32 | última `0031` aplicada en producción |
| Specs E2E | 38 | incluye `accessibility.spec.ts` (axe-core) |

## 5. Estado por área

### 5.1 Calidad de código ✅

- Cero `TODO`/`FIXME`/`HACK`/`XXX`/`@deprecated` en `src/`.
- `src/lib/utils.ts` contiene solo `cn` — sin crecimiento incidental.
- `process.env` centralizado en `src/config/*`: los accesos directos fuera de
  esa capa son solo tests y un chequeo de `NODE_ENV` en
  `conditional-analytics.tsx` (detección de entorno, no configuración de
  negocio — aceptable).
- Tests co-ubicados junto al código (`*.test.ts`), mocks de `next/cache` en
  `tests/mocks/` para la capa `unstable_cache`.

### 5.2 Seguridad ✅

Mapa de protección de las 55 rutas API:

| Protección | Rutas |
| --- | --- |
| `withAuth` (sesión panel) | 43 |
| Rate limit público (`createRateLimiter` / `isChatPollRateLimited`) | 8 |
| `withCronAuth` (Bearer `CRON_SECRET`) | 3 crons |
| Protección propia (sesión o token de pedido) | `chat/attachment/[key]` |
| Público intencional | `health`, `catalogo`, `disponibilidad`, `sucursal/estado`, handler NextAuth |

- CSP con nonce por request en `src/proxy.ts`; matcher excluye API y assets.
- Headers de seguridad completos en `next.config.ts`; HSTS solo en producción.
- Validación build-time de variables críticas cuando `VERCEL_ENV=production`
  y `CI` está definido (discrimina build real vs `vercel env pull` local).
- Login: rate limit por usuario con store compartido (`rate-limit-store.ts`,
  proveedor `memory`/`db`), bcrypt, secreto ≥ 32 bytes exigido al cargar.
- `productos/imagen/[key]` exige `branchId` y valida `isPublicSellableProduct`
  (H10/T12 implementado); `chat/attachment/[key]` exige sesión o token.
- Rate limiting de pedidos/chat con store Postgres en producción y resolución
  de IP vía `x-vercel-forwarded-for` / `TRUSTED_PROXY_IP_HEADER`.
- Sin secretos ni URLs sensibles hardcodeadas: los dominios en `src/lib` son
  endpoints de protocolo de proveedor (Vercel Blob, S3, gstatic del Cast SDK)
  o plantillas públicas de mapas sobreescribibles por `NEXT_PUBLIC_MAPS_*`.

### 5.3 Arquitectura y patrones ✅

- Capas respetadas: `app` → `application/services` → `repositories` → `db`;
  `config`, `domain`, `lib` y `hooks` transversales sin dependencias inversas.
- `src/config` son solo archivos planos de configuración + tests.
- Logging consistente con `logger.*`; error boundary, `not-found` y `loading`
  global presentes.
- Server actions limitadas a mutaciones del panel; lecturas del panel por
  endpoints autenticados (patrón documentado).

### 5.4 Cobertura de pruebas ✅

- 100% de servicios, repositorios y rutas API con tests unitarios.
- E2E con axe-core, mocks de geolocalización, aislamiento por sucursal y
  helpers con IP única por spec para el rate limit.
- Libs sin test propio detectadas en la auditoría: `server-cache.ts`,
  `chat-poll-rate-limit.ts`, `fetch-all-pages.ts`, `cache-control.ts`,
  `selected-branch.ts`, `product-style.ts` — **resueltas**: cada una tiene
  ahora su suite propia (ver §6). `maps.ts` ya tenía `maps.test.ts` (error
  de inventario corregido).

### 5.5 Variables de entorno ✅

- Cruce código ↔ `.env.example`: **sin brechas** — toda variable leída está
  documentada y ninguna documentada está huérfana (107 vars en `src/config`).
- Las únicas vars del código ausentes en `.env.example` son de plataforma/CI
  (`NODE_ENV`, `CI`, `VERCEL`, `VERCEL_ENV`, `ANALYZE`) o de tooling E2E
  (`BASE_URL`, `NO_GLOBAL_SETUP`, `NO_WEB_SERVER`, `E2E_ALLOW_REMOTE_DB`,
  `TARGET_E2E`), cubiertas por `.env.e2e.example` y `AGENTS.md`.
- `.env.local`, `.env.e2e` y `.env.production.local` existen localmente y
  están ignorados por `.gitignore` (`.env*` con excepción de los `*.example`).

### 5.6 Rendimiento y escalabilidad ✅

- `unstable_cache` con tags `branches`/`public-catalog` e invalidación
  bloqueante (`revalidateTag(tag, { expire: 0 })`); disponibilidad, reservas y
  caja calculadas en vivo. `DATA_CACHE_REVALIDATE_S <= 0` deshabilita la capa
  (usado en E2E).
- `Cache-Control` con `s-maxage`/`swr` en `catalogo` y `sucursal/estado`.
- Paginación en listados y en el resumen de caja (`CAJA_SUMMARY_PAGE_SIZE`).
- `maxDuration` explícito en rutas largas (crons y listados de papelera: 300;
  streams de chat: 60).
- Pool de Neon configurable (`DATABASE_POOL_MAX=5` en producción), timeouts
  configurables, logging de duración en repos/servicios.
- SSE de chat implementado opt-in y **deshabilitado** en producción (decisión
  del spike archivado); `NEXT_PUBLIC_CHAT_STREAM_ENABLED` sin definir.

### 5.7 Accesibilidad y UX ✅

- axe-core integrado en E2E (`accessibility.spec.ts`, script
  `test:accessibility`); `eslint-config-next` incluye reglas jsx-a11y.
- Estados de carga/vacío/error presentes en listados (verificado en suites).
- UI mayormente en español rioplatense consistente.

### 5.8 Integridad de datos ✅

- Schema con 48 índices (incluye los 9 de migración `0031`), 5 unique, 27
  referencias FK y 2 checks; journal de migraciones consistente (32/32).
- Transacciones multi-tabla, locks ordenados, idempotencia en pedidos/ventas
  y soft-delete con checks — verificados en la auditoría de escalabilidad y
  cubiertos por tests.
- Reservas de stock con expiración lazy + cron `expire-orders`.

### 5.9 CI/CD y despliegue ✅

- `ci.yml`: 5 gates paralelos (lint, tsc, unit, build, knip) + E2E con
  sharding opt-in (`E2E_SHARDS` + base por shard) y merge de reportes blob;
  validación temprana de secrets con `::error::`.
- `expire-orders.yml`: valida `CRON_SECRET`/`VERCEL_PRODUCTION_URL` antes de
  llamar al cron.
- `vercel.json`: crons diarios de `rate-limit-cleanup` y
  `chat-attachments-cleanup`; `expire-orders` por GitHub Actions (decisión
  documentada).
- `playwright.config.ts` robusto: `.env.local` + `.env.e2e` con prioridad,
  guards de `NO_GLOBAL_SETUP`/`NO_WEB_SERVER`, webServer con health check.
- `global-setup.ts` protege la base: exige sufijo `test`/`e2e`/`testing`/
  `qa`/`staging` o `E2E_ALLOW_REMOTE_DB=true` explícito.
- Build y tests unitarios en CI **no** reciben `DATABASE_URL` (las páginas
  públicas son `force-dynamic`) — sin lecturas accidentales a producción.

## 6. Hallazgos

### Menores — **resueltos en esta sesión**

1. **`POST /api/public/disponibilidad` sin rate limit.** ✅ Resuelto: la ruta
   aplica ahora el veto anti-abuso en memoria por IP
   (`createPollRateLimiter('availability_poll', ...)`, mismos defaults que los
   polls públicos: 60 s / 240 requests) con 429 antes de tocar el servicio, y
   su test cubre el camino vetado. Documentado en la guía §7.3.
2. **Libs sin test propio.** ✅ Resuelto: suites nuevas para
   `cache-control`, `fetch-all-pages`, `product-style`, `selected-branch`
   (jsdom), `chat-poll-rate-limit` y `server-cache` (resetModules + stub de
   `next/cache`: verifica revive de fechas, bypass con
   `DATA_CACHE_REVALIDATE_S=0` e invalidación por tag). +6 suites, +32 tests.

### Informativos

1. **Análisis de bundle actualizado** (`npm run analyze:webpack`,
   2026-09-20): ~2,23 MB parsed / ~729 KB gzip de first-load (framework +
   main + layout + shared), 10,38 MB parsed totales en 127 chunks; el chunk
   mayor es `3794` (~1,5 MB, lazy). Comparable al ~1,9 MB del 19/09 — sin
   regresión relevante. Los warnings de webpack sobre "dependency is an
   expression" provienen de los imports dinámicos intencionales de
   `storage.ts`/`orphaned-files.ts` (providers cargados bajo demanda).
2. **Cadencia real de `expire-orders`** en GitHub Actions: ~2–5 h entre
   corridas efectivas (vs `*/5` declarado — limitación conocida de Actions en
   schedules densos). Mitigado por la expiración lazy; documentado como riesgo
   operativo en `reporte-estado.md`.
3. **`process.env.NODE_ENV` en `conditional-analytics.tsx`**: excepción
   benigna a la centralización en `src/config` (detección de entorno).
4. **`next-auth` v5 beta** (`5.0.0-beta.32`): dependencia pre-release asumida
   y documentada en `auth.config.ts` con plan de migración a estable.

## 7. Pendientes

### Abiertos (diferidos por decisión)

- **T14 — Migración multi-tenant** (prioridad alta cuando se decida escalar a
  múltiples empresas). Fuente: `prompts/plan-implementacion-multi-tenant.md` +
  complementos del §3.9 de `auditoria-escalabilidad-2026-09-19.md` (vigente).

### Re-evaluaciones condicionales

- **SSE de chat**: habilitar solo si el polling vuelve a ser cuello de
  botella; medir duración facturada vs invocaciones antes de activar
  `NEXT_PUBLIC_CHAT_STREAM_ENABLED`.
- **Sharding E2E**: activar `E2E_SHARDS` + secrets por shard si la suite
  supera ~10 min.
- **T16 réplicas/agregaciones**: revisar si p95 del resumen de caja > 2 s,
  saturación del pool o > 50 000 ventas por caja.

### Operativos recurrentes

- Verificar periódicamente `VERCEL_PRODUCTION_URL` y el schedule real del
  cron (vive en `checklist-pre-push.md`).
- Revisar límites/consumo de Neon y Vercel con datos reales de producción.

## 8. Conclusión

Sin hallazgos críticos ni altos. La deuda técnica real está acotada a T14
(multi-tenant) como decisión de escalado futuro, más un conjunto acotado de
mejoras menores y re-evaluaciones condicionales con gatillos explícitos.

**Estado: aprobado para producción a la escala actual.**
