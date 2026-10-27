# Prompt: Auditoría, actualización, limpieza y archivado de la documentación

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos con reproducción y Cast.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria (leer antes de auditar):

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/CONTEXTO.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" /> (scripts declarados vs. comandos documentados)
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/README.md" /> (índice general)
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" /> (reglas de escritura de prompts)
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/README.md" /> (**regla de vida del documento** — fuente de verdad para archivar)
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/arquitectura/README.md" /> (mantenimiento del mapa + regeneración de `.svg`)

## Objetivo

Ejecutar el ciclo completo de higiene documental sobre **toda** la documentación del proyecto, en cuatro operaciones ordenadas:

1. **Auditar** — verificar que cada documento coincide con el código real; cada afirmación con evidencia (`archivo:línea` o `<ref_file .../>`).
2. **Actualizar** — corregir lo desfasado con cambios documentales mínimos respaldados por evidencia.
3. **Limpiar** — quitar contenido muerto, duplicado o superado dentro de los documentos vivos; reparar enlaces Markdown rotos.
4. **Archivar** — mover lo resuelto a `archivados/`/`historico/` según la regla de vida y dejar los tres índices sincronizados.

## Superficie documental a auditar

| Documento / directorio | Qué se verifica | Fuente de verdad |
| --- | --- | --- |
| `AGENTS.md` | Comandos vs. scripts de `package.json`; variables de entorno vs. `.env.example`; convenciones y troubleshooting vigentes; secciones MCP (Context7, Google Maps, Graphify) vs. `.devin/mcp_config.json` y `.devin/config.json` | `package.json`, `src/config/*`, `.env.example` |
| `README.md` | Setup, comandos y features públicas/del panel descriptas (ej. pin de entrega obligatorio en `delivery`) | `src/app/`, flujos reales |
| `CONTEXTO.md` | Fecha + commit del encabezado vs. `HEAD`; tablas/enums/flujos de §4-5 vs. `schema.ts`; §10 de archivos canónicos al día | `src/db/schema.ts`, `src/app/` |
| `.env.example` | Toda variable `process.env.*` consumida por el código documentada con default y propósito; sin variables fantasmas | grep `process.env` en `src/`, `src/config/*` |
| `.devin/environment.yaml` | Blueprint: versiones, comandos y `knowledge:` al día con el estado real | `package.json`, `AGENTS.md` |
| `.devin/prompts/*.md` | Los activos son realmente pendientes; los prompts resueltos → `archivados/` con resumen de resolución + commit | `git log`, informes asociados |
| `.devin/informes/*.md` (raíz) | Tickets abiertos reales; marcador `**Estado:**` presente; informes con trabajo mergeado → `archivados/` | `git log`, `gh pr list` |
| `.devin/informes/reporte-estado.md` | §0 refleja `main`/CI/producción actuales; único vigente (sin `reporte-estado-*.md` duplicados en raíz) | `git log`, `gh run list`, MCP Vercel |
| `.devin/informes/arquitectura/` | Mapa vivo vs. código (schema, API, crons, workflows, stack); `.svg` regenerados tras editar bloques `mermaid` | `schema.ts`, `src/app/api/**`, `vercel.json`, `.github/workflows/`, `package.json` |
| `.devin/informes/archivados/` | Solo material implementado por completo con valor de guía; `historico/` = snapshots (no se edita) | Regla de vida (sección siguiente) |
| `.devin/skills/`, `.devin/config.json`, `.devin/mcp_config.json` | Vigentes y consistentes con dependencias y docs | `package.json`, `AGENTS.md` |
| Índices (`.devin/README.md`, `prompts/README.md`, `informes/README.md`) | Todo archivo activo en `prompts/` e `informes/` raíz figura en su índice; todo archivado figura en la lista de archivados | Listado real de archivos |

## Punto de partida de la próxima corrida

Corrida 2026-10-27 completada contra `main` en `2e6504d` (working tree con los cambios documentales de esta sesión, sin commitear). La documentación viva quedó sincronizada con el código. Puntos ya verificados y pendientes heredados para la próxima corrida — confirmar cada ítem y extender, no re-derivar desde cero.

**Resuelto en esta corrida (no volver a auditar salvo nueva evidencia):**

- Crons resincronizados en 9 documentos: `expire-orders` `*/15` (era `*/5` hasta `621c66f`), `uptime-probe` `*/30`, `sanity-audit` diario `0 9`, worker CF `*/10`. Nómina completa de 5 endpoints `/api/cron/*` documentada en `arquitectura/servicios-externos.md` (incluye relay ntfy y Neon API).
- Conteos reales: **21 tablas / 12 enums** en `schema.ts`, **19 servicios** de dominio (+2 transversales), **15 repositorios**, **60 `route.ts`**, **50 specs E2E**, **~21 features + `ui/`** en `src/components`.
- Deploy documental: `drizzle-kit migrate` es el flujo recomendado en `AGENTS.md`, `environment.yaml`, `lecciones-aprendidas.md` y `arquitectura/`; `push` queda como excepción con `scripts/drizzle-baseline.ts` posterior.
- Pin de entrega obligatorio (`orders.deliveryLocation`, migración `0043`) documentado en `AGENTS.md`, `README.md`, `CONTEXTO.md`, `environment.yaml`, `flujo-pedidos.md` y `base-de-datos.md`.
- Archivados ejecutados (confirmación única del usuario): prompts `simplificacion-cierre.md` (`7a94e6d`) e `implementacion-card-clickeable.md` (`09665ad`); informes `auditoria-ci-2026-10-05`, `plan-sucursal-activa-2026-10-05` y `auditoria-recetas-carrito-2026-10-15`. Índices sincronizados.
- `reporte-estado.md` §0 reescrito a esta corrida; el §0 de 2026-10-02 quedó en `archivados/historico/reporte-estado-2026-10-02.md`.
- 3 SVG regenerados con `mmdc` (overview, modulos, servicios-externos).

**Pendientes heredados (vigencia en `reporte-estado.md` §0):**

- ~~`1603df3` + `2e6504d` sin push~~ — **resuelto el mismo 10-27**: push a `b6f182a`, migración `0043` aplicada en prod, CI `40579566454` success (E2E verde), deploy `dpl_BYCm3NfPRFXXgakm7J8SnPbv1ZPZ` Ready; los informes `auditoria-ux-chat-pedido-2026-10-27` y `auditoria-ubicacion-delivery-2026-10-27` y sus prompts ya están archivados.
- `auditoria-nueva-sucursal-stock-2026-10-04` y `analisis-comportamiento-ventas-pedidos-2026-10-06` siguen abiertos (lanzamiento operativo de la sucursal según `runbook-nueva-sucursal.md`; "Paquete" descartado por D-5; el análisis es referencia viva de producción).
- P2 diferido: endpoint atómico producto+receta (ver `archivados/auditoria-recetas-carrito-2026-10-15.md`).
- Comentario de cabecera de `workers/healthcheck/wrangler.toml` corregido el 10-27 (era "corre cada minuto" vs trigger real `*/10`).
- Verificación DRS/Devin Cloud: intentada el 10-27 y **bloqueada por `devin.exe auth login`** (sin credenciales de Devin Cloud en la máquina); requiere que el usuario se loguee.

**Recordatorios para la próxima corrida:**

- `mmdc` funciona vía `npx -y -p @mermaid-js/mermaid-cli` (primera corrida descarga Chromium; ~1–2 min por SVG).
- El chequeo de enlaces `](ruta)` reporta 2 falsos positivos conocidos: el literal `](ruta)` del propio checklist en `reporte-estado.md` y en este archivo.
- Distinguir siempre `main` local de `origin/main` y del deploy de Vercel: esta corrida encontró 2 commits locales sin push ni CI.

## Reglas de vida del documento

Fuente: `.devin/informes/README.md` — respetar literalmente.

1. Todo informe nuevo lleva `**Estado:** abierto | en curso | implementado | archivado` en el encabezado.
2. `archivados/` solo contiene material implementado por completo y con valor de guía futura.
3. `archivados/historico/` = snapshots sin valor de guía (reportes de estado viejos): historia pura, no se edita.
4. Si un informe archivado deja un pendiente, ese pendiente pasa a `reporte-estado.md` §0 — nada se pierde en archivados.
5. Los prompts resueltos se archivan en `prompts/archivados/`; nunca se borran.
6. Un único `reporte-estado.md` vigente; snapshots anteriores → `historico/`.
7. Todo archivo activo en `prompts/` e `informes/` raíz debe aparecer en el README índice correspondiente.
8. **Archivar no es eliminar**: en esta tarea nada se borra salvo contenido claramente muerto dentro de un documento vivo. Los movimientos a `archivados/` se proponen en una lista única y se ejecutan tras **una sola confirmación** del usuario.

## Reglas

1. No modificar archivos de negocio: solo cambios documentales, respaldados por evidencia (`<ref_file .../>` o `archivo:línea`).
2. No hardcodear credenciales, URLs de APIs ni secretos; no exponer `.env.local` ni valores sensibles en prompts, documentos o reportes.
3. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit generate/migrate/push`, `npm run test:e2e` ni `npx playwright test` sin confirmación explícita del usuario y base de datos de prueba.
4. Todo en español: documentos, informe y respuesta.
5. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo**, con referencias concretas.
6. Preferir `<ref_file .../>` o nombres de función sobre `<ref_snippet ... lines="..."/>` salvo que el rango sea estable y esté verificado.
7. No duplicar documentación: si un tema ya está cubierto por un documento vivo, referenciarlo en vez de copiarlo.
8. Si `CONTEXTO.md` se actualiza, refrescar la línea `**Generado:** fecha · **Commit:**` del encabezado.
9. Antes de commitear: consultar `.devin/informes/checklist-pre-push.md` (un diff solo documental se salta CI vía el gate `cambios`, pero el chequeo local sigue siendo obligatorio).

## Metodología

1. **Baseline**: `git status`, `git log --oneline -25`, `git rev-parse HEAD` y fecha — ancla del informe.
2. **Inventario**: listar todo `.md` del scope y el último commit que lo tocó (`git log -1 --format='%h %ci' -- <archivo>`) → tabla `archivo | última actualización | ¿desfasado?`.
3. **Auditoría doc↔código** por documento según la tabla de superficie; registrar cada discrepancia con evidencia.
4. **Actualización y limpieza**: aplicar las correcciones documentales y reparar los enlaces Markdown internos de `.devin/` (convención ya aplicada en corridas anteriores).
5. **Archivado**: proponer la lista completa de movimientos → confirmación única del usuario → mover y actualizar los tres índices (`.devin/README.md`, `prompts/README.md`, `informes/README.md`), agregando en cada entrada archivada un resumen de resolución + commit (formato de las entradas existentes). En `arquitectura/`, regenerar `.svg` solo si se editó un bloque `mermaid` (comando en `arquitectura/README.md`).
6. **Cierre**: actualizar `reporte-estado.md` §0 con la corrida (baseline nuevo, qué se archivó, pendientes heredados) y actualizar la sección "Punto de partida" de este prompt para la próxima corrida.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run knip` | Detección de código muerto |
| `npx drizzle-kit check` | Consistencia del historial de migraciones (solo lectura) |
| `git diff --check` | Whitespace y normalización |
| Chequeo de enlaces `](ruta)` internos en `.devin/` | Sin links rotos tras los movimientos |

Cambios solo documentales → se espera todo en verde; documentar igual el resultado en el informe.

## Entregables

1. **Este prompt actualizado**: la sección "Punto de partida" queda lista para la próxima corrida.
2. **Correcciones documentales** aplicadas a los archivos vivos (`AGENTS.md`, `README.md`, `CONTEXTO.md`, `.env.example`, `environment.yaml`, índices y documentos de `informes/`).
3. **Archivados aplicados** tras confirmación + los tres índices sincronizados (cada archivado con resumen de resolución y commit).
4. **`reporte-estado.md` §0 actualizado**: baseline nuevo, qué se auditó/archivó y pendientes heredados de los informes archivados.
5. **Resumen final** con hallazgos clasificados (crítico/mayor/menor/informativo), archivos movidos y lo que quedó pendiente.
