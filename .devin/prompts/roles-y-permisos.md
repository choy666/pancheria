# Prompt: Analizar y documentar roles y permisos en `/usuarios`

> **Estado: resuelto en su objetivo documental.** Este prompt sirve como referencia para auditorías futuras sobre roles (`admin`/`operator`) y permisos en el proyecto `pancheria`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, caja y cierre diario multi-sucursal.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5 (sesión JWT)
- Patrón: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/informe-auditoria-general.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/control-de-acceso-y-sucursales.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />

## Estado actual relevante

- El esquema define los roles `admin` y `operator` en <ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="47-70" />.
- La sesión JWT transporta `role`, `branchId` y `branchName` en <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />.
- `lib/auth.ts` implementa `requireAdmin`, `requireAuth` y `getCurrentBranchId`, que permite al `admin` cambiar de sucursal activa mediante una cookie: <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />.
- `userService.createUser` solo permite crear usuarios con rol `operator`: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/userService.ts" lines="25-47" />.
- La página `/usuarios` lista **todos** los usuarios del sistema cuando accede un `admin` y muestra la sucursal asignada: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />.
- La navegación del panel se adapta al rol en <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />.
- El administrador creado por el seed se asigna a la sucursal inicial (`DEFAULT_BRANCH_NAME`) en <ref_snippet file="C:/developer/paginas/pancheria/src/db/seeds.ts" lines="31-61" />.

## Decisiones de alcance confirmadas

1. El listado de `/usuarios` debe mostrar siempre **todos** los usuarios del sistema.
2. La documentación de roles se centraliza en <ref_file file="C:/developer/paginas/pancheria/README.md" /> con una **descripción textual**.
3. El `operator` debe poder ver el nombre de su sucursal asignada en la navbar.

## Objetivo

1. Analizar el comportamiento de los roles en `http://localhost:3000/usuarios`.
2. Confirmar que el rol `admin` (único administrador, creado por el seed y asignado a una sucursal concreta) tiene control sobre todas las sucursales.
3. Confirmar que los usuarios `operator` solo pueden operar en la sucursal que el administrador les asignó.
4. Verificar y completar la documentación existente (`README.md`) para que describa claramente el rol `admin`, el rol `operator` y sus permisos correspondientes.
5. Corregir cualquier discrepancia entre lo que la UI muestra y lo que la documentación dice.

## Reglas de negocio

1. El administrador inicial se crea únicamente desde el seed (`ADMIN_USERNAME` / `ADMIN_PASSWORD` en `.env.local`). No se pueden crear más administradores desde `/usuarios`.
2. El `admin` puede acceder a todas las secciones: `Panel`, `Ventas`, `Historial`, `Productos`, `Stock`, `Caja`, `Sucursales` y `Usuarios`.
3. El `admin` puede cambiar la sucursal activa mediante el selector del panel; el `operator` no.
4. El `operator` solo puede acceder a `Panel`, `Ventas`, `Historial`, `Stock` y `Caja`, siempre dentro de su sucursal asignada. Dentro de `Stock` puede ajustar stock y consultar movimientos; dentro de `Caja` puede abrir, cerrar y consultar historial, así como generar cierres diarios de su sucursal.
5. El `admin` puede crear, editar, resetear la contraseña y eliminar usuarios `operator`, pero no editar ni eliminar el `admin` inicial.
6. La creación de usuarios desde la UI fuerza el rol `operator` y requiere una sucursal válida.
7. El nombre de la sucursal activa se muestra una sola vez en la navbar: en el `BranchSelector` cuando el `admin` tiene acceso al selector; en el `span` de `active-branch-name` cuando el usuario es `operator` o no hay selector.
8. No se hardcodean IDs, nombres de sucursal ni credenciales.

## Implementación detallada

### 1. Análisis en `/usuarios`

- Iniciar sesión como `admin` y abrir `http://localhost:3000/usuarios`.
- Verificar que el `admin` figura en la tabla con una sucursal concreta (por ejemplo, `Sucursal Sur`) y que esto es correcto: pertenece a esa sucursal en el esquema, pero puede operar sobre todas gracias a `getCurrentBranchId`.
- Verificar que los `operator` listados muestran la sucursal asignada por el `admin`.
- Confirmar que el selector de sucursal del panel solo aparece para `admin`.
- Iniciar sesión como `operator` y confirmar que:
  - No puede acceder a `/productos`, `/sucursales` ni `/usuarios`.
  - Solo ve las opciones `Panel`, `Ventas`, `Historial`, `Stock` y `Caja`.
  - No puede cambiar de sucursal.
  - Ve el nombre de su sucursal asignada en la navbar.

### 2. UX de la navbar

- Verificar que el nombre de la sucursal activa aparezca una sola vez en la navbar.
- Para `admin` con más de una sucursal, el `BranchSelector` muestra el nombre; el `span` de `active-branch-name` debe ocultarse.
- Para `operator` o `admin` con una sola sucursal, mostrar el `span` de `active-branch-name` y no el selector.
- Archivos clave: <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/panel/branch-selector.tsx" />.
- Tests E2E: contar que el nombre de la sucursal activa aparece exactamente una vez en la navbar para cada rol.

### 3. Documentación de roles

- Mantener la sección **Roles y permisos** en <ref_file file="C:/developer/paginas/pancheria/README.md" /> con:
  - Descripción del rol `admin` (control total, multi-sucursal, único creado por seed).
  - Descripción del rol `operator` (restringido a una sucursal, permisos limitados).
  - Tabla o listado de permisos por sección.
  - Confirmación de que `/usuarios` lista todos los usuarios.
  - Confirmación de que no se pueden crear más administradores desde la UI.

### 3. Archivos a revisar

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/actions.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-form.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni URLs de API.
- `.env.local` no debe commitearse.
- Los tests E2E truncan tablas de negocio; ejecutarlos solo en una base de datos de prueba.
- El análisis manual requiere tener `.env.local` configurado y correr `npx tsx src/db/seeds.ts` si la base está vacía.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run dev` | Validar manualmente el comportamiento de roles en `/usuarios` |
| `npm run lint` | Detectar errores de estilo |
| `npx tsc --noEmit` | Verificar tipos |
| `npm test` | Ejecutar tests unitarios |
| `npm run build` | Verificar build de producción |
| `npm run test:e2e` | Validar flujos de autorización en base de prueba |
