# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-10-27 (actualizado)
**Proyecto:** `pancheria`
**Histórico:** snapshots anteriores en `.devin/informes/archivados/historico/`

---

## 0. Estado vigente (revisión 2026-10-27; `main` local = `origin/main` en `b6f182a`)

**Baseline Git:** `main` en `b6f182a` ("docs: corrida de higiene documental 2026-10-27"), **sincronizado con `origin/main`** — el push del 10-27 integró `1603df3` (fix ubicación chat), `2e6504d` (pin de entrega obligatorio) y `b6f182a` (esta corrida documental). Working tree: limpio salvo los archivados posteriores al push. El §0 anterior (2026-10-02, `dfb2872`) quedó congelado en `archivados/historico/reporte-estado-2026-10-02.md`.

**Producción:** Vercel `READY` sobre `b6f182a` (deployment `dpl_BYCm3NfPRFXXgakm7J8SnPbv1ZPZ`, aliased `pancheria-alpha.vercel.app`). La migración `0043_delivery-location` fue **aplicada a prod antes del push** vía `drizzle-kit migrate` con `DATABASE_URL_UNPOOLED` (verificado: fila en `drizzle.__drizzle_migrations` con hash `1d02c48c…` + columna `orders.delivery_location` presente). Pin de entrega y fixes de chat **ya deployados**.

**CI:** run `40579566454` **success** sobre `b6f182a` — todos los jobs verdes incluidos los shards E2E 1 y 2 (~13 min). Schedules activos verificados verdes hoy: `uptime-probe`, `expire-orders` y `sanity-audit` diario.

### En curso (sin commitear, 2026-10-27)

- **Página de pedido con marca única** (`/pedido-config`, migración `0044_brand-settings`): header y pie empresariales en `/pedido`, seguimiento, chat, `/pantalla` y `/menu`; chat accesible desde el seguimiento y captación (Open Graph, JSON-LD y compartir con QR). Informe: `informes/pagina-pedido-marca-2026-10-27.md`. Migración `0044` aplicada en dev, E2E y producción (2026-10-27). E2E: `pedido-marca` 9/9 y suite completa con un caso inestable de `responsive` (ver informe). El desborde del encabezado del panel quedó resuelto con menú "Más" y menú de usuario (breakpoint `xl`). Pendiente: deploy de este código, revisión legal y commit/PR.

### Commits integrados desde el cierre anterior (post-2026-10-02, 79 commits)

| Commits | Fecha | Contenido |
| --- | --- | --- |
| `f108ceb`, `54a1b15`, `56bdaaa` | 10-05 | **Sucursal activa `is_active`** (migración `0038`, alternativa al hard delete en superficie pública) + cierre de la auditoría CI: pedido a sucursal eliminada responde `400` (no `404`), gate `docs-only`, `concurrency` por ref, bump de actions a node24 |
| `2ab73a7`, `10a0c82`, `491ab77`, `69c5336`, `047e3e4` | 10-04/06 | **PRs de nueva sucursal** — carga idempotente del catálogo Panchería Popular, consumo por insumo en cierre, reporte de ventas por período con CSV (`/reportes`), runbook y alta por script |
| `97fe1a7`, `e6a296a`, `6775d44`, `de45368`, `a710798`, `f7194d6` | 10-05/06 | **Observabilidad** — `uptime-probe` a producción, `/api/cron/sanity-audit` + workflow diario, worker Cloudflare `pancheria-healthcheck`, relay `POST /api/cron/alert` a ntfy |
| `a4352cf`, `fe837d7` | 10-15 | **Fix editor de promos/carrito** (400 en `POST /api/recetas`): flags de insumos derivados del tipo + validaciones por fila + normalización de filas legacy (informe archivado) |
| `50e865a`, `6284631` | 10-2x | **Lock de corrida E2E** (`e2e_run_lock`): serializa corridas concurrentes sobre la base compartida; un re-run de CI re-toma su propio lock |
| `f75d83d`, `e5fbb8a`, `71afb3a`, `409f625`, `fe1e250`, `cf3137d`, `80467b3`, `eaeb250` | 10-1x | **Imágenes de producto** — normalización 16:9 + trim de aire en navegador, imágenes solo por upload/storage (sin URLs externas), script de reencuadre, object-contain |
| `11cf704`, `84b36d4`, `cff9241` | 10-18 | **`/pantalla` kiosk** publicitaria por sucursal + configurador `/pantalla-config` + acceso multi-sucursal desde el panel |
| `f39c24e`, `a844e41`, `3b05d32` | 10-2x | **Menú digital `/menu` kiosk** (carta paginada, QR persistente) + `/pantalla-config` renombrada a «Pantallas» con dos secciones |
| `621c66f` | 10-2x | **Bajar frecuencias por cuota Neon** — `expire-orders` `*/5`→`*/15`, `uptime-probe`→`*/30`, worker healthcheck→`*/10` |
| `bbcb1b8`, `32171d8` | 10-25 | **Migración Neon** — prod a proyecto `pancheria-db` en `us-east-1` (misma región que functions); base E2E a proyecto dedicado `pancheria-e2e` (`neondb_e2e`/`neondb_e2e2`, sharding activo `[1,2]`) |
| `e57a168`, `3a905ac`, `d6506d7` | 10-2x | **Card "Base de datos"** en el dashboard admin (`GET /api/panel/neon-usage`): CU-horas del ciclo Neon; degrada `invalid_credentials`/`disabled` sin 500 |
| `da0af67`, `c165a42`, `7a94e6d`, `09665ad`, `905b236` | 10-26 | **Sincronización `/ventas` ↔ `/pedido`** (refresco en vivo, tema claro híbrido, quick-add), simplificación de `/cierre`, card clickeable y pre-check de puerto en `npm run dev` |
| `3ce3e17` | 10-27 | **UX del chat** — bienvenida en dos mensajes, badge de leídos corregido (`useSyncExternalStore`), adjuntos con validación temprana + soporte PDF |
| `1603df3`, `2e6504d`, `b6f182a` | 10-27 | **Pin de entrega obligatorio en `delivery`** (deployado): `orders.deliveryLocation` (migración `0043` aplicada en prod), captura GPS explícita o enlace validado en checkout, normalización `tryBuildLocationUrl`, mensaje automático al chat y "Ubicación de entrega" en el panel + corrida de higiene documental |
| `94e3e2a`, `#11`–`#16`, `b929f1b`, `0184b75` | varias | Seguridad (next `16.4.3` + dedupe zod tras audit, hardening de APIs públicas/chat/cron), bumps de deps (pg `8.23.1`, lucide `1.51.0`, etc.) y fix del selector de insumos (`Combobox` portaleado) |
| `03e079b`, `0eb6d32`, `f89a45a`, `f7e7181`, `d4ccd18`, `16485c6` | varias | Scripts de carga (catálogo, stock, backfill de snapshots, normalización de recetas), productos eliminables con historial, tope de opcionales + unicidad de nombre por sucursal, resumen del cliente con insumos elegidos, guías en formularios |

### Verificaciones locales (2026-10-27)

Cambios de esta sesión: **solo documentales** en `.devin/` + `AGENTS.md`/`README.md`/`CONTEXTO.md` (ciclo de higiene documental completo; ningún cambio de código de negocio).

| Comando | Resultado |
| --- | --- |
| `npm run lint` | **Pasa** (0 errores; el warning preexistente de `sign-out-client.tsx` por `window.location.assign()`). |
| `npx tsc --noEmit` | **Pasa** (sin salida). |
| `npm test` | **Pasa: 209 suites / 2454 tests** en ~17 s, 0 snapshots. |
| `npm run build` | **Pasa** con Next.js 16.4.x (declarado `^16.3.3`); todas las rutas `ƒ` dinámicas + proxy middleware; `/reportes`, `/menu`, `/pantalla`, `/pantalla-config` presentes. |
| `npm run knip` | **Pasa** (sin diagnósticos). |
| `npx drizzle-kit check` | **Pasa** ("Everything's fine") — journal consistente con `drizzle/` (`0000`–`0043`; `0043` agrega `orders.delivery_location`). |
| `git diff --check` | **Pasa**; solo avisos de normalización LF→CRLF en los SVG regenerados. |
| Enlaces Markdown de `.devin/` | **OK**: chequeo automatizado de los `](ruta)` internos sin enlaces rotos (los dos hits residuales son el literal `](ruta)` del propio checklist). |
| Regeneración de SVG | `overview.svg`, `modulos.svg` y `servicios-externos.svg` regenerados con `mmdc` tras editar sus bloques mermaid. |

### Estado funcional verificado por módulo

"Verificado" significa que existen las piezas de código y tests indicados, que los checks locales pasaron y que el CI de `origin/main` (`b6f182a`, run `40579566454`) está verde con los shards E2E incluidos.

| Módulo | Estado | Evidencia en código y tests |
| --- | --- | --- |
| Pedidos públicos | **implementado-verificado** | `/pedido` rediseñado, catálogo, `/api/public/pedido`, `orderService`/`orderRepository`; tests unitarios + specs `tests/e2e/pedido*.spec.ts`. |
| Pin de entrega (`delivery`) | **implementado-verificado y deployado** | `orders.deliveryLocation` (`0043` aplicada en prod), `orderSchema` lo exige en `delivery`, captura GPS/enlace en checkout, mensaje automático al chat en la misma transacción, "Ubicación de entrega" en `PedidoInfo`. CI+E2E verde (`40579566454`). |
| Chat de pedidos | **implementado-verificado** | Bienvenida en dos mensajes (+ pin en `delivery`), badge de leídos en vivo, adjuntos imagen/**PDF** con validación temprana, SSE opt-in; `chatService`/`orderMessageRepository`; tests unitarios + specs E2E. |
| Ventas | **implementado-verificado** | `/ventas` con tema claro híbrido, refresco en vivo del catálogo, quick-add, card clickeable; `saleService`/`saleRepository`; tests unitarios + E2E. |
| Caja y turnos | **implementado-verificado** | `/cierre` simplificado (sin cards de insumos; columna `suppliesSummary` conservada), `cashRegisterService`; tests unitarios + E2E. |
| Cierre diario | **implementado-verificado**, integrado al cierre de caja | `closeCashRegister`, `/api/caja/cerrar`, `/ventas/historial/[id]`; specs `cierres-diarios.spec.ts`. |
| Stock | **implementado-verificado** | `/stock`, `stockService`, ajustes con `performed_by`; tests unitarios + E2E de concurrencia. |
| Productos, recetas y promos | **implementado-verificado** | Editor de promos con flags derivados del tipo de insumo, validaciones por fila, imágenes normalizadas 16:9, tope de opcionales y unicidad de nombre por sucursal; tests unitarios + E2E. |
| Sucursales | **implementado-verificado** | `/sucursales` con `is_active` (activar/desactivar sin borrado en superficie pública), hard delete en cascada mantenido por decisión; tests unitarios + E2E. |
| Usuarios y roles | **implementado-verificado** | `/usuarios`, `userService`, auth JWT; `roles-y-sucursales.spec.ts`. |
| Videos y Google Cast | **implementado-verificado** | `/videos*`, upload/stream, `videoService`; specs `videos.spec.ts`. Sin Chromecast físico probado. |
| Kiosk `/pantalla` + `/menu` | **implementado-verificado** | `(kiosk)` sin login: pantalla publicitaria por sucursal (`pantalla_settings`/`pantalla_items`, modos `auto`/`custom`) y menú digital (`menu_settings`), configurables desde `/pantalla-config` («Pantallas»); APIs `/api/public/pantalla` y `/api/public/menu`. |
| Reportes | **implementado-verificado** | `/reportes` + `GET /api/reportes/ventas` (ventas por rango, exportación CSV); `reportService`. |
| Consumo Neon (card) | **implementado-verificado** | Card "Base de datos" admin vía `GET /api/panel/neon-usage` + `neonUsageService`; degrada `disabled`/`invalid_credentials`. |
| Observabilidad operativa | **implementado-verificado** | `sanity-audit` diario (GH Actions), `uptime-probe` `*/30`, worker CF `pancheria-healthcheck` `*/10`, relay ntfy `/api/cron/alert`; `/api/health` `SELECT 1`. |

### Deuda consolidada re-verificada

| Ítem | Severidad | Estado real al cierre | Evidencia |
| --- | --- | --- | --- |
| T14 multi-tenant | **mayor** si el objetivo pasa a SaaS; diferido por decisión | **Sigue abierto y no iniciado.** No existe `tenantId`/`tenant_id` en `src/`; el sistema sigue siendo single-tenant con sucursales por `branchId`. | `.devin/prompts/plan-implementacion-multi-tenant.md`; `src/db/schema.ts`. |
| Commits `1603df3`/`2e6504d` sin push + E2E pendiente | **menor** | **Cerrado 2026-10-27.** Push hecho, CI `40579566454` success con shards E2E verdes, migración `0043` aplicada en prod y deploy `dpl_BYCm3NfPRFXXgakm7J8SnPbv1ZPZ` Ready. Los informes `auditoria-ux-chat-pedido-2026-10-27` y `auditoria-ubicacion-delivery-2026-10-27` (y sus prompts) quedaron archivados. | `git log origin/main`; `informes/archivados/`; `prompts/archivados/`. |
| Endpoint atómico producto+receta (P2) | **menor** | **Abierto (diferido).** Guardar producto y receta son dos requests; el mensaje de fallo parcial mitiga la ventana. Heredado del informe archivado de recetas/carrito. | `archivados/auditoria-recetas-carrito-2026-10-15.md`. |
| Ticket sucursal nueva (lanzamiento operativo) | **menor** | **Abierto.** `auditoria-nueva-sucursal-stock-2026-10-04`: PR-1/2/6/7/8 implementados; el servicio "Paquete" quedó **descartado por D-5** (no figura en el menú real — reincorporar solo si el dueño lo confirma, §9.3). Lo pendiente es la operación de lanzamiento de la sucursal según `runbook-nueva-sucursal.md`. | `informes/auditoria-nueva-sucursal-stock-2026-10-04.md`; `informes/runbook-nueva-sucursal.md`. |
| Flakiness E2E / sharding | **menor** | Estable: CI verde incluido el pipeline nocturno; `E2E_SHARDS=[1,2]` **activo** con bases `neondb_e2e`/`neondb_e2e2` en `us-east-1` y lock `e2e_run_lock` serializando corridas externas. | `.github/workflows/ci.yml`; `tests/e2e/run-lock.ts`. |
| `/_not-found` estática sin nonce CSP | **menor** | **Sigue abierto como limitación conocida** (render `○` estático). | `src/app/not-found.tsx`. |
| Limpieza de archivos post-borrado de sucursal | **menor** | Sin cambios: `deleteBranch` libera archivos post-commit best-effort; los crons limpian huérfanos. | `branchService.ts`, `cleanupService.ts`. |
| Cadencia real de schedules GH Actions | **informativo** | `expire-orders` declara `*/15` (era `*/5` hasta `621c66f`) y corre ~4–8 veces/día en la práctica; `uptime-probe` `*/30`. La expiración lazy + el worker CF `*/10` cubren la corrección operativa. | `expire-orders.yml`, `uptime-probe.yml`, `wrangler.toml`; `arquitectura/servicios-externos.md`. |
| Verificación del blueprint DRS en Devin Cloud | **informativo / condicional** | **Sigue sin verificar** (`.devin/environment.yaml` existe y fue resincronizado en esta corrida, pero no se corrió un build remoto). | `.devin/environment.yaml`; `archivados/plan-de-accion-2026-08-27.md` §2. |

### Prompts, TODOs y pendientes en archivados

- `.devin/prompts/README.md` enumera **7 prompts activos**: `pancheria.prompt.md` (maestro), 5 guías reutilizables (`auditoria-pre-release`, `auditoria-escalabilidad`, `auditoria-cobertura-de-pruebas`, `auditoria-qa-integral`, `auditoria-y-documentacion`) y `plan-implementacion-multi-tenant` (T14 sin implementar).
- En esta corrida se archivaron los prompts `simplificacion-cierre` (`7a94e6d`), `implementacion-card-clickeable` (`09665ad`), `auditoria-ux-chat-pedido` (`3ce3e17`/`1603df3`) y `ubicacion-delivery-requerida` (`1603df3`/`2e6504d`), y los informes `auditoria-ci-2026-10-05`, `plan-sucursal-activa-2026-10-05`, `auditoria-recetas-carrito-2026-10-15` (su pendiente P2 queda trackeado arriba), `auditoria-ux-chat-pedido-2026-10-27` y `auditoria-ubicacion-delivery-2026-10-27` (estos dos tras push + migración `0043` + E2E verde + deploy Ready).
- Los snapshots bajo `archivados/historico/` conservan tareas antiguas por regla documental; no se reabren.

### Sincronización documental (sesión 2026-10-27)

- Corrección de crons desfasados en 9 documentos: `expire-orders` `*/5`→`*/15`, `uptime-probe`→`*/30`, worker healthcheck→`*/10` (nómina completa de 5 endpoints de cron incluida en `servicios-externos.md` con `sanity-audit` y el relay ntfy).
- `AGENTS.md`: deploy `drizzle-kit push` → `migrate` (con baseline script como excepción), chat con pin de entrega + PDF, ruta correcta del MCP maps (`mcp_config.json`).
- `CONTEXTO.md` regenerado al HEAD: 21 tablas / 12 enums, kiosk `/pantalla`+`/menu`, pin de entrega, lock E2E.
- `arquitectura/`: `modulos.md` (conteos 19 servicios/15 repos, `/menu`, `neonUsageService`), `stack.md` (versiones actuales de `package.json`), `README.md`/`overview.md` (cron + kiosk), `servicios-externos.md` (+uptime-probe, sanity-audit, worker CF, ntfy, Neon API); 3 SVG regenerados.
- `README.md`: card Neon, pin de entrega, chat PDF, `NEON_*` y cron `*/15`. `environment.yaml`: `migrate` como flujo, tablas E2E completas, `NEON_*`.
- `informes/README.md` + índices de `.devin` y `prompts` sincronizados tras los 9 archivados (5 en la sesión documental + 4 tras el push/CI/deploy).

### Riesgos y recomendaciones priorizadas

| Prioridad | Impacto × esfuerzo | Recomendación accionable |
| --- | --- | --- |
| P1 | Alto × bajo, condicional | Mantener producción single-tenant/multi-sucursal; no iniciar T14 sin decisión explícita + plan de aislamiento/backfill/rollback. |
| ~~P1~~ | ~~Medio × bajo~~ | ~~Push + migración `0043` + E2E~~ — **resuelto 2026-10-27**: `b6f182a` en prod con CI/E2E verde y `0043` aplicada. |
| P2 | Medio × bajo | Operación de lanzamiento de la sucursal nueva según `runbook-nueva-sucursal.md` (decisión "Paquete": descartado por D-5). |
| P2 | Medio × medio | Evaluar el endpoint atómico producto+receta (P2) la próxima vez que se toque el editor de promos. |
| P3 | Bajo × bajo | Revisar periódicamente consumo Neon/Vercel (la card del dashboard facilita el chequeo) y confirmar si Devin Cloud/DRS sigue en uso. |

### Próximos pasos concretos

1. ~~Push de `1603df3`+`2e6504d` → CI → deploy con `drizzle-kit migrate` (`0043`)~~ — **hecho**: `b6f182a` deployado Ready, `0043` aplicada y verificada, CI `40579566454` success con E2E verde; los dos informes `2026-10-27` y sus prompts archivados.
2. ~~Corrida E2E pendiente de los informes `2026-10-27`~~ — **cubierta**: los shards E2E 1+2 del CI corrieron verdes sobre los commits pusheados.
3. ~~Definir el servicio "Paquete"~~ — **descartado por D-5** (no figura en el menú real); el ticket queda abierto solo por el lanzamiento operativo de la sucursal (`runbook-nueva-sucursal.md`).
4. Próximo ciclo de higiene documental con el prompt `auditoria-y-documentacion.md` (su "Punto de partida" ya quedó actualizado a esta corrida).
5. Verificación DRS/Devin Cloud: bloqueada por `devin.exe auth login` (credenciales de Devin Cloud no cargadas en esta máquina).

### Limitaciones y aspectos no verificados

- El pin de entrega y el chat con PDF quedaron verificados por los shards E2E de CI sobre `b6f182a` y deployados; no se crearon pedidos ni ventas reales a mano en producción.
- No se inspeccionaron ni mostraron valores de `.env.local`, GitHub Secrets/Variables o Vercel.
- No se corrió E2E ni se tocaron bases de datos; `npx drizzle-kit check` fue la única operación sobre Drizzle (read-only).
- No se validó el blueprint de Devin Cloud ni Google Cast con dispositivo físico.
- El comentario de cabecera de `workers/healthcheck/wrangler.toml` ("corre cada minuto") quedó desfasado respecto del trigger real `*/10`; es archivo de config, fuera del alcance documental de esta corrida.

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
