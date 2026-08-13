# Prompt: Control de acceso por rol y selección de sucursal para administradores

> **Estado: resuelto.** Este prompt ya fue implementado. Se conserva como referencia histórica del control de acceso basado en roles (`admin`/`operator`) y del selector de sucursal activa para administradores.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5 (sesión JWT)
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/verificar-navbar-sucursal.md>

## Estado actual relevante

El esquema de base de datos ya distingue roles: <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="46-69" />.

La sesión de NextAuth transporta `role`, `branchId` y `branchName`: <ref_snippet file="C:/developer/paginas/pancheria/src/auth.ts" lines="31-37" /> y <ref_snippet file="C:/developer/paginas/pancheria/src/auth.config.ts" lines="25-47" />.

`lib/auth.ts` ya ofrece `requireAuth`, `getCurrentBranchId` y `requireAdmin`: <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />.

La navbar del panel está en <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />. Actualmente oculta `Sucursales` y `Usuarios` a los no-administradores, pero sigue mostrando `Productos` a todos los usuarios.

Las páginas de `Sucursales` y `Usuarios` ya redirigen a los no-administradores: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />.

La página de `Productos` no verifica el rol: <ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" lines="30-32" />.

El formulario de creación de usuarios permite elegir el rol `admin`: <ref_snippet file="C:/developer/paginas/pancheria/src/components/usuarios/user-form.tsx" lines="69-81" />.

Las rutas de API de productos usan `requireAuth`, no `requireAdmin`, por lo que un usuario operador podría invocar `POST`, `PUT` o `DELETE` de productos si conoce el endpoint: <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/[id]/route.ts" />.

No existe un mecanismo para que el administrador opere en una sucursal distinta a la suya. `getCurrentBranchId` devuelve siempre el `branchId` de la sesión: <ref_snippet file="C:/developer/paginas/pancheria/src/lib/auth.ts" lines="18-26" />.

## Objetivo

1. El **administrador inicial** (credenciales de `.env.local`) debe tener acceso completo al proyecto, incluyendo `Productos`, `Sucursales` y `Usuarios`.
2. Los **usuarios creados por el administrador** deben tener rol `operator` y solo poder navegar y operar en: `Panel`, `Ventas`, `Historial`, `Stock` y `Caja`.
3. Los usuarios `operator` **no deben** acceder ni visualizar las secciones `Productos`, `Sucursales` ni `Usuarios`.
4. El administrador debe ser el único que pueda acceder a **ambas sucursales** y operar en ellas.
5. Los usuarios `operator` deben estar restringidos a la **sucursal asignada** en su creación.

## Reglas de negocio

1. El administrador del seed (`ADMIN_USERNAME`/`ADMIN_PASSWORD` de `.env.local`) es el único `admin` legítimo. Los usuarios creados desde la UI deben ser siempre `operator`.
2. El rol `admin` desbloquea las secciones `Productos`, `Sucursales` y `Usuarios`.
3. El rol `operator` solo puede ver y usar `Panel`, `Ventas`, `Historial`, `Stock` y `Caja`.
4. Toda mutación de productos, recetas, sucursales y usuarios requiere rol `admin`.
5. Un `operator` no puede listar, crear, editar ni eliminar productos, sucursales ni usuarios, ni acceder a datos de otra sucursal.
6. El administrador puede cambiar la sucursal activa en la que opera mediante un selector en la navbar; la preferencia se persiste en una cookie `activeBranchId`.
7. Si el administrador no tiene una sucursal activa seleccionada, se usa la sucursal asignada a su usuario.
8. Un `operator` ignora la cookie de sucursal activa y siempre opera en su `branchId` de sesión.
9. No se hardcodean IDs, nombres de sucursal ni credenciales.
10. No se modifica la configuración de sesión de NextAuth de forma insegura.

## Implementación detallada

### 1. Sucursal activa para administradores

- En <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />:
  - Definir la constante `ACTIVE_BRANCH_COOKIE`.
  - Extender `getCurrentBranchId(session?)` para que, si el usuario es `admin`, lea la cookie `activeBranchId` y, si es válida, la devuelva; de lo contrario, usar `session.user.branchId`.
  - Aceptar un `session` opcional para evitar dobles llamadas a `auth()`.
- Crear una server action `setActiveBranchAction` en `src/app/(panel)/actions.ts` que guarde la cookie y haga `revalidatePath('/')`.
- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />:
  - Obtener la sucursal activa con `getCurrentBranchId(session)`.
  - Cargar la lista de sucursales solo si el usuario es `admin`.
  - Pasar las sucursales, la sucursal activa y la server action a `PanelHeader`.

### 2. Navbar y navegación

- En <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />:
  - Definir dos listas de navegación: `operatorNavItems` (`Panel`, `Ventas`, `Historial`, `Stock`, `Caja`) y `adminNavItems` (añade `Productos`, `Sucursales`, `Usuarios`).
  - Mostrar la lista correspondiente según `role`.
  - Mostrar el selector de sucursal solo para `admin`.
- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/page.tsx" />:
  - Opcionalmente condicionar la tarjeta de `Productos` al rol `admin`.

### 3. Protección de páginas y server actions

- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/nuevo/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/[id]/editar/page.tsx" />:
  - Verificar `session.user.role !== 'admin'` y redirigir a `/`.
  - Usar `getCurrentBranchId(session)` en lugar de `session.user.branchId`.
- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/actions.ts" />:
  - Cambiar `requireAuth` por `requireAdmin`.
  - Usar `getCurrentBranchId(session)`.
- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />:
  - Usar `getCurrentBranchId(session)`.
- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />:
  - Usar `getCurrentBranchId(session)` para listar usuarios de la sucursal activa (o, alternativamente, todos si se decide ver el total del sistema).

### 4. Protección de APIs

- Rutas de productos y recetas (`POST`, `PUT`, `PATCH`, `DELETE`) deben usar `requireAdmin` en lugar de `requireAuth`:
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/[id]/route.ts" />
  - <ref_file file="C:/developer/paginas/pancheria/src/app/api/recetas/route.ts" />
- Las rutas `GET` de productos usadas por la terminal de ventas (`/api/productos?includeAvailability=true`, `/api/productos/disponibilidad`) deben seguir usando `requireAuth` y respetar la sucursal del usuario.
- Todas las rutas de `caja`, `cierre`, `stock` y `ventas` deben usar `getCurrentBranchId(session)` para que el administrador opere sobre la sucursal activa.
- Las rutas de usuarios y sucursales ya están protegidas por `requireAdmin`; asegurar que devuelvan `403` si se invocan sin ese rol.

### 5. Restricción de creación de usuarios

- En <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-form.tsx" />:
  - Eliminar el selector de rol y enviar siempre `role='operator'`.
- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/actions.ts" />:
  - Forzar `role` a `'operator'` antes de llamar a `userService.createUser`.
- Opcionalmente, en <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" />:
  - Validar que `role` sea `'operator'` y lanzar `ValidationError` si se intenta crear otro `admin`.

### 6. Tests

- Actualizar <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.test.ts" /> para cubrir:
  - `getCurrentBranchId` para `admin` sin cookie (usa sesión).
  - `getCurrentBranchId` para `admin` con cookie válida.
  - `getCurrentBranchId` para `operator` ignora cookie.
- Actualizar <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.test.ts" /> para reflejar que los usuarios creados son siempre `operator`.
- Considerar tests E2E para los flujos críticos de login con ambos roles.

## Archivos y áreas a tocar

- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/actions.ts" /> (nuevo)
- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/nuevo/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/[id]/editar/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/actions.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/actions.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-form.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.test.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/[id]/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/recetas/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/stock/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/stock/ajustar/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/stock/movimientos/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/abrir/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/cerrar/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/historial/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/resumen/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/eliminadas/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/[id]/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/[id]/permanente/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/[id]/restaurar/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/cierre/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/cierre/historial/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/[id]/anular/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/disponibilidad/route.ts" />

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni URLs de API.
- `.env.local` no debe commitearse.
- La cookie `activeBranchId` debe configurarse con `httpOnly`, `sameSite: 'lax'` y `secure` en producción.
- No crear un segundo `admin` desde la UI; el formulario de usuarios solo permite `operator`.
- Ejecutar `npm run test:e2e` solo en bases de datos de prueba, porque trunca tablas.
- Antes de subir a producción, verificar que las variables de entorno de Vercel incluyen `NEXTAUTH_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificar tipos |
| `npm run lint` | Detectar errores de estilo |
| `npm test` | Ejecutar tests unitarios |
| `npm run build` | Verificar build de producción |
| `npm run dev` | Validar manualmente: login como admin, cambiar de sucursal, crear un operador, loguearse como operador y verificar que no accede a Productos/Sucursales/Usuarios |
| `npx drizzle-kit push` | Solo si se modifica el esquema (no es el caso) |

## Preguntas a resolver antes de implementar

1. ¿El administrador debe listar **todos** los usuarios del sistema o solo los de la sucursal activa? (Sugerencia: listar todos para una gestión centralizada, pero destacar la sucursal asignada.)
2. ¿La cookie de sucursal activa debe tener fecha de expiración o ser de sesión? (Sugerencia: persistir 30 días para comodidad, invalidar si el administrador cambia de dispositivo.)
3. ¿Se requiere un `middleware.ts` de Next.js para bloquear rutas de administrador antes de llegar a las páginas, o basta con las redirecciones en cada Server Component? (Sugerencia: mantener redirecciones en páginas para coherencia con el resto del proyecto; `middleware.ts` puede agregarse en una iteración posterior.)
