# Reporte de estado — snapshot 2026-10-02

> §0 vigente al 2026-10-02 (`main` en `dfb2872`), congelado el 2026-10-27 al reemplazarlo por el §0 actual en `../reporte-estado.md`. Historia pura: no se edita.

---

## 0. Estado vigente (revisión 2026-10-02; `main` en `dfb2872`)

**Baseline Git:** `main`/`origin/main` en `dfb2872` ("feat: detalle de ítems en /pedido/seguimiento"). Working tree: cambios **solo documentales** en `.devin/` de esta sesión de limpieza; `.vscode/` sigue sin trackear. No hay cambios de código pendientes. El §0 anterior quedó congelado en `archivados/historico/reporte-estado-2026-09-24.md`.

**Producción:** Vercel `READY` sobre `dfb2872` (`pancheria-alpha.vercel.app`, verificado vía MCP el 10-02). Migración `0034_needy_puppet_master` aplicada en Neon prod: `notes` existe en `order_items` y `sale_items` (verificado vía MCP sobre `br-nameless-sun-avrmz655`; el conteo exacto del journal no se pudo releer por scope de credencial, pero las columnas cubren el riesgo de compatibilidad).

**CI:** run `37075242547` de `3a029e4` en verde (todos los jobs, incluido E2E). Los pushes `f1e684c` y `dfb2872` (docs + detalle de seguimiento) tienen sus runs en curso/pendientes al momento de esta revisión. El cron `Expirar pedidos pendientes` corre `success` periódicamente.

### Commits integrados desde el cierre anterior (post-2026-09-24)

| Commits | Fecha | Contenido |
| --- | --- | --- |
| `5021d81`–`9fc1266` | 09-26/27 | **PR #10** — rediseño UX de `/sucursales` (inventario primero, banner al eliminar) + rutas dedicadas `/sucursales/nueva`, `/sucursales/[id]/editar`, `/usuarios/nuevo`, `/usuarios/[id]/editar` |
| `a50c1da`, `3114802`, `53cfe63` | 09-27 | Rate limit de login por IP (con índice de cleanup), bcrypt 10→12, seed admin obligatorio en todo entorno (`SEED_RESET_ADMIN_PASSWORD=1` para reset), índices de cleanup (`0033_last_synch` — aplicada a desarrollo, E2E del CI y producción), `npm audit` no bloqueante y unificación de avisos/controles de caja en `/cierre`, `/ventas` e historial |
| `60acdfd`, `6d32597` | 09-28 | Vista previa del catálogo público en el form de sucursal; bloques de contacto de sucursal compartidos en el flujo público |
| `fc6cfe9`, `8c76e9b` | 10-01 | **Cobro con medio de pago al confirmar pedido** (`PedidoConfirmDialog` + `PaymentPartsInput`: efectivo/transferencia/mixto — deja de asumirse efectivo). Seed endurecido: `DEFAULT_BRANCH_OPENING_HOURS`/`NEW_BRANCH_OPENING_HOURS` validados y catálogo de muestra detrás de `SEED_SAMPLE_CATALOG=1`. Spec de expiración adaptada al diálogo de cobro |
| `e6ad216`, `8150ee9` | 10-01 | Mapa de arquitectura en tres niveles (`arquitectura/`) con renders `.svg` (fuentes `.mmd` eliminadas); verificación operativa de `VERCEL_PRODUCTION_URL`, crons, storage y Neon provider |
| `6a004e1`, `d0ac9dc`, `d116bd6` | 10-01 | Dependencias de `npm audit` actualizadas; CI con solo Chromium en el job E2E y timeout del paso a 35 min |
| `ccf4e99` | 10-01 | Imágenes de producto en `/pedido` (`resolveProductImage`, `localPatterns`) + `verifyUploadedProductImage` (firma/magic bytes verificada en providers remotos, URL canónica del servidor) |
| `3a029e4`, `f1e684c`, `dfb2872` | 10-02 | **Rediseño food-delivery de `/pedido` (PRs 1–3, informes en `archivados/`)**: tema claro `[data-theme='light']` en `(public)` con overlays portaleados marcados, card con hero/quick-add, `PromoOptionsDialog` rediseñado (toggles, stepper de cantidad → N líneas idénticas, CTA con precio), **aclaraciones por ítem** (`notes` en `order_items`/`sale_items`, migración `0034`), decisión de negocio sobre extras cobrables (opcionales de receta incluidos en el precio; extras = productos `service` standalone) y detalle de ítems en `/pedido/seguimiento` |

### Defectos de pruebas manuales (D1–D10) — re-verificados contra el código

| # | Defecto | Estado | Evidencia |
| --- | --- | --- | --- |
| D1 | Cancelar `paid`/anular con producto eliminado | Resuelto | `buildProductContext` con `includeDeleted: true` en `cancelSale` y `closeCashRegister` |
| D2 | Pedido público aceptado fuera de horario | Resuelto | `createOrder` evalúa `isBranchOpen` cuando la sucursal tiene `openingHours` |
| D3 | JWT de usuario eliminado operativo | Resuelto | `revalidateSessionUser` en `requireAuth`/`getCurrentBranchId*` (`src/lib/auth.ts`) |
| D4 | Reasignación de sucursal sin efecto en sesiones activas | Resuelto | la misma revalidación sincroniza `branchId`/`role` en la sesión |
| D5 | Cancelación pública anulaba pedidos `paid` | Resuelto | `cancelOrder` rechaza `paid` cuando llega `token` (flujo público); el panel sí puede |
| D6 | Lockout degradaba a error genérico | Resuelto | `login-form`/`actions` muestran "Demasiados intentos fallidos" |
| D7 | Duplicados de sucursal por mayúsculas | Resuelto | `findByNameCaseInsensitive` en `createBranch` |
| D8 | Ajuste de stock con tipos reservados | Resuelto | `stockAdjustmentTypeSchema` = `manual_adjustment`/`restock` |
| D9 | Ajuste de stock no admin-only | Resuelto (decisión + atribución) | Decisión 09-24: operadores pueden ajustar (sin `admin:true`). Atribución implementada: `stock_movements.performed_by` (migración `0035`) registra el usuario en ajustes `manual_adjustment`/`restock`; visible en la columna "Por" de `/stock` |
| D10 | Mensajes Zod en inglés / ambigüedad caja-horario | Resuelto | schemas con `message` en español; el error de caja distingue ausencia de caja de fuera de horario |

### Verificaciones locales (2026-10-02)

Cambios de esta sesión: **solo documentales** en `.devin/` (limpieza, archivado y sincronización). Los checks se corrieron por regla de cierre:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | **Pasa** (0 errores; 1 warning preexistente en `sign-out-client.tsx` por `window.location.assign()`). |
| `npx tsc --noEmit` | **Pasa** (sin salida). |
| `npm test` | **Pasa: 178 suites / 2027 tests** en 19.4 s, 0 snapshots. |
| `npm run build` | **Pasa** con Next.js 16.3.8 (declarado `^16.3.3`); 45 páginas generadas, `/_not-found` sigue `○` estática; aparecen `/sucursales/nueva`, `/sucursales/[id]/editar`, `/usuarios/nuevo`, `/usuarios/[id]/editar`. |
| `npm run knip` | **Pasa** (sin diagnósticos). |
| `npx drizzle-kit check` | **Pasa** ("Everything's fine") — journal consistente con `drizzle/` (36 migraciones, `0000`–`0035`; `0035` agrega `stock_movements.performed_by`). |
| `git diff --check` | **Pasa**; solo aviso de normalización LF→CRLF en el SVG regenerado. |
| Enlaces Markdown de `.devin/` | **OK**: chequeo automatizado de los `](ruta)` internos sin enlaces rotos tras corregir `../shots/` y `../entornos.md` en los informes archivados del rediseño. |

### Estado funcional verificado por módulo

“Verificado” aquí significa que existen las piezas de código y tests indicados, que los checks locales pasaron, que el CI de `main` está verde en el HEAD con código de aplicación (`3a029e4`, run `37075242547`) y que producción quedó `READY` sobre `dfb2872` con `0034` aplicada. No equivale a una prueba de escritura en producción ni a hardware externo.

| Módulo | Estado | Evidencia en código y tests |
| --- | --- | --- |
| Pedidos públicos | **implementado-verificado** | `/pedido` rediseñado (tema claro, card con hero/quick-add, aclaraciones por ítem), catálogo y rutas `/api/public/pedido`; `orderService`/`orderRepository`; tests unitarios de servicio/rutas y specs `tests/e2e/pedido*.spec.ts`. |
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
| D9: ajuste de stock sin rol admin | **menor** | **Resuelto.** Decisión 09-24 mantenida (operadores ajustan, sin `admin:true`); atribución agregada: `stock_movements.performed_by` (`varchar(255)`, migración `0035`) registra `session.user.name` en ajustes manuales — mismo patrón `varchar` que `cash_registers.openedBy/closedBy`. Residual: movimientos de sistema (venta, reserva, cancelación) e históricos quedan `NULL`. | `src/app/api/stock/ajustar/route.ts`; `src/application/services/stockService.ts`; `drizzle/0035_performed_by_stock_movements.sql`. |
| Flakiness E2E | **menor** | Estable en las corridas recientes: CI verde en `3a029e4` (run `37075242547`, incluido el job E2E). El paso E2E tiene timeout de 35 min desde `d116bd6`. Seguir vigilando recurrencias. | `.github/workflows/ci.yml`; run `37075242547`. |
| Neon efímera por `run_id` / sharding E2E | **menor** | **Parcial.** Serialización por shard y timeout de 35 min vigentes; `E2E_SHARDS` sigue opt-in con default `[1]` y sin aprovisionamiento efímero. Activarlo solo con una base descartable por shard. | `.github/workflows/ci.yml`; `archivados/ci-e2e-base-compartida.md`. |
| `/_not-found` estática sin nonce CSP | **menor** | **Sigue abierto como limitación conocida.** El build la marca `○` estática y `src/app/not-found.tsx` no fuerza render dinámico. | `src/app/not-found.tsx`; `archivados/auditoria-qa-ronda-2-2026-09-23.md`. |
| Limpieza de archivos después de borrar una sucursal | **menor** | El hard delete en cascada se mantiene por decisión del usuario. `deleteBranch` intenta liberar imágenes, adjuntos y videos tras el commit; registra conteos sin keys y el cron elimina archivos huérfanos. Ante una caída persistente, la limpieza puede demorarse. | `src/application/services/branchService.ts`, `src/application/services/cleanupService.ts`, `src/lib/orphaned-files.ts`. |
| Controles operativos: `VERCEL_PRODUCTION_URL`, crons, consumo Neon/Vercel | **informativo / recurrente** | **Verificado el 2026-10-01** en la sesión del mapa de arquitectura: `VERCEL_PRODUCTION_URL` apunta al dominio productivo real, `CRON_SECRET` coincide (dispatch manual devolvió `{"ok":true}`) y ambos crons de Vercel responden con evidencia de ejecución. Frecuencia real de `expire-orders`: ~4–8 veces/día (throttling de schedules de GH Actions), sin impacto gracias a la expiración lazy. Queda recurrente el consumo Neon/Vercel. | `arquitectura/salud-arquitectura.md` §verificación operativa; `arquitectura/servicios-externos.md`. |
| Observación del rediseño `/pedido` en producción | **menor** | Deployado el 10-02 sobre `dfb2872`. Revisar runtime errors en una ventana de tráfico real (24–48 h) y, si se autoriza, un smoke de escritura controlado (crear y anular un pedido) para ejercitar el camino completo de idempotencia y `notes` end-to-end. | Deployment `dpl_CCTyXaU4hHEEqLhWJLBqAMoVpP6h`; commits `3a029e4`/`f1e684c`/`dfb2872`. |
| Verificación del blueprint DRS en Devin Cloud | **informativo / condicional** | **No resuelto en evidencia disponible.** El plan archivado dice que está resuelto, pero su tabla interna conserva la verificación de DRS como pendiente; la existencia de `.devin/environment.yaml` no prueba un build remoto. Confirmar si todavía se usa DRS. | `archivados/plan-de-accion-2026-08-27.md` §2; `.devin/README.md`. |

### Decisión confirmada: eliminación de sucursales

Por pedido explícito del propietario, se mantiene el **hard delete en cascada** y no se implementará soft-delete. `deleteCascade` elimina las tablas principales dentro de una transacción; las tablas hijas dependen de sus FKs `ON DELETE CASCADE`. Después del commit se intentan borrar imágenes, adjuntos y videos. Si fallan storage o el borrado de intentos de login, se registran conteos sin keys/nombres; los crons respectivos hacen la limpieza posterior. La cobertura unitaria verifica tablas eliminadas y ambos caminos de warning; no se borró ninguna sucursal real.

### Prompts, TODOs y pendientes en archivados

- `.devin/prompts/README.md` enumera **7 prompts activos**: `pancheria.prompt.md` (prompt maestro), 4 guías de auditoría reutilizables (`auditoria-cobertura-de-pruebas`, `auditoria-escalabilidad`, `auditoria-pre-release`, `auditoria-qa-integral`, `auditoria-y-documentacion`) y `plan-implementacion-multi-tenant.md` (propuesta T14 sin implementar). Los prompts del rediseño `/pedido` y del mapa de arquitectura quedaron archivados tras su ejecución.
- Los pendientes y controles de informes archivados (T14, D9, sharding E2E, `/_not-found`, controles operativos y DRS) están reflejados arriba. La retención soft-delete de sucursales quedó descartada por decisión del propietario. SSE sigue opt-in deshabilitado; T16 (réplicas/agregaciones) quedó descartado a la escala actual.
- `archivados/plan-de-accion-2026-08-27.md` tiene encabezado «resuelto», pero su tabla interna aún lista pendiente la verificación del blueprint DRS; se conserva como condicional y no verificado arriba, porque no se comprobó Devin Cloud.
- Los snapshots bajo `archivados/historico/` conservan tareas antiguas por regla documental; no se reabren como pendientes vigentes.

### Sincronización documental (sesión 2026-10-02)

- Se archivaron 7 informes resueltos (`auditoria-ux-sucursales`, `prueba-promo-imagen`, `pruebas-manuales`, `resultados-pruebas`, `rediseno-pedido-pr1/pr2/pr3`) y 3 prompts ejecutados (`plan-rediseno-card-y-modal-pedido`, `rediseno-pedido-pr2-modal`, `mapa-arquitectura`), con marcador `Estado:` y enlaces relativos corregidos.
- Se eliminaron 11 scripts descartables/de una sola sesión de `.devin/tmp/` (quedaron los helpers genéricos `api.sh`, `env*.ts`, `setup.ts`, `sql.ts`, todos gitignorados y sin credenciales).
- `arquitectura/base-de-datos.md` se sincronizó con la migración `0034` (`notes` en `order_items`/`sale_items`) y se regeneró `diagramas/svg/base-de-datos.svg`.
- `guia-funcionamiento-pancheria.md` documenta ahora las aclaraciones por ítem, el cobro efectivo/transferencia/mixto al confirmar pedido y la regla de extras cobrables (productos `service` standalone).
- Los tres índices (`.devin/README.md`, `informes/README.md`, `prompts/README.md`) reflejan la estructura final.

### Riesgos y recomendaciones priorizadas

| Prioridad | Impacto × esfuerzo | Recomendación accionable |
| --- | --- | --- |
| P1 | Alto × bajo, condicional | Mantener producción limitada a un comercio con varias sucursales. No iniciar T14 ni hospedar comercios independientes hasta que el propietario reabra explícitamente ese objetivo y exista un plan de aislamiento/backfill/rollback. |
| P1 | Alto × bajo | Monitorear producción tras el rediseño `/pedido`: revisar runtime errors en una ventana de tráfico real (24–48 h) y, si se autoriza, un smoke de escritura controlado (crear y anular un pedido con aclaraciones) para ejercitar idempotencia, `notes` y el cobro al confirmar en producción. |
| P2 | Medio × bajo | Atribución de ajustes implementada (`performed_by`, migración `0035`). Extensión opcional a futuro: vendedor/anulador en `sales` y operador en `orders` (mismo hueco de trazabilidad). |
| P2 | Medio × medio | Si E2E se acerca al timeout de 35 min o hay presión por concurrencia, provisionar una base Neon distinta por shard y recién entonces habilitar `E2E_SHARDS`; Neon efímera por `run_id` queda para una fase posterior. |
| P3 | Bajo × bajo | Revisar periódicamente consumo de Neon/Vercel y confirmar si Devin Cloud/DRS sigue en uso. |

### Próximos pasos concretos

1. Mantener T14 sin iniciar y el alcance single-tenant/multi-sucursal hasta una decisión explícita distinta. Mantener también el hard delete en cascada de sucursales tal como lo pidió el propietario.
2. Confirmar estabilidad post-rediseño: runtime errors de Vercel en 24–48 h de tráfico real; smoke de escritura solo con autorización.
3. D9 cerrado con `performed_by` (`0035`); si se quiere trazabilidad completa, evaluar la misma columna en `sales`/`orders`.
4. Toda corrida futura sobre `.env.e2e` requiere autorización porque `global-setup.ts` vuelve a truncar y reseedear. `0033`/`0034` ya están aplicadas en producción.
5. En la próxima revisión operativa, comprobar consumo de Neon/Vercel sin registrar valores y confirmar si Devin Cloud/DRS sigue en uso.

### Limitaciones y aspectos no verificados

- Esta sesión fue **documental**: no se crearon pedidos ni ventas reales en producción; el camino de escritura (idempotencia 409, `notes`, cobro al confirmar) se verificó en código y tests, no end-to-end en prod.
- No se inspeccionaron ni mostraron valores de `.env.local`, GitHub Secrets/Variables o Vercel. Siguen sin revisarse las métricas de consumo de Neon/Vercel.
- No se ejecutó una eliminación real de sucursal ni se probaron proveedores de storage externos; las pruebas de cascada/limpieza son unitarias con mocks.
- No se validó el blueprint de Devin Cloud (`devin.exe cloud drs build`) ni se probó Google Cast con un dispositivo físico.
- Los CI runs de `f1e684c` y `dfb2872` estaban en curso/pendientes al momento de esta revisión; el último run verde con código de aplicación es `37075242547` (`3a029e4`).

### Regla documental vigente

- `informes/` raíz = documentos operativos y tickets abiertos.
- `archivados/` = guías con valor futuro, implementadas completas o con pendiente explícito trackeado aquí en §0; mantener el marcador `Estado:`.
- `archivados/historico/` = snapshots congelados, solo historia.
- Al cerrar un PR, archivar su informe y actualizar esta sección; los detalles de auditorías anteriores se referencian, no se duplican.

---
