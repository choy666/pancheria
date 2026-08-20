# Prompt: Corregir errores de deploy en Vercel — `ForbiddenError` sin sucursal y React #441 (RESUELTO)

> **Estado: resuelto.** Todos los Server Components del grupo `(panel)` ahora usan `getCurrentBranchIdOrRedirect`. Las rutas API y server actions conservan `getCurrentBranchId` para devolver `403`. El contexto histórico de la auditoría se encuentra en `.devin/informes/reporte-estado.md`.

## Contexto histórico

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

En producción (Vercel) se repetían dos síntomas vinculados:

1. **Respuestas 500 en múltiples GET** con el mensaje `ForbiddenError: El usuario no tiene una sucursal asignada.`
2. **React error #441** en el cliente: *An error occurred in the Server Components render*.

El problema se originaba en `src/lib/auth.ts`. Las funciones `requireAuth()` y `getCurrentBranchId()` arrojaban `ForbiddenError` cuando `session.user.branchId` era nulo. En rutas API eso estaba bien: `src/lib/api-handler.ts` ya capturaba `ForbiddenError` y devolvía `403`.

El panel ya tenía una primera línea de defensa: `src/app/(panel)/layout.tsx` envolvía `getCurrentBranchId(session)` en un `try/catch` y, si el error era "El usuario no tiene una sucursal asignada.", renderizaba `src/components/panel/branch-required-fallback.tsx`. También existía `getCurrentBranchIdOrRedirect` en `src/lib/auth.ts`.

Sin embargo, otros Server Components del grupo `(panel)` todavía podían invocar `getCurrentBranchId(session)` directamente sin `try/catch` ni redirección, propagando `500` y `React #441`.

## Solución aplicada

- Se implementó `getCurrentBranchIdOrRedirect` en `src/lib/auth.ts`.
- Se migraron todos los Server Components del panel (`src/app/(panel)/**/page.tsx`) para usar `getCurrentBranchIdOrRedirect`.
- Las server actions y rutas API mantuvieron `getCurrentBranchId`/`requireAdmin` para devolver `403` cuando corresponda.
- `src/db/seeds.ts` garantiza que el usuario administrador inicial tenga asignada la sucursal `DEFAULT_BRANCH_NAME`.

## Verificaciones que se usaron

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `npm run test:e2e` (base de prueba)
