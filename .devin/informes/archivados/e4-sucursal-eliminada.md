# E4 — Sesión con sucursal eliminada (ronda 2, P0)

Rama: `fix/e4-orphan-branch` (separada de `fix/qa-2026-09-21`).
Estado: **implementado y mergeado** en `main` (PR #3 `2cd9dda` +
PR #5 `9efad8d` con logout forzado). Archivado el 2026-09-23.

## Hallazgo

`branchRepository.deleteCascade` hace **borrado físico** de la sucursal y
todos sus datos (usuarios, cajas, productos, pedidos, ventas, videos). El
JWT no se revalida contra la base en cada request (`auth.config.ts` copia
los claims), así que un usuario de la sucursal eliminada quedaba
autenticado con un `branchId` huérfano hasta la expiración del token.

Ningún servicio validaba que el `branchId` resuelto existiera antes de
escribir. Las operaciones sobre recursos ya borrados morían limpio
(404/400), pero los inserts directos con el `branchId` huérfano llegaban
a la restricción de FK y respondían **500**:

- `POST /api/caja/abrir` → 500 (reproducido pre-fix).
- `POST /api/productos` → 500 (mismo patrón de insert directo).
- `POST /api/videos/upload` y las server actions (`requireAdmin`/
  `requireAuth` puro, sin `getCurrentBranchId`) aceptaban la sesión
  huérfana y fallaban más abajo o escribían fuera del scope esperado.

## Corrección (`src/lib/auth.ts`)

Un único error consistente: `ForbiddenError('La sucursal asignada ya no
existe.')` → **403** en APIs, `redirect('/pedido')` en páginas.

1. `requireAuth`: tras verificar que el usuario tiene `branchId`, valida
   que la sucursal exista. Cubre todas las rutas `withAuth` **y** las
   server actions con `requireAuth`/`requireAdmin` — incluidas las que no
   resuelven `branchId` (usuarios, sucursales), que de otro modo seguían
   aceptando sesiones huérfanas.
2. `getCurrentBranchId`: valida el `branchId` **ya resuelto**, después del
   fallback del admin. La cookie `activeBranchId` huérfana sigue cayendo a
   la sucursal propia del usuario (regresión preservada); solo si esa
   también está eliminada se rechaza.
3. `getCurrentBranchIdOrRedirect` (layout/páginas del panel): con la
   sucursal resuelta eliminada redirige a **`/pedido`** (catálogo público)
   y no a `/login` — la sesión sigue viva y el middleware rebotaría
   `/login` → `/` → panel, produciendo un loop.

La lectura de existencia usa `branchService.getBranchById`, que pasa por
la capa `unstable_cache` con tag `branches`; `deleteBranchAction` ya
invalida ese tag (`expire: 0`), por lo que el check toma efecto apenas se
elimina la sucursal.

## Qué pasa después del 403 (punto 3)

**No hay logout automático.** El JWT sigue válido:

- En **APIs**, el operador puede reintentar indefinidamente y cada
  escritura responde el mismo 403 hasta que expire el token.
- En **páginas**, cualquier navegación dentro de `(panel)` termina en
  `/pedido`: el usuario queda viendo el catálogo público como si no
  estuviera autenticado, pero la sesión persiste.

### Propuesta de logout forzado (sin implementar)

1. Agregar `code: 'BRANCH_REMOVED'` al body del 403 en `api-handler`
   (solo para este error, para distinguirlo de 403 de permisos).
2. En el wrapper cliente (`throwApiError`/`authenticatedFetch`), al
   recibir ese `code`: `signOut()` de next-auth y redirect a
   `/login?error=branch_removed`, con el login mostrando "Tu sucursal fue
   eliminada; se cerró tu sesión."
3. Para páginas RSC: `getCurrentBranchIdOrRedirect` redirigiría a una
   página pública intermedia (p. ej. `/sesion-finalizada`) que ejecuta
   `signOut()` vía server action y luego lleva al login con el mismo
   mensaje — en vez de `/pedido`.

Con eso, la próxima acción del operador cierra su sesión en vez de dejarlo
rebotando errores.

## Verificaciones

| Verificación | Resultado |
| --- | --- |
| `npm run lint` | ✓ limpio |
| `npx tsc --noEmit` | ✓ limpio |
| `npm test` | ✓ 173 suites / 1864 tests (29 tests de auth incluidos) |
| `npm run knip` | ✓ limpio |
| `sesion-sucursal-eliminada.spec.ts` | ✓ 2/2 — 403 en caja/productos/videos, expulsión del panel, fallback admin sin 403 |
| Regresión E2E (`sucursal-eliminacion`, `roles-y-sucursales`, `login`, `caja-aislamiento-y-trazabilidad`) | ✓ 19/19 |

Tests unitarios nuevos en `src/lib/auth.test.ts`: sucursal eliminada →
`ForbiddenError` en `requireAuth`, `getCurrentBranchId` y `requireAdmin`;
admin con cookie huérfana + sucursal propia eliminada → `ForbiddenError`;
`getCurrentBranchIdOrRedirect` → redirect `/pedido`.

## Notas

- "Crear usuario" no tiene endpoint REST: es server action con
  `requireAdmin`, cubierta por el check de `requireAuth` (regresión
  unitaria) e inaccesible en la UI porque la página `/usuarios` expulsa la
  sesión huérfana. El `branchId` del payload además ya se validaba en
  `userService.createUser`.
- Costo: una consulta `getBranchById` extra por request autenticado,
  cacheada por tag `branches` en producción.
