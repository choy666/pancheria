# Prompt: Corregir errores de deploy en Vercel — `ForbiddenError` sin sucursal y React #441

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

## Estado actual relevante

En producción (Vercel) se repiten dos síntomas vinculados:

1. **Respuestas 500 en múltiples GET** con el mensaje `ForbiddenError: El usuario no tiene una sucursal asignada.`
2. **React error #441** en el cliente: *An error occurred in the Server Components render* (en producción se muestra como código minificado).

El problema se origina en <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />. Las funciones `requireAuth()` y `getCurrentBranchId()` arrojan `ForbiddenError` cuando `session.user.branchId` es nulo. En rutas API eso está bien: <ref_file file="C:/developer/paginas/pancheria/src/lib/api-handler.ts" /> ya captura `ForbiddenError` y devuelve `403`. Sin embargo, los **Server Components** del panel (<ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />, etc.) invocan `getCurrentBranchId(session)` sin un `try/catch` ni una redirección. El error no controlado hace que Next.js responda `500` y React en producción lo resuma como `#441`.

<ref_snippet file="C:/developer/paginas/pancheria/src/lib/auth.ts" lines="9-21" />
<ref_snippet file="C:/developer/paginas/pancheria/src/lib/auth.ts" lines="23-52" />
<ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" lines="15-23" />

## Objetivo

Eliminar los `500`/`React #441` provocados por un usuario autenticado sin sucursal asignada, redirigiendo a la pantalla correcta según el rol y mejorando la tolerancia a fallos del panel.

## Reglas de negocio

1. Todo usuario autenticado del panel debe tener una sucursal (`branchId`) para operar.
2. Si un **admin** no tiene sucursal asignada, redirigir a `/sucursales` para que cree o seleccione una.
3. Si un **operator** no tiene sucursal asignada, cerrar su sesión y redirigir a `/login` con un mensaje claro (por ejemplo `?error=no_branch`).
4. Las rutas API (`/api/**`) deben seguir devolviendo `403` ante `ForbiddenError` a través de `withApiErrorHandling`; no cambiar ese comportamiento.
5. El seed (`src/db/seeds.ts`) debe garantizar que el usuario administrador inicial tenga asignada la sucursal `DEFAULT_BRANCH_NAME`; si ya existe un administrador sin sucursal, corregirlo idempotentemente.
6. No hardcodear IDs de sucursal, roles ni URLs de redirección. Usar `src/config/routes.ts` para las rutas.

## Implementación detallada

### Backend / autenticación

- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
  - Conservar `requireAuth`, `getCurrentBranchId` y `requireAdmin` para que sigan arrojando `ForbiddenError` (lo usan API routes y server actions).
  - Agregar una función `getCurrentBranchIdOrRedirect(session?): Promise<number>` diseñada exclusivamente para Server Components.
    - Si no hay sesión/usuario, redirigir a la ruta de login usando `src/config/routes.ts`.
    - Si falta `branchId` y el rol es `admin`, redirigir a la ruta de sucursales.
    - Si falta `branchId` y el rol es `operator`, redirigir a la ruta de login con `?error=no_branch` (u otro parámetro documentado).
    - Para `admin`, respetar la cookie `activeBranchId` si es válida, igual que `getCurrentBranchId`.
    - Devolver `branchId`.
  - Opcionalmente agregar `ensureSessionWithBranch(session?)` como helper reutilizable en layouts y páginas.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />
  - Reemplazar `getCurrentBranchId(session)` por la nueva helper que redirige.
  - Mantener la lógica de selección de sucursales y el `signOutAction`.

### Frontend

- Actualizar todos los Server Components del grupo `(panel)` que invoquen `getCurrentBranchId(session)` directamente. Buscar con `grep` en `src/app/(panel)/**/page.tsx` y, si aplica, en `src/app/(panel)/**/actions.ts`.
  - Reemplazar por `getCurrentBranchIdOrRedirect(session)`.
  - Páginas conocidas a revisar: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/videos/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/videos/[id]/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/[id]/editar/page.tsx" />.
  - Para server actions (`actions.ts`) mantener `requireAdmin`/`getCurrentBranchId` existentes; no usar `redirect` en ellas.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/error.tsx" />
  - Mejorar el mensaje cuando `error.message` contenga "sucursal asignada" para guiar al usuario en lugar de mostrar "Algo salió mal".
  - Mantener la distinción de errores de conexión a base de datos.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/login-form.tsx" />
  - Mostrar un mensaje amigable si la URL incluye `?error=no_branch` (u otro parámetro documentado), explicando que debe contactar al administrador.

### Integridad de datos

- <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
  - Verificar que `seedAdmin` asigna `branchId: defaultBranchId`.
  - Agregar o ajustar la lógica para que, si el usuario administrador ya existe pero no tiene `branchId`, lo actualice con la sucursal por defecto sin sobreescribir otros campos.

### Tests

- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.test.ts" />
  - Agregar tests para `getCurrentBranchIdOrRedirect`:
    - Admin sin `branchId` redirige a la ruta de sucursales.
    - Operator sin `branchId` redirige a la ruta de login con el parámetro de error.
    - Usuario válido con `branchId` devuelve el ID.
    - Admin con cookie `activeBranchId` válida devuelve esa sucursal.
- Agregar o actualizar tests de integración para que `GET` a páginas del panel con un usuario sin sucursal devuelva redirección (`302`) en lugar de `500`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de redirección ni IDs de sucursal.
- `.env.local` no debe commitearse. Las variables `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `DEFAULT_BRANCH_NAME` deben estar configuradas correctamente en Vercel.
- No ejecutar `npx tsx src/db/seeds.ts` contra una base de datos con datos reales; primero validar en una base de prueba.
- Asegurar que `redirect()` de `next/navigation` no sea capturado accidentalmente por `try/catch` genéricos.
- No exponer información sensible en los mensajes de error del cliente.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba (requiere confirmación) |

Después del build, validar que no aparezcan errores de Server Components en el log de Vercel (o en `npm run build` si emula producción).

## Notas de deploy

- Si el administrador en producción no tiene `branchId`, ejecutar el seed de reparación (con confirmación y backup) o una query SQL puntual para asignarle la sucursal cuyo nombre coincida con `DEFAULT_BRANCH_NAME`.
- `NEXTAUTH_URL` en Vercel debe coincidir con el dominio de producción asignado.
