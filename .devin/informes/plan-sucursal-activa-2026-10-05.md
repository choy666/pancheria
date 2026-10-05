# Auditoría + plan: activar/desactivar sucursal (opción no destructiva)

**Fecha:** 2026-10-05
**Estado:** abierto — plan listo para implementar, sin código escrito

## 1. Motivación

Hoy la única forma de sacar una sucursal del canal público es **eliminarla** desde `/sucursales`, con cascada física total (`branchService.deleteBranch` borra productos, ventas, cajas, movimientos, usuarios, pedidos, chats y videos — irreversible). Se necesita una opción reversible que conserve el historial y permita reabrir.

Caso real que lo dispara: "Sucursal por defecto" (id 1) quedó reemplazada como pública por "Pancheria Popular Av. Los Minerales" (id 3), pero sigue siendo seleccionable en `/pedido?branchId=1` con sus 55 productos activos.

## 2. Auditoría — superficie afectada

### 2.1 Datos

`branches` (`src/db/schema.ts:87`) no tiene flag de activo: toda fila existente se considera activa. No hay `deletedAt` ni `isActive`. El tipo `Branch` (`src/domain/types.ts:69-78`) tampoco lo refleja.

### 2.2 Resolución pública de sucursal (`src/lib/branch-resolver.ts`)

| Función | Hoy | Debe hacer |
|---|---|---|
| `listPublicBranches()` | Lista **todas** las sucursales vía `getCachedBranchList` (tag `branches`). Alimenta el selector público de `/pedido` (`PedidoClient` recibe `branches`) | Filtrar a activas |
| `getDefaultBranchId()` | `getCachedBranchIdByName(DEFAULT_BRANCH_NAME)` — igualdad exacta case-sensitive, sin chequeo de estado | Devolver `null` si la sucursal resuelta está inactiva |
| `parseBranchId()` | Solo parsea el param | Sin cambios |

`/pedido` (`src/app/(public)/pedido/page.tsx:49`) ya valida `branches.some(b => b.id === branchId)`: si `listPublicBranches` filtra inactivas, un `?branchId` explícito a una inactiva muestra `PedidoError` sin código extra.

### 2.3 Rutas API públicas que aceptan `branchId`

| Ruta | Resolución | Efecto de desactivar |
|---|---|---|
| `GET /api/public/catalogo` | `query.branchId ?? getDefaultBranchId()` → `catalogService.listPublicCatalog*` → `getBranch()` (`catalogService.ts:60-66`) | `getBranch` debe rechazar inactivas → 400/404 |
| `POST /api/public/disponibilidad` | idem → `validatePublicCart` → mismo `getBranch` | Cubierto por el mismo punto |
| `POST /api/public/pedido` | `query.branchId ?? getDefaultBranchId()` → `orderService.createOrder` valida existencia + horario + caja abierta (`orderService.ts:267-297`) | Agregar chequeo `isActive` → `ValidationError` con mensaje genérico |
| `GET /api/public/sucursal/estado` | `getBranchById(branchId)` directo | Inactiva → responder `isOpen: false` con mensaje de cerrada (degradación elegante para páginas ya abiertas) |
| `POST /api/public/pedido/seguimiento` | `data.branchId ?? getDefaultBranchId()` → `trackOrder` | **Sin filtro**: los pedidos existentes deben seguir rastreándose |
| `POST /api/public/pedido/[id]/cancelar` | `query.branchId ?? getDefaultBranchId()` → `cancelOrder` con token | **Sin filtro**: cancelar libera las reservas de stock — deseable |
| `/pedido/[id]/chat` + `api/chat/*` | Scope por pedido/token, no por sucursal | **Sin filtro**: conversaciones existentes continúan |

### 2.4 Panel

| Punto | Hoy | Con el flag |
|---|---|---|
| `layout.tsx` → `listBranchesForRequest()` | Todas las sucursales al `BranchSelector` del header (admin) | Seguir listando todas — el admin necesita entrar a una inactiva para historial/cierre de caja. Marcar "(inactiva)" en el selector |
| `setActiveBranchAction` (`(panel)/actions.ts`) | Valida solo existencia | Sin cambio funcional: permitir seleccionar inactivas (operación interna) |
| `getCurrentBranchId*` (`lib/auth.ts`) | Valida existencia → `BranchRemovedError` | Sin cambio: una sucursal inactiva **existe** — no es `BranchRemovedError` |
| Operador asignado a sucursal inactiva | Login y panel normal | Sin cambio: el flag solo gobierna lo público; el operador debe poder cerrar su caja |
| `/sucursales` + `BranchActions` | Editar / Eliminar | Agregar **Desactivar/Activar** con diálogo liviano |
| `sucursales/actions.ts` | `createBranch`, `updateBranchAction`, `deleteBranchAction` (+ summary) | Agregar `setBranchActiveAction` + `getBranchDeactivationSummaryAction` |

### 2.5 Procesos de fondo

- Cron `Expirar pedidos pendientes`: escanea `orders`, no `branches` → sigue liberando reservas de sucursales inactivas (correcto).
- Cierre automático de caja (`CAJA_AUTO_CLOSE_HOURS`): por sucursal con caja abierta → sigue operando sobre inactivas (correcto: cierra el ciclo).
- Seeds: inserts sin `is_active` → `DEFAULT true` los cubre. Helpers E2E (`tests/e2e/helpers.ts`) idem.

### 2.6 Caché

El tag `branches` ya se invalida en create/update/delete (`invalidateBranchesCache`). El toggle debe hacer lo mismo + `invalidatePublicCatalogCache()` (el catálogo cacheado de una inactiva debe dejar de servirse en /pedido aunque el resolver ya lo bloquee) + `revalidatePath`. Ojo con `getCachedBranchIdByName`: cachea solo el `id` — el chequeo de activo debe hacerse después con `getCachedBranchById` (ya cacheado, segunda consulta barata) o cambiando la función cacheada para devolver `{id, isActive}`.

## 3. Decisiones de diseño

| # | Decisión | Criterio |
|---|---|---|
| D-1 | `isActive` gobierna **solo la superficie pública**: selector, resolución por defecto, catálogo, disponibilidad, estado y creación de pedidos. Panel, ventas internas, caja e historial inafectados | Desactivar ≠ cerrar operación interna: el historial debe seguir consultable y la caja abierta debe poder cerrarse |
| D-2 | **Sin fallback** de sucursal default inactiva a "otra activa": `getDefaultBranchId` → `null` → `/pedido` muestra error controlado | Un fallback silencioso vendería con el stock/caja de la sucursal equivocada |
| D-3 | Seguimiento, cancelación y chat de pedidos **existentes** siguen funcionando | Cancelar libera reservas de stock; cortar esos flujos dejaría reservas colgadas y clientes sin respuesta |
| D-4 | Desactivar **advierte pero no bloquea** aunque haya caja abierta o pedidos en curso | El diálogo los lista (reusa `countBranchDeletionImpact`); cortar el flujo es la elección del admin |
| D-5 | Última sucursal activa → solo advertencia, no bloqueo | El panel lista todas las sucursales y permite reactivar; no hay lockout posible |
| D-6 | `sucursal/estado` con sucursal inactiva → `isOpen:false` (no 404) | Un cliente con la página abierta ve "cerrada" en vez de un error |

## 4. Implementación por fases

### Fase 1 — Schema + migración

- `src/db/schema.ts`: `isActive: boolean('is_active').default(true).notNull()` en `branches`.
- `npx drizzle-kit generate` → `drizzle/0038_branches_is_active.sql` (`ALTER TABLE branches ADD COLUMN is_active boolean DEFAULT true NOT NULL`).
- `src/domain/types.ts`: `Branch.isActive: boolean`.
- Migración prod con el procedimiento de `entornos.md` (backup Neon previo — mismo flujo que 0036/0037).

### Fase 2 — Repositorio, caché y resolver

- `branchRepository.findAllOrderedByCreatedAt({ activeOnly?: boolean })` — `where is_active` cuando aplica. El caller público pasa `true`; el panel (`listBranchesForRequest`) sigue sin filtro.
- `server-cache.ts`: la función cacheada de lista acepta el flag como parte de la clave → `getCachedBranchList(limit, { activeOnly })` (o `getCachedActiveBranchList` separada para no romper la clave existente). `getDefaultBranchId` chequea `isActive` tras resolver el id vía `getCachedBranchById`.
- `branch-resolver.ts`: `listPublicBranches` filtra activas; nuevo helper **`resolvePublicBranchId(branchId | null): Promise<number | null>`** — si hay param, devuelve el id solo si la sucursal existe **y está activa**; si no, delega al default (que ya excluye inactivas). Punto único para las rutas públicas.

### Fase 3 — Servicios y rutas públicas

- `branchService.setBranchActive(id, isActive)`: valida existencia, `update(id, { isActive })`, devuelve la sucursal.
- `branchService.getBranchDeactivationSummary(id)`: reusa `countBranchDeletionImpact` para devolver solo `{ openCashRegisters, activeOrders }` + flags `{ isDefaultBranch, isLastActiveBranch }` (`countBranches` activas).
- `catalogService.getBranch`: `!branch.isActive` → `NotFoundError` (cubre catálogo y disponibilidad).
- `orderService.createOrder`: tras `getBranchById`, `!branch.isActive` → `ValidationError('En este momento no podemos recibir pedidos.')` (mismo mensaje que caja cerrada — no revela estado interno).
- Rutas `catalogo`, `disponibilidad`, `pedido` POST: reemplazar `query.branchId ?? getDefaultBranchId()` por `resolvePublicBranchId(query.branchId ?? null)`.
- `sucursal/estado`: si inactiva → `isOpen:false`, mensaje "La sucursal está cerrada." (sin exponer `branch` en la respuesta? — sí exponerlo, es info pública igual; pero `isOpen:false` basta. **Decisión abierta menor**, resolver en implementación).

### Fase 4 — Panel UI

- `BranchList`: badge "Inactiva" junto al nombre (o en la celda Horarios como estado aparte).
- `BranchActions`: botón **Desactivar**/**Activar** + `Dialog` liviano (sin tipeo de confirmación — no destructivo): al desactivar muestra warnings de caja abierta / pedidos en curso / es la pública por defecto / última activa (de `getBranchDeactivationSummaryAction`); al activar, confirmación simple.
- `sucursales/actions.ts`: `setBranchActiveAction` (requireAdmin) → `invalidateBranchesCache()` + `invalidatePublicCatalogCache()` + `revalidatePath(routes.sucursales)` + `revalidatePath(routes.home, 'layout')`.
- `branch-selector.tsx` (header): sufijo "(inactiva)" en opciones inactivas — el admin conserva acceso.

### Fase 5 — Tests

- Unitarios: `setBranchActive` (toggle + inexistente), resolver (default inactiva → null, param inactiva → null, param activa ok), `createOrder` sobre inactiva → `ValidationError`, `getBranch` de catálogo → `NotFoundError`, `sucursal/estado` inactiva → `isOpen:false`, action admin-only + invalidaciones.
- Componente: badge inactiva + diálogo de confirmación.
- E2E (spec nuevo o en `roles-y-sucursales.spec.ts`): desactivar sucursal B → `/pedido?branchId=B` muestra error y B desaparece del selector; pedido existente de B sigue cancelándose; reactivar → B vuelve. Ojo: los specs comparten base — desactivar siempre una sucursal creada por el propio spec y reactivarla/limpiar en `finally`.

### Fase 6 — Operación

- Migración prod: backup Neon → `drizzle-kit migrate` → verificación (mismo flujo documentado que 0036/0037).
- Post-deploy inmediato: desactivar "Sucursal por defecto" (id 1) desde `/sucursales` para sacarla del selector público.

## 5. Riesgos y notas

- **Renombrar la default ya rompe `/pedido`** (preexistente): con `isActive` hay una segunda forma legítima de "apagar" el canal — el diálogo advierte cuando es la sucursal de `DEFAULT_BRANCH_NAME`.
- **Sin lockout**: el panel nunca filtra por activo, así que siempre se puede reactivar.
- **Tamaño**: chico — 1 columna con default, ~12 archivos tocados, migración trivial. El grueso es resolver + servicios + UI del toggle.
- **No cubre** "sucursal pública por URL propia" ni multi-default; si se quiere selección de pública desde el panel sería otro PR (mover `DEFAULT_BRANCH_NAME` a `branches.is_default` o settings).
