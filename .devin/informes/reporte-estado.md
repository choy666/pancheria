# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-24 (actualizado)
**Proyecto:** `pancheria`
**Histórico:** snapshots anteriores en `.devin/informes/archivados/historico/`

---

## 0. Estado vigente (auditoría 2026-09-24; PR #9 mergeado y producción migrada)

**Baseline Git:** la auditoría arrancó con `main` en `090fa63ec958c57dcecd3fd527f3a7391307b7cd`. **Estado al cierre:** `main` y `origin/main` están en `6b24700453f60fe656be167da4e052fb02f4ae7b` (`fix: rechazar reutilización divergente de claves de idempotencia (#9)`), con el working tree limpio salvo `.vscode/` sin trackear. El PR #9 se mergeó, Vercel producción quedó `READY` sobre `6b24700` (deployment `dpl_9WFCHFZcChxoJb8FworK8hjF7WHc`, dominio `pancheria-alpha.vercel.app`) y la migración `0032` se aplicó a la base productiva de Neon (`main`, `br-nameless-sun-avrmz655`) tras autorización expresa.

### Baseline Git y merges

- `git status --short --branch` al cierre: `main...origin/main` sin cambios trackeados; `.vscode/` sigue sin trackear y quedó intacto.
- `git log`: `main`/`origin/main` en `6b24700` (squash merge del PR #9); el baseline previo de la auditoría fue `090fa63`.
- `git branch -a`: `main` y `origin/main`; la rama `fix/qa04-payload-fingerprint` quedó mergeada a través del PR #9.
- `gh pr list --state open`: sin PRs abiertos tras el merge de #9.
- Último PR mergeado: **#9** (`6b24700`, fingerprint de idempotencia QA-04 + `drizzle-kit check` en CI + correcciones documentales). El anterior fue **#8** (`84957e4`, reorganización documental). El último PR previo con lógica de aplicación fue **#6** (`5615500`, CSP de `/pedido/seguimiento`); PR #7 (`96b0db1`) incorporó serialización E2E por shard y timeout de 25 min.

### Cambios incorporados en PR #9

- QA-04: fingerprint SHA-256 canónico, 409 ante divergencia, reconstrucción/verificación segura de filas legacy, exclusión del hash de respuestas y firmas cliente que incluyen todos los campos relevantes.
- Sucursales: se conserva hard delete en cascada; se agregaron warnings de conteos para fallos de limpieza de archivos y tests de tablas/recuperación.
- Esquema: `0032_icy_shaman.sql` agrega `idempotency_hash varchar(64)` nullable en `orders`/`sales`. Se aplicó a `.env.e2e`, a la base E2E del CI y —tras autorización expresa— a la base productiva de Neon `main`. El archivo temporal `.env.production.local` se eliminó al terminar.
- CI/documentación: se añadió `drizzle-kit check` al job E2E y se corrigieron las referencias de cierres, migraciones y el índice stale del prompt T14. T14 no se implementó ni se inició.
- `.vscode/extensions.json` sigue sin trackear y quedó intacto.

### CI de GitHub Actions

| Run | Conclusión | Evidencia / lectura |
| --- | --- | --- |
| `35948485239` — PR #9, SHA `61f3206` | **success** | CI completo del PR: lint, tipos, unitarios, build, knip, `drizzle-kit check`, `drizzle-kit migrate` sobre la base E2E descartable, E2E/accesibilidad y reporte consolidado. El job E2E tomó 12 min 26 s. |
| `35949717967` — PR #9, SHA `ae81663` | **success** | Repetición completa tras la actualización documental del reporte: todos los jobs pasaron; el job E2E tomó 15 min 05 s. |
| `35951037629` — PR #9, SHA `aece82d` | **success** | Último CI del PR antes del merge (HEAD documental final): todos los jobs pasaron; el job E2E tomó 21 min 05 s. |
| `35953586788` — `main`, push `6b24700` | **success** | CI post-merge en `main`: lint, tipos, unitarios, build, knip, `drizzle-kit check`, `drizzle-kit migrate` sobre la base E2E descartable, E2E/accesibilidad y reporte consolidado. El job E2E tomó 12 min 18 s. |
| `35878657216` — `main`, HEAD `090fa63` | **success** | Último CI de `main` en el HEAD auditado: lint, tipos, unitarios, build, knip, E2E/accesibilidad y reporte consolidado completados. El job E2E corrió en un shard durante 18 min 06 s. |
| `35895521808` — schedule de `main` | **success** | Última ejecución visible de `Expirar pedidos pendientes`. |
| `35867434935` — PR, SHA `6f649ed` | **failure** | El log indica timeout del paso E2E al cumplirse 18 min; los jobs de tipos, lint, unitarios, build y knip terminaron en verde. El workflow actual fija 25 min para el paso E2E. |
| `35874232325` — push a `main` | **cancelled** | El job E2E terminó cancelado sin pasos ejecutados; los demás jobs terminaron correctamente. |
| `35872990307` — PR | **cancelled** | Run cancelado, según `gh run list --limit 10`. |

El run `35953586788` valida el squash mergeado en `main` (`6b24700`); los runs `35948485239`, `35949717967` y `35951037629` validaron el PR #9 en sus tres SHAs. Todos ejecutaron `npx drizzle-kit check` en verde antes de `migrate`. Los runs fallidos/cancelados son anteriores al CI verde del HEAD base. `.github/workflows/ci.yml` mantiene serialización por shard (`cancel-in-progress: false`), sharding opt-in y default `[1]`.

### Verificaciones locales ejecutadas

| Comando | Resultado observado |
| --- | --- |
| `npm run lint` | **Pasa** (exit 0, 0 errores). Queda 1 warning preexistente en `src/app/sesion-finalizada/sign-out-client.tsx:18` por `window.location.assign()`. |
| `npx tsc --noEmit` | **Pasa** (exit 0, sin salida). |
| `npm test` | **Pasa: 175 suites / 1899 tests**, 0 snapshots; 21.7 s. |
| `npm run build` | **Pasa** con Next.js 16.3.3; TypeScript correcto y 43 páginas estáticas generadas. `/pedido/seguimiento` es dinámica (`ƒ`), `/_not-found` permanece estática (`○`) y no existe `/cierre/historial`. |
| `npm run knip` | **Pasa** (exit 0, sin diagnósticos). |
| `git diff --check` | **Pasa**; Git avisó normalización CRLF/LF en `guia-funcionamiento-pancheria.md`, sin errores de whitespace. |

### Migración de QA-04

- `npx drizzle-kit generate` terminó correctamente y creó `0032_icy_shaman.sql` más `drizzle/meta/0032_snapshot.json`. La migración agrega `idempotency_hash varchar(64)` nullable a `orders` y `sales`; es aditiva, sin default, sin índice y sin rewrite de filas.
- Tras autorización expresa, un preflight ocultando valores validó que `.env.e2e` y la URL usada por migraciones apuntaban al mismo destino descartable con sufijo permitido. `npx drizzle-kit migrate` terminó correctamente **solo en `.env.e2e`**; no se usó `.env.local`.
- `npx drizzle-kit check` pasó localmente (`Everything's fine`) y en Actions (runs `35948485239`, `35949717967`, `35951037629` y `35953586788`): historial de migraciones consistente; el paso siguiente aplicó `0032` a la base E2E descartable del CI.
- **Producción (autorizada por el propietario):** se bajó `.env.production.local` con `vercel env pull`, se usó la URL unpooled para `npx drizzle-kit check` + `npx drizzle-kit migrate`, y el archivo temporal se eliminó. Verificación vía Neon MCP sobre `br-nameless-sun-avrmz655`: `orders.idempotency_hash` y `sales.idempotency_hash` existen como `varchar(64)` nullable y `drizzle.__drizzle_migrations` registra **33** migraciones aplicadas.
- **Ventana de compatibilidad resuelta:** Vercel desplegó `6b24700` a producción antes de que la base tuviera la columna; durante esa ventana el código nuevo referenciaba `idempotency_hash` aún ausente. No se observaron errores runtime en la ventana consultada, pero tampoco hay evidencia de tráfico sobre las rutas afectadas en ese intervalo. La migración cerró el riesgo.

### Deploy y smoke de producción

- Vercel: deployment `dpl_9WFCHFZcChxoJb8FworK8hjF7WHc` en `READY`, target `production`, commit `6b24700`. Dominio productivo verificado: `pancheria-alpha.vercel.app` (único dominio de producción del proyecto).
- Smoke GET (2026-09-24 ~04:18 UTC): `/api/health` → 200 (`{"ok":true,"db":"up"}`); `/pedido` → 307 a `/pedido?branchId=1` → 200; `/api/public/catalogo` → 200; `/pedido/seguimiento` → 200.
- Runtime: `get_runtime_errors` (última hora) sin errores; logs `error`/`fatal` del deployment en los últimos 30 min: sin entradas.
- Alcance del smoke: solo GETs públicos de lectura. No se crearon pedidos ni ventas reales, así que el camino de escritura y el 409 de idempotencia no se ejercitaron end-to-end en producción; eso requeriría una operación de escritura expresamente autorizada.

### Estado funcional verificado por módulo

“Verificado” aquí significa que existen las piezas de código y tests indicados, que los checks locales pasaron, que el PR #9 obtuvo CI remoto verde en sus tres SHAs y que `main` post-merge (`6b24700`) también pasó CI completo, quedó desplegado en producción con `0032` aplicada y respondió al smoke GET. No equivale a una prueba de escritura en producción ni a hardware externo.

| Módulo | Estado | Evidencia en código y tests |
| --- | --- | --- |
| Pedidos públicos | **implementado-verificado** | `/pedido`, catálogo y rutas `/api/public/pedido`; `orderService`/`orderRepository`; tests unitarios de servicio/rutas y specs `tests/e2e/pedido*.spec.ts`. |
| Chat de pedidos | **implementado-verificado** | Página pública de chat, rutas públicas y autenticadas, `chatService`/`orderMessageRepository`; tests unitarios de servicio, rutas y componentes; specs E2E de chat y adjuntos. |
| Ventas | **implementado-verificado** | `/ventas`, `/api/ventas`, `saleService`/`saleRepository`; tests unitarios y specs E2E de disponibilidad, stock compartido, historial y pagos mixtos. |
| Caja y turnos | **implementado-verificado** | `/cierre`, `/api/caja/*`, `cashRegisterService` y helpers de turno; tests unitarios y specs E2E de cierre automático, caja vacía y contactos/turnos. |
| Cierre diario | **implementado-verificado**, integrado al cierre de caja | `closeCashRegister`, `/api/caja/cerrar`, `/ventas/historial/[id]` y `tests/e2e/cierres-diarios.spec.ts`. No hay tabla `dailyClosures` ni página `/cierre/historial`; el cierre diario se materializa en `cash_registers`. |
| Stock | **implementado-verificado** | `/stock`, `/api/stock/*`, `stockService`/repositorios de movimientos; tests unitarios y specs E2E de ajustes, movimientos y concurrencia. |
| Productos, recetas y promos | **implementado-verificado** | `/productos`, `/api/productos`, `/api/recetas`, `productService`/`recipeService` y repositorios; tests unitarios y E2E de catálogo/stock. |
| Sucursales | **implementado-verificado** | `/sucursales`, `branchService`/`branchRepository`; tests unitarios y specs E2E de contactos, turnos, eliminación y sesión con sucursal eliminada. |
| Usuarios y roles | **implementado-verificado** | `/usuarios`, `userService`/`userRepository`, auth; tests unitarios y `tests/e2e/roles-y-sucursales.spec.ts`. |
| Videos y Google Cast | **implementado-verificado** | Páginas `/videos*`, upload/stream, `videoService`/`videoRepository`; tests unitarios y `tests/e2e/videos.spec.ts`. No se probó un Chromecast físico en esta auditoría. |
| Imágenes de productos/promos | **implementado-verificado** | Rutas preparar/upload/lectura, `product-image-storage` y configuración; tests unitarios de rutas y almacenamiento. |

### Deuda consolidada re-verificada

| Ítem | Severidad | Estado real al cierre | Evidencia |
| --- | --- | --- | --- |
| T14 multi-tenant | **mayor** si el objetivo pasa a SaaS; diferido por decisión | **Sigue abierto y no iniciado.** No existe `tenantId`/`tenant_id` en `src/`; el sistema sigue siendo single-tenant con varias sucursales aisladas por `branchId`. No hospedar comercios independientes antes de implementar y probar el aislamiento. | `.devin/prompts/plan-implementacion-multi-tenant.md`; `src/db/schema.ts`; `archivados/auditoria-escalabilidad-2026-09-19.md` §3.9. |
| QA-04: misma `idempotencyKey` con payload distinto | **menor** | **Resuelto y desplegado.** Mergeado en `6b24700` (PR #9); CI verde en los tres SHAs del PR y post-merge en `main`; `0032` aplicada a `.env.e2e`, a la base E2E del CI y a producción (verificado: columnas `varchar(64)` nullable, 33 migraciones en el journal). Las pruebas unitarias cubren pedidos, ventas directas, conversiones, carreras, legacy y HTTP 409. Filas existentes quedan con hash `NULL` y el servicio las trata con ruta segura. Residual: el smoke de producción fue de solo lectura; monitorear tráfico real. | `src/application/idempotencyService.ts`, `src/application/services/orderService.ts`, `src/application/services/saleService.ts`, `src/db/schema.ts`, `drizzle/0032_icy_shaman.sql`, runs `35948485239`/`35949717967`/`35951037629`/`35953586788`, deployment `dpl_9WFCHFZcChxoJb8FworK8hjF7WHc` y tests asociados. |
| Flakiness E2E en uploads, SSE, chat y tour | **menor** | Una corrida local tuvo exit 1 (169 pasaron, 5 fallaron, 1 flaky en 41.9 min): uploads esperaban 400 y recibieron 500/404, SSE 200→404 y no apareció un adjunto; tour agotó una espera pero pasó en retry. Con confirmación del propietario de `STORAGE_PROVIDER=local`, la corrida siguiente pasó **175/175** en 38.9 min y los E2E remotos del PR #9 pasaron en 12 min 26 s y 15 min 05 s. No se aisló la causa del primer resultado; seguir vigilando recurrencias. | `tests/e2e/api-seguridad.spec.ts`, `tests/e2e/chat-stream.spec.ts`, `tests/e2e/pedido-chat-adjuntos.spec.ts`, `tests/e2e/tour.spec.ts`; resultados locales y runs `35948485239`/`35949717967`. |
| Neon efímera por `run_id` / sharding E2E | **menor** | **Parcial.** PR #7 serializó por shard y elevó el timeout a 25 min. No hay aprovisionamiento efímero por `run_id`; `E2E_SHARDS` sigue opt-in y default `[1]`. Duraciones recientes del job E2E: 18 min 06 s (HEAD base), 12 min 26 s / 15 min 05 s / 21 min 05 s (PR #9) y 12 min 18 s (`main` post-merge): todas superan el umbral documentado de ~10 min. | `.github/workflows/ci.yml`; `archivados/ci-e2e-base-compartida.md`; runs `35878657216`, `35948485239`, `35949717967`, `35951037629` y `35953586788`. |
| `/_not-found` estática sin nonce CSP | **menor** | **Sigue abierto como limitación conocida.** El build la marca `○` estática y `src/app/not-found.tsx` no fuerza render dinámico; el informe de QA indica que el `<Link>` conserva navegación nativa, aunque el navbar no hidrata. | Salida de `npm run build`; `src/app/not-found.tsx`; `archivados/auditoria-qa-ronda-2-2026-09-23.md`. |
| Limpieza de archivos después de borrar una sucursal | **menor** | El hard delete en cascada se mantiene por decisión del usuario. `deleteBranch` intenta liberar imágenes, adjuntos y videos tras el commit; registra conteos sin keys y el cron elimina archivos huérfanos. También registra fallos al retirar rate-limit entries, cuya expiración procesa el cron correspondiente. No se hizo un borrado real ni se probaron proveedores externos; ante una caída persistente, la limpieza puede demorarse. | `src/application/services/branchService.ts`, `src/application/services/cleanupService.ts`, `src/lib/orphaned-files.ts`, tests de servicio/repositorio de sucursal. |
| Controles operativos recurrentes: `VERCEL_PRODUCTION_URL`, cron y consumo Neon/Vercel | **informativo / recurrente** | **Parcialmente verificado.** El dominio productivo se confirmó (`pancheria-alpha.vercel.app`) y los crons `Expirar pedidos pendientes` más recientes terminaron `success` (`35942518204`, `35931961170`). Siguen sin inspeccionarse el valor de `VERCEL_PRODUCTION_URL` (variable de repo) ni las métricas de consumo/límites de Neon/Vercel. | `.devin/informes/checklist-pre-push.md`; `archivados/auditoria-proyecto-2026-09-20.md` §7; dominios del proyecto Vercel; runs `35942518204`/`35931961170`. |
| Validación de consistencia de migraciones en CI | **menor** | **Resuelto.** `npx drizzle-kit check` precede a `drizzle-kit migrate` en el job E2E; ambos pasos terminaron `success` en los tres runs del PR #9 y en el post-merge `35953586788` de `main`. La aplicación de `0032` a producción también se verificó (columnas + journal). | `.github/workflows/ci.yml`; runs `35948485239`/`35949717967`/`35951037629`/`35953586788`; verificación Neon de producción; `archivados/auditoria-deploy-vercel-2026-09-14.md` §Conclusión. |
| Verificación del blueprint DRS en Devin Cloud | **informativo / condicional** | **No resuelto en evidencia disponible.** El plan archivado dice que está resuelto, pero su tabla interna conserva la verificación de DRS como pendiente; la existencia de `.devin/environment.yaml` no prueba un build remoto. Confirmar si todavía se usa DRS. | `archivados/plan-de-accion-2026-08-27.md` §2; `.devin/README.md`. |

### Decisión confirmada: eliminación de sucursales

Por pedido explícito del propietario, se mantiene el **hard delete en cascada** y no se implementará soft-delete. `deleteCascade` elimina las tablas principales dentro de una transacción; las tablas hijas dependen de sus FKs `ON DELETE CASCADE`. Después del commit se intentan borrar imágenes, adjuntos y videos. Si fallan storage o el borrado de intentos de login, se registran conteos sin keys/nombres; los crons respectivos hacen la limpieza posterior. La cobertura unitaria verifica tablas eliminadas y ambos caminos de warning; no se borró ninguna sucursal real.

### Prompts, TODOs y pendientes en archivados

- `.devin/prompts/README.md` enumera **7 prompts activos**. Los prompts de auditoría son guías reutilizables; `plan-implementacion-multi-tenant.md` sigue siendo una propuesta sin implementar. No encontré otro prompt de implementación activo cuyo trabajo ya esté resuelto.
- La búsqueda case-sensitive de `TODO|FIXME|HACK` en `src/` y `tests/` devolvió **0 coincidencias**.
- Los pendientes y controles de informes archivados (T14, QA-04 ya resuelto y desplegado, alternativa de Neon/sharding, `/_not-found`, controles operativos Vercel/Neon y DRS) están reflejados arriba. La retención soft-delete de sucursales quedó descartada por decisión del propietario. SSE sigue opt-in deshabilitado según el estado documentado; el valor actual en producción no se inspeccionó (ver «No verificado»). T16 (réplicas/agregaciones) quedó descartado a la escala actual, con umbral de reevaluación documentado.
- La sincronización de `auditoria-qa-ronda-2-2026-09-23.md` se corrigió en esta rama: ya registra PR #7 y la serialización E2E; el pendiente es Neon efímera/sharding. También registra la decisión actual de mantener hard delete de sucursales.
- `archivados/plan-de-accion-2026-08-27.md` tiene encabezado «resuelto», pero su tabla interna aún lista pendiente la verificación del blueprint DRS; se conserva como condicional y no verificado arriba, porque no se comprobó Devin Cloud.
- El mismo plan conserva una «decisión pendiente» antes de eliminar archivos históricos: es una condición para una limpieza opcional, no una tarea funcional abierta. No se eliminó ningún archivo.
- Los snapshots bajo `archivados/historico/` conservan tareas antiguas por regla documental; no se reabren como pendientes vigentes.

### Sincronización documental — muestreo

- Las variables de configuración de runtime encontradas en `src/config/` están representadas en `.env.example` y en la sección de entorno de `AGENTS.md`. `NODE_ENV` y `VERCEL` son valores del runtime/plataforma, no claves de configuración para completar en `.env.example`. No encontré faltantes o sobrantes claros de variables de negocio.
- Los comandos `npm run` documentados en `AGENTS.md` existen en `package.json`; las herramientas `drizzle-kit` y `tsx` usadas vía `npx` están en dependencias de desarrollo.
- Los enlaces Markdown de los índices vigentes de `.devin/` apuntan a archivos existentes en el muestreo revisado; no se encontraron referencias Markdown rotas en esos índices.
- Las discrepancias encontradas se corrigieron en el PR #9: `README.md` ya no promete `/cierre/historial`, el cierre se describe mediante `cash_registers`/`/ventas/historial`; la tabla de la guía ya no nombra `dailyClosures`; se quitó el índice multi-tenant obsoleto de `daily_closures`; y la nota archivada de concurrencia E2E registra la resolución por PR #7. No se creó una ruta ni se inició T14.
- La auditoría de deploy recomendaba verificar consistencia de migraciones en CI. `migrate` en la base E2E valida la aplicación, pero no comprueba el historial generado; por eso agregué `npx drizzle-kit check` antes de `migrate` en el job E2E y documenté el comando en `AGENTS.md`, README y checklist. Los runs `35948485239`, `35949717967`, `35951037629` (PR #9) y `35953586788` (`main` post-merge) ejecutaron ambos pasos en verde.

### Riesgos y recomendaciones priorizadas

| Prioridad | Impacto × esfuerzo | Recomendación accionable |
| --- | --- | --- |
| P1 | Alto × bajo, condicional | Mantener producción limitada a un comercio con varias sucursales. No iniciar T14 ni hospedar comercios independientes hasta que el propietario reabra explícitamente ese objetivo y exista un plan de aislamiento/backfill/rollback. |
| P1 | Alto × bajo | Monitorear producción tras QA-04: revisar runtime errors en una ventana de tráfico real (24–48 h) y, si se autoriza, un smoke de escritura controlado (crear y anular un pedido de prueba) para ejercitar el camino de idempotencia y el 409 en producción. El smoke GET y las verificaciones de esquema ya pasaron. |
| P2 | Medio × bajo | Mantener el hard delete en cascada de sucursales según la decisión del propietario. Conservar el resumen/confirmación explícita, revisar warnings de limpieza y asegurar backups operativos; no agregar soft-delete. |
| P2 | Medio × medio | Planificar sharding E2E con una base descartable independiente por shard: los últimos E2E remotos tomaron entre 12 min 18 s y 21 min 05 s, todos por encima del umbral orientativo de 10 min. No activar `E2E_SHARDS` hasta aprovisionar y verificar cada par de secrets/base; Neon efímera por `run_id` es una fase posterior. |
| P3 | Bajo × bajo | Revisar `VERCEL_PRODUCTION_URL` (variable de repo), métricas Neon/Vercel y DRS sin exponer valores. El dominio productivo ya se verificó (`pancheria-alpha.vercel.app`). |

### Próximos pasos concretos

1. Mantener T14 sin iniciar y el alcance single-tenant/multi-sucursal hasta una decisión explícita distinta. Mantener también el hard delete en cascada de sucursales tal como lo pidió el propietario.
2. Confirmar estabilidad post-release: revisar runtime errors de Vercel en una ventana de tráfico real (24–48 h). Si el propietario lo autoriza, hacer un smoke de escritura controlado (crear y anular un pedido de prueba) para ejercitar el camino completo de idempotencia y el 409 en producción.
3. Toda corrida futura sobre `.env.e2e` requiere autorización porque `global-setup.ts` vuelve a truncar y reseedear. `0032` ya quedó aplicada en `.env.e2e`, en la base E2E del CI y en producción.
4. Si E2E sigue sobre ~10 min o hay presión por concurrencia, provisionar una base Neon distinta por shard y recién entonces habilitar `E2E_SHARDS`; dejar efímera por `run_id` para una fase posterior.
5. En la próxima revisión operativa, comprobar `VERCEL_PRODUCTION_URL` y consumo de Neon/Vercel sin registrar valores; confirmar si Devin Cloud/DRS sigue en uso y validar el blueprint solo si corresponde.

### Limitaciones y aspectos no verificados

- La última corrida autorizada de `npm run test:e2e` tras corregir las specs concluyó: **175/175 pasaron** en 38.9 min; una corrida previa tuvo 5 fallos y 1 flaky que no se reprodujeron. Los artefactos de la corrida previa registraron fallos en uploads, SSE/chat y una espera flaky del tour (ver tabla de deuda); no se reprodujeron en esta corrida. El `global-setup.ts` truncó/reseedeó `.env.e2e`; la base contiene datos de la suite. No se aisló aún la causa de esos fallos.
- El propietario confirmó que `.env.e2e` usa `STORAGE_PROVIDER=local`; no se imprimieron ni inspeccionaron valores. No se consultó storage remoto. Otra E2E requiere autorización nueva porque el setup vuelve a truncar/reseedear.
- Merge, deploy y migración de producción ya realizados: PR #9 mergeado como `6b24700`, CI post-merge `35953586788` en verde, Vercel `READY` y `0032` aplicada y verificada en Neon `main`. El smoke de producción se limitó a GETs públicos; no se ejercitó una escritura real ni el 409 de idempotencia end-to-end en producción.
- No se inspeccionaron ni mostraron valores de `.env.local`, GitHub Secrets/Variables o Vercel. `.env.e2e` se procesó internamente en el preflight, la migración y E2E autorizados; `.env.production.local` se usó solo para la migración autorizada y se eliminó. No se imprimieron URLs ni credenciales. Siguen sin revisarse la variable `VERCEL_PRODUCTION_URL` del repo ni las métricas de consumo de Neon/Vercel.
- No se ejecutó una eliminación real de sucursal ni se probaron proveedores de storage externos; las pruebas de cascada/limpieza son unitarias con mocks.
- No se validó el blueprint de Devin Cloud (`devin.exe cloud drs build`) ni se probó Google Cast con un dispositivo físico.

### Regla documental vigente

- `informes/` raíz = documentos operativos y tickets abiertos.
- `archivados/` = guías con valor futuro, implementadas completas o con pendiente explícito trackeado aquí en §0; mantener el marcador `Estado:`.
- `archivados/historico/` = snapshots congelados, solo historia.
- Al cerrar un PR, archivar su informe y actualizar esta sección; los detalles de auditorías anteriores se referencian, no se duplican.

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
