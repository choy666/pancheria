# Enlace a `/pantalla` en la navbar + endurecimiento multi-sucursal

Fecha: 2026-10-18. Disparador: `.devin/prompts/pantalla-navbar-multi-sucursal.md`
— (A) acceso a la pantalla publicitaria desde el panel pineado a la sucursal
activa, y (B) verificación de que N TVs con `branchId` distintos operan a la
vez sin contaminarse.

## Resumen

- El header del panel gana un ícono `MonitorPlay` que abre
  `/pantalla?branchId={activa}` en pestaña nueva, para admin y operador.
- Cada fila de `/sucursales` gana el mismo acceso pineado a su propio
  `branchId` — la forma de fijar la TV de cada local sin escribir la
  querystring a mano.
- El aislamiento multi-sucursal ya era correcto en código (snapshot y claves
  de `unstable_cache` por `branchId`); no hizo falta tocarlo. Lo que fallaba
  era la documentación (variable de caché atribuida al endpoint equivocado,
  docstring con el status incorrecto) y un flake E2E latente.

## Decisiones (consultadas y aprobadas)

| Tema | Decisión |
| ---- | -------- |
| Ubicación del enlace | Ícono junto al `BranchSelector` (desktop) y dentro del bloque inferior del menú mobile, **fuera** de ambos `<nav>` — `paso3`/`roles-y-sucursales`/`responsive` assertan sus ítems |
| Sucursal activa inactiva | Acceso **deshabilitado con aviso** (`span` con `aria-disabled` + `title` explicativo), no un link que abre una pestaña rota. La prop `activeBranchIsActive` la deriva el layout del `getBranchById` que ya hacía para ambos roles |
| Cache-Control de `/api/public/pantalla` | Se corrigió **AGENTS.md** (y `.env.example`): el endpoint usa `PUBLIC_CATALOG_CACHE_S_MAXAGE`/`SWR`, no `PUBLIC_BRANCH_STATUS_CACHE_*`. Defaults idénticos (10/30): sin cambio de comportamiento |
| Descubribilidad de URL por sucursal | Incluida: botón por fila en `/sucursales` |
| Timezone por sucursal | Documentada como **limitación conocida** (huso único `NEXT_PUBLIC_BRANCH_TIMEZONE`); sin columna `branches.timezone` |

## Cambios aplicados

### A) Navbar (`src/components/panel/panel-header.tsx`, `(panel)/layout.tsx`)

- Enlace `/pantalla?branchId={activeBranchId}` con `target="_blank"` +
  `rel="noopener"`, `data-testid="pantalla-link"` (desktop) y
  `"pantalla-link-mobile"` (mobile, dentro del bloque inferior — fuera del
  `<nav>` interno — y cierra el menú con `setOpen(false)`).
- Nunca emite `/pantalla` pelado: sin `activeBranchId` no se renderiza
  (esa ruta resuelve la sucursal *por defecto*, no la *seleccionada*).
- `aria-label`/`title` con el nombre de la sucursal (`branches[].name` del
  admin o `branchName` del operador).
- El comentario del componente documenta la semántica: la pestaña sigue el
  `branchId` de su URL, no la cookie del panel.

### A+) `/sucursales` (`src/components/sucursales/branch-list.tsx`)

- Ícono `MonitorPlay` por fila en la celda de acciones:
  `branch-pantalla-link-{id}` para activas, `branch-pantalla-disabled-{id}`
  con `aria-disabled` + aviso para inactivas.

### B) Endurecimiento verificado (sin cambios de código)

- **Aislamiento**: `buildPantallaSnapshot` filtra catálogo, videos, caja y
  horarios por `branchId`; las claves de `unstable_cache` incluyen los args
  (`cachedPublicCatalogBase(branchId,…)`, `cachedBranchById(id)`). El cliente
  pollea `?branchId=<snapshot.branch.id>` fijado al snapshot cargado.
- **Docs corregidas**: `AGENTS.md` línea de `PUBLIC_BRANCH_STATUS_CACHE_*`
  ya no atribuye ese header a `/api/public/pantalla`; el docstring de
  `route.ts` ahora describe el 400 real (`resolvePublicBranchId → null` o
  Zod), no "misma respuesta 404".
- **Docs nuevas en `AGENTS.md`** (sección `/pantalla`): semántica pin-a-URL,
  accesos desde el panel y `/sucursales`, piso recomendado de
  `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS` con K TVs (K requests/intervalo;
  no bajar del default 120 s — el mínimo configurable 10 s factura duración
  de función en serverless) y la limitación de timezone único.

### C) Tests

- **`src/components/panel/panel-header.test.tsx`** (nuevo, 5 casos): href con
  el `branchId` correcto para admin y operador, `target`/`rel`, ausencia del
  enlace con `activeBranchId === undefined`, deshabilitado con aviso ante
  sucursal inactiva, y el link mobile que cierra el menú.
- **`tests/e2e/pantalla.spec.ts`** — nuevo describe
  "Acceso desde el panel y multi-sucursal": (a) el enlace de la navbar
  apunta a la sucursal activa y sigue al `BranchSelector` tras el reload;
  (b) dos `page` públicas con `branchId` distintos (sucursales ad-hoc,
  limpiadas en `finally`) muestran nombre y QR propios, sin mezcla.

### Fix de flake E2E preexistente (descubierto en la verificación)

El test 'un video con stream local se salta sin sesión…' fallaba de forma
reproducible **también en HEAD** (verificado con `git stash`): en
headless-shell el `<video>` cuyo stream responde 401 no siempre dispara
`error`, y el único respaldo es el watchdog `NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS`
(default 120 s — fuera del alcance del timeout). Además, con el catálogo del
seed la segunda aparición de la escena queda a ~2 min.

- `tests/e2e/pantalla.spec.ts`: el test ahora usa una sucursal ad-hoc vacía
  (ciclo `[video, sucursal, qr]` — la escena reaparece cada vuelta si el
  primer poll la pierde) y timeouts de 45 s.
- `NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS=8000` en `.env.e2e`, `.env.e2e.example`
  y el `env:` del job `e2e` de `.github/workflows/ci.yml` (paridad
  example↔CI según el checklist).
- `.env.e2e` local también recibió las duraciones `NEXT_PUBLIC_PANTALLA_*`
  del example que le faltaban (`PRODUCTO_MS`, `SUCURSAL_MS`, `QR_MS`,
  `MAX_PRODUCTOS`) — estaba desactualizado respecto del example.

## Verificación

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | OK (1 warning preexistente ajeno: `sign-out-client.tsx` `window.location.assign`) |
| `npx tsc --noEmit` | OK |
| `npm test` | 194 suites / 2232 tests OK |
| `npm run build` | OK |
| `npm run knip` | OK |
| `npx playwright test tests/e2e/pantalla.spec.ts` | **9/9** (2.2 min) |
| `paso3` + `roles-y-sucursales` + `responsive` | **27/27** (5.8 min) — sin roturas en los asserts de `main-nav`/mobile-nav |

## Archivos tocados

- `src/components/panel/panel-header.tsx` — enlace + prop `activeBranchIsActive`
- `src/app/(panel)/layout.tsx` — pasa `branch?.isActive`
- `src/components/sucursales/branch-list.tsx` — acceso por fila
- `src/app/api/public/pantalla/route.ts` — docstring (400, no 404)
- `src/components/panel/panel-header.test.tsx` — **nuevo**
- `tests/e2e/pantalla.spec.ts` — describe nuevo + fix flake del video
- `AGENTS.md`, `.env.example`, `.env.e2e`, `.env.e2e.example`,
  `.github/workflows/ci.yml` — docs y envs

## Fuera de alcance / limitaciones restantes

- **Timezone por sucursal**: reloj y horarios con `NEXT_PUBLIC_BRANCH_TIMEZONE`
  global; sucursales en otro huso mostrarían hora incorrecta. Documentado en
  `AGENTS.md`; si hace falta, la propuesta sería columna `branches.timezone`
  con fallback a la env (requiere migración).
- **Pantalla y videos con `STORAGE_PROVIDER=local`**: limitación ya conocida
  (stream exige sesión admin), sin cambios.
- Nota de repo: la feature `/pantalla` completa estaba **sin commitear** en
  el working tree al iniciar esta tarea (directorios `(kiosk)`,
  `components/pantalla`, `lib/pantalla-*`, el spec y sus configs como
  untracked/modified). Este trabajo se suma a ese diff; no se commiteó nada.
