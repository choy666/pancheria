# Prompt: Enlace a `/pantalla` en la navbar + endurecimiento multi-sucursal — Proyecto Panchería

## Rol

Actuá como ingeniero senior full-stack (Next.js/App Router + TypeScript). Tu tarea tiene dos frentes: (A) agregar el enlace a la pantalla publicitaria `/pantalla` desde la navbar del panel, fijado a la sucursal activa del selector; y (B) verificar y endurecer `/pantalla` para que varias sucursales puedan operar pantallas simultáneas (una TV por local), cada una pineada a su `branchId`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión multi-sucursal (stock, ventas, recetas, caja, catálogo público de pedidos, chat, imágenes de productos, gestión de videos).

Stack: Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5, Jest, Playwright, Vercel.

Arquitectura por capas: `src/app/` (rutas `(auth)`, `(panel)`, `(public)`, `(kiosk)`, `api/`), `src/application/` (servicios), `src/repositories/`, `src/db/`, `src/domain/`, `src/components/`, `src/lib/`, `src/config/` (getters de `process.env` — nada de env leído suelto).

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> (sección «Pantalla publicitaria (`/pantalla`)» y tabla de comandos)
- <ref_file file="C:/developer/paginas/pancheria/.env.example" /> (bloque `NEXT_PUBLIC_PANTALLA_*`, líneas ~193-206)
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />

### Estado actual de `/pantalla` (ya auditado — no re-descubrir)

- Ruta pública del route group `(kiosk)` (`src/app/(kiosk)/pantalla/page.tsx`; el layout es del grupo, `src/app/(kiosk)/layout.tsx`), sin chrome del panel ni de `(public)`. `dynamic = 'force-dynamic'`, `Suspense` + skeleton, error → `PantallaError` con reintento.
- `?branchId=` opcional: si falta, resuelve la **sucursal por defecto** (`getDefaultBranchId`, basada en `DEFAULT_BRANCH_NAME`) y redirige a la URL canónica `?branchId=N`; si es inválido, redirige a `/pantalla` (doble redirect). **No** lee la cookie `activeBranchId` del panel.
- Snapshot único (`src/lib/pantalla-snapshot.ts`, `buildPantallaSnapshot`) compartido por SSR y `GET /api/public/pantalla` (`src/app/api/public/pantalla/route.ts`): catálogo con disponibilidad + videos activos + caja abierta + horarios, todo por `branchId`. Sucursal inexistente/inactiva: en el SSR `listPublicCatalogWithAvailability` lanza `NotFoundError` → `PantallaError`; en `GET /api/public/pantalla` `resolvePublicBranchId` devuelve `null` → **400** (el docstring del route dice "misma respuesta 404" — impreciso, el snapshot ni se alcanza).
- Playlist (`src/lib/pantalla-playlist.ts`): intercala video/producto, filtra `availability <= 0`, ordena productos por agrupamiento público (`compound` primero), recorta a `NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS` (default 15), cierra con escenas `branch` y `qr`. Ciclo mínimo `[branch, qr]`.
- Cliente (`src/components/pantalla/pantalla-client.tsx`): polling con `useVisibilityPolling` cada `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS` (default 120 s, mínimo 10 s) contra `/api/public/pantalla?branchId=<snapshot.branch.id>` — el `branchId` queda fijado al snapshot cargado; refresco silencioso (conserva último snapshot válido). `key={branchId}` en la página remonta el cliente al cambiar de sucursal. Videos con watchdog `NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS`.
- QR (`pantalla-qr-scene.tsx`): `react-qr-code` → `/pedido?branchId=N` sobre `NEXT_PUBLIC_APP_URL` o `window.location.origin` (lee `process.env` directo — desviación existente de la convención `src/config/*`; no replicar ese patrón en código nuevo).
- Navbar del panel (`src/components/panel/panel-header.tsx`): recibe `activeBranchId` ya resuelto en `src/app/(panel)/layout.tsx` (cookie `activeBranchId` para admin vía `setActiveBranchAction` + `window.location.reload()`; `session.user.branchId` fijo para operator). Arrays `operatorNavItems`/`adminNavItems` son constantes de módulo `{ href, label }`. **Hoy no hay enlace a `/pantalla` en ninguna UI.**
- Selector (`branch-selector.tsx`) permite elegir sucursales inactivas (marca "(inactiva)"); `listBranchesForRequest` devuelve `Branch[]` completo incluyendo `isActive`, aunque la interfaz local `Branch` del header solo declara `id`/`name`.
- Cobertura existente: `tests/e2e/pantalla.spec.ts`, `src/app/(kiosk)/pantalla/page.test.tsx`, `src/app/api/public/pantalla/route.test.ts`, `src/lib/pantalla-playlist.test.ts`, `src/lib/pantalla-snapshot.test.ts`, `src/config/pantalla.test.ts`, `src/lib/route-guard.test.ts`.

## Reglas innegociables

1. Todo en español (código, comentarios, commits, informe). Sin datos hardcodeados: URLs, tiempos y parámetros solo desde `src/config/*` o variables de entorno, siguiendo la convención del proyecto.
2. `/pantalla` **sigue siendo pública y sin sesión** (`route-guard.ts` no cambia). Una pestaña de pantalla ya abierta **no** debe saltar de sucursal cuando otro usuario cambia la cookie del panel: la TV queda pineada al `branchId` de su URL. No implementar "seguir la cookie" en la pantalla — es por diseño.
3. El enlace de la navbar debe construirse con `routes.pantalla` + `?branchId=` del `activeBranchId` vigente — **nunca** `/pantalla` pelado (eso resuelve la sucursal *por defecto*, no la *seleccionada*).
4. Si se toca `src/db/schema.ts`, generar migración con `npx drizzle-kit generate` y commitearla en `drizzle/` (ver reglas de AGENTS.md).
5. Verificación antes de entregar: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip` y los specs E2E afectados. Consultar `checklist-pre-push.md`.
6. No exponer `.env*` ni credenciales. Commits con el trailer del proyecto (`Co-Authored-By: Devin …`).

## Objetivo

### A) Enlace en la navbar

- Agregar acceso a `/pantalla?branchId={activeBranchId}` visible para **admin y operador** (el operador tiene sucursal fija; el enlace igual apunta bien).
- Abrir en **pestaña nueva** (`target="_blank"` + `rel="noopener"`): la pantalla es una vista kiosk fullscreen; navegar en la misma pestaña hace perder el contexto del panel.
- Ubicación sugerida (decidir y justificar): ícono `MonitorPlay`/`Tv` de `lucide-react` en el cluster derecho de la navbar junto al `BranchSelector`, con `aria-label`/`title` descriptivo, replicado en el menú mobile (`lg:hidden`; decidir si además cierra el menú con `setOpen(false)`). Alternativa aceptable: ítem de nav. El nav de admin ya tiene 12 ítems — evitar saturar. Preferir el ícono **fuera** de `nav[data-testid="main-nav"]`: `paso3.spec.ts` lo localiza con `getByTestId('main-nav')` y `roles-y-sucursales.spec.ts` asserta sus labels con `toContainText`; además `responsive.spec.ts` usa `[data-tour="mobile-nav"] nav` con `getByRole('link', { name })` exacto ('Panel', 'Ventas', 'Productos') — un enlace extra no rompe esos asserts, pero conviene ubicar el ítem mobile **fuera** del `<nav>` interno del menú (p. ej. junto al `TourButton`) por la misma cautela. Agregar un `data-testid` estable al enlace (p. ej. `pantalla-link`) para compartir selector entre tests unitarios y E2E.
- Caso borde: si la sucursal activa está **inactiva**, `/pantalla` muestra `PantallaError`. Elegir una de: (a) renderizar igual — el error ya es claro; (b) ocultar/deshabilitar el enlace marcando por qué. Documentar la decisión en el informe. Ojo: `isActive` viaja en `branches` **solo para admin** — el layout pasa `branches: undefined` al operador. Extender la interfaz local `Branch` del header alcanza solo para admin; si se elige (b), para el operador hace falta una prop extra (p. ej. `activeBranchIsActive`): el layout ya fetchea `getBranchById(currentBranchId)` para ambos roles. Otro borde a cubrir en el test: `activeBranchId` es prop opcional (`?: number`); el layout siempre la pasa, pero si llegara `undefined` **no** renderizar el enlace (nunca `/pantalla` pelado — regla 3).

### B) Endurecimiento multi-sucursal simultáneo

Verificar (y corregir solo si el chequeo falla) que N pantallas con distinto `branchId` funcionan a la vez sin contaminarse:

1. **Aislamiento de datos**: confirmar en código que `buildPantallaSnapshot` no mezcla sucursales (catálogo, videos, caja y horarios ya van por `branchId`) y que las claves de `unstable_cache` incluyen `branchId` donde corresponda (`src/lib/server-cache.ts` — p. ej. `cachedPublicCatalogBase`).
2. **Costo de polling**: cada TV pollea cada `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS`; con K TVs son K requests/intervalo. `GET /api/public/pantalla` ya responde con `buildCdnCacheControlHeaders(getPublicCatalogCacheSMaxage(), getPublicCatalogCacheSwr())`. **Discrepancia doc↔código a reconciliar**: AGENTS.md (línea ~107) dice que se aplican `PUBLIC_BRANCH_STATUS_CACHE_*` a este endpoint; los defaults coinciden (10/30) pero el doc miente sobre qué variable tunea la pantalla. Decidir: corregir AGENTS.md o cambiar el endpoint a los getters de branch-status. Corregir también el docstring de `route.ts`: dice "misma respuesta 404 que el catálogo público" pero `resolvePublicBranchId` → `null` devuelve **400** antes de alcanzar el snapshot. Documentar además en AGENTS.md el piso de intervalo recomendado cuando hay varias pantallas (hoy el mínimo configurable es 10 s).
3. **Timezone por sucursal (decisión, no implementar sin aprobación)**: el reloj y los horarios usan `NEXT_PUBLIC_BRANCH_TIMEZONE` global — sucursales en husos distintos mostrarían hora incorrecta. Si el negocio opera en un solo huso, documentarlo como limitación conocida en AGENTS.md. Si se requiere por sucursal, proponer (sin implementar aún) columna `branches.timezone` con fallback a la env global.
4. **Descubribilidad de la URL por sucursal** (mejora opcional, proponer antes de implementar): un "copiar URL de pantalla" en `/sucursales` o `/videos` para fijar la TV de cada local sin escribir la querystring a mano.
5. **Semántica documentada**: dejar explícito en el comentario del componente y en AGENTS.md que la pantalla sigue al `branchId` de su URL (no a la cookie), y que el enlace del panel siempre refleja la sucursal seleccionada *al momento del click*.

### C) Pruebas

- Unitarias: crear `src/components/panel/panel-header.test.tsx` (no existe hoy; precedente en el mismo directorio: `dashboard-client.test.tsx`). Cubrir que el header compone el href con `activeBranchId` (render del enlace/ícono con el branchId correcto, para admin y operador; caso de sucursal inactiva según la decisión tomada en A; y que con `activeBranchId === undefined` no se renderiza el enlace). El header importa `TourButton` (usa el contexto de `@/components/tour/tour-context`) y `BranchSelector` (Radix `Select`): el test necesitará mockearlos o proveer el contexto — ver cómo `dashboard-client.test.tsx` resuelve sus dependencias.
- E2E en `tests/e2e/pantalla.spec.ts` (o spec nuevo si corresponde): con login admin y segunda sucursal (`getTestSecondBranch` — internamente `setupSecondBranchForE2E` crea la fixture si falta; **no existe** un helper `createBranch`; para una sucursal ad-hoc usar `db.insert(branches)` como el test 'una sucursal sin catálogo rota solo sucursal y QR'), (a) el enlace de la navbar apunta a `?branchId=<activa>` y tras cambiar el selector apunta a la nueva; (b) dos páginas con `branchId` distintos muestran nombre de sucursal y QR distintos (`pantalla-qr-url` contiene su propio `branchId`; `/pantalla` es pública, bastan dos `page` del mismo contexto). Para cambiar la sucursal activa en E2E: click en `branch-selector-trigger` → click en `branch-option` con el nombre de la sucursal (el `Select` de Radix abre un portal fuera del header). Ojo: `setActiveBranchAction` dispara `window.location.reload()` — esperar el reload (p. ej. `page.waitForLoadState()` o esperar a que el `href` del enlace cambie) antes de assertar; la cookie `activeBranchId` vive en el contexto del test y se descarta sola.
- Limpieza: la segunda sucursal de `getTestSecondBranch` es **fixture compartida** (cacheada en `secondBranchSetupPromise`/`E2E_SECOND_BRANCH_ID`) — **no** borrarla en `finally` ni modificarla (la usan otros specs). La regla del proyecto aplica a datos ad-hoc creados por el propio test (`db.insert` propios, productos, videos).
- Respetar las convenciones de `lecciones-aprendidas.md`: `data-testid` sobre selectores frágiles, `waitForHydratedInput` si hay inputs, nada de inserts bulk sin limpieza.

## Etapas

1. **Lectura y plan**: confirmar el estado descrito arriba, definir ubicación del enlace y decisión del caso "sucursal inactiva"; escribir plan breve y **esperar aprobación** antes de tocar código.
2. **Implementación**: navbar + endurecimientos aprobados + tests + docs (AGENTS.md, `.env.example` solo si se agregan variables).
3. **Verificación e informe**: comandos de la regla 5 con resultados, lista de archivos tocados, decisiones tomadas y qué quedó fuera de alcance (timezone por sucursal, si no se aprobó).

## Entregable

Informe en `.devin/informes/pantalla-navbar-multi-sucursal-YYYY-MM-DD.md` con: resumen, diff de decisiones, evidencia de tests/verificación y limitaciones restantes.
