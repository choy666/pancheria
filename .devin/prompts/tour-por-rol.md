# Prompt: Tour interactivo por rol (administrador / operador)

> **Auditoría + refactor.** El tour actual de `driver.js` no distingue entre roles. Este prompt guía la redefinición del recorrido para que cada rol vea solo las secciones, permisos y acciones que le corresponden.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja multi-sucursal.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- `driver.js` v1.8.0 para tours interactivos
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5 (sesión JWT)
- Patrón: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/roles-y-permisos.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/tour-navbar.md>

## Estado actual relevante

El tour está implementado en <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />. Hereda el patrón resuelto en <file:///C%3A/developer/paginas/pancheria/.devin/prompts/tour-navbar.md>: reinicio manual desde cualquier página, navegación entre rutas, persistencia en `localStorage` y callbacks globales de `driver.js`.

- El `TourProvider` recibe `userId` y `branchId` pero **no recibe el rol**.
- Los pasos se definen como un único arreglo fijo para todos los usuarios.
- El recorrido actual incluye `/productos` (<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="265-285" />), una ruta inaccesible para el operador; si un operador inicia el tour, al llegar a ese paso el middleware redirige a `/` y el tour se interrumpe.
- El panel muestra navegación diferenciada por rol en <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" /> (`adminNavItems` vs `operatorNavItems`).
- El `README.md` describe roles y permisos, pero no vincula el tour con esas diferencias.
- No existen `data-tour` en las secciones exclusivas de administrador (`/sucursales`, `/usuarios`, selector de sucursal, historial de ventas).

## Objetivo

1. Auditar el tour actual y confirmar qué pasos rompen o confunden a cada rol.
2. Redefinir el recorrido como **dos flows independientes**:
   - **Administrador (`admin`)**: recorrido completo por Panel, Ventas, Productos, Stock, Caja, Historial de cierres, Sucursales y Usuarios.
   - **Operador (`operator`)**: recorrido reducido por Panel, Ventas, Stock, Caja e Historial de cierres, con textos que reflejan sus permisos limitados.
3. Hacer que el `TourProvider` conozca el rol del usuario y construya los pasos dinámicamente.
4. Agregar los `data-tour` necesarios en las páginas y componentes administrativos.
5. Actualizar los tests unitarios y E2E para cubrir ambos recorridos.
6. Actualizar `README.md` para documentar que el tour se adapta al rol.

## Reglas de negocio

1. El tour **nunca** debe intentar navegar a una ruta que el rol no pueda acceder. El operador es redirigido a `/` si ingresa a `/productos`, `/sucursales` o `/usuarios` (<ref_snippet file="C:/developer/paginas/pancheria/tests/e2e/roles-y-sucursales.spec.ts" lines="126-137" />).
2. Las rutas de navegación del tour deben obtenerse de <ref_file file="C:/developer/paginas/pancheria/src/config/routes.ts" />, no escribirse como strings.
3. El `admin` puede acceder a todas las secciones: `Panel`, `Ventas`, `Historial`, `Productos`, `Stock`, `Caja`, `Sucursales` y `Usuarios`.
4. El `operator` solo puede acceder a `Panel`, `Ventas`, `Historial`, `Stock` y `Caja`, siempre dentro de su sucursal asignada.
5. El tour debe respetar `skipMissingElement: true` en los pasos que resaltan elementos, para no romperse si un componente aún no cargó.
6. El `TourProvider` debe seguir usando `localStorage` por usuario/sucursal y mantener el mecanismo de `restartTour`, `stopTour` y reanudación entre páginas.
7. El texto de cada paso debe reflejar las acciones reales que cada rol puede realizar en esa sección.
8. No se modifica el comportamiento de autorización: el tour es una guía sobre permisos ya existentes, no una nueva capa de control.

## Implementación detallada

### 1. `TourProvider` y construcción de pasos

- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />
  - Agregar `role?: 'admin' | 'operator'` a `TourProviderProps`.
  - Reemplazar `buildSteps` por una función que reciba el rol y devuelva `DriveStep[]`.
  - Mantener los pasos comunes (bienvenida, panel, navbar, ventas, caja, pedido, stock, cierre, historial de cierres, fin).
  - En el flujo `admin`, agregar pasos extra con navegación a:
    - `/productos` (tabla de productos y botones de nuevo producto/promo).
    - `/sucursales` (listado y formulario de sucursales).
    - `/usuarios` (listado, formulario y selector de sucursal).
    - Destacar el `BranchSelector` del navbar.
  - En el flujo `operator`, omitir los pasos de `/productos`, `/sucursales` y `/usuarios` y ajustar los textos del panel y navbar para reflejar la vista reducida.
  - Asegurar que `onNextClick`/`onPrevClick` a nivel de paso y los globales sigan funcionando con `navigateAndContinue` / `goBackAndContinue`.

### 2. `data-tour` en páginas y componentes

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />
  - Pasar `role={session.user.role}` al `TourProvider`.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/page.tsx" />
  - El operador no ve la tarjeta de Productos; verificar que `data-tour="dashboard-productos"` no genere saltos inesperados en su recorrido.
  - Considerar agregar `data-tour="dashboard-caja"` y `data-tour="dashboard-stock"` si aún no están en el tour.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />
  - Agregar `data-tour` en el contenedor de la tabla de productos, en el botón "Nueva promo" y en el título de la página.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" />
  - Agregar `data-tour="branches-header"` al encabezado y `data-tour="branches-table"` al contenedor del `BranchList`.

- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-list.tsx" />
  - Agregar `data-tour="branch-form"` al formulario y `data-tour="branches-table"` al contenedor de la tabla.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />
  - Agregar `data-tour="users-header"` al encabezado.

- <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-list.tsx" />
  - Agregar `data-tour="user-form"` al formulario y `data-tour="users-table"` al contenedor de la tabla.

- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/branch-selector.tsx" />
  - Agregar `data-tour="branch-selector"` al componente del selector.

- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
  - Verificar que los `data-tour` actuales (`caja-status`, `sales-products`, `sales-cart`) sean estables para ambos roles.

- <ref_file file="C:/developer/paginas/pancheria/src/components/stock/stock-list.tsx" />
  - Verificar `data-tour="stock-table"` y considerar un `data-tour` para el botón de ajuste de stock.

- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" />
  - Verificar `data-tour="caja-panel"` y considerar `data-tour` para los botones de abrir/cerrar caja.

- <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-history.tsx" />
  - Verificar `data-tour="closure-history-table"`.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/page.tsx" />
  - Considerar agregar `data-tour="cash-history-table"` alrededor del `CajaHistory`.

### 3. Texts and sequence by role

- **Administrador**:
  - Paso 0: "Bienvenido a Panchería" — explicar que como administrador puede gestionar sucursales, usuarios y productos.
  - Panel: resaltar todas las tarjetas accesibles.
  - Navbar: explicar las secciones administrativas adicionales.
  - Incluir pasos para `Productos`, `Sucursales`, `Usuarios` y el selector de sucursal.

- **Operador**:
  - Paso 0: "Bienvenido a Panchería" — explicar que su rol está limitado a las operaciones de su sucursal asignada.
  - Panel: resaltar solo `Ventas`, `Stock` y `Caja`.
  - Navbar: explicar que no ve `Productos`, `Sucursales` ni `Usuarios`.
  - Después del paso de `Ventas`, ir directamente a `Stock` sin pasar por `Productos`.

### 4. Tests unitarios

- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.test.tsx" />
  - Agregar un test que monte `TourProvider` con `role="admin"` y verifique que los pasos incluyan `/productos`, `/sucursales` y `/usuarios`.
  - Agregar un test que monte `TourProvider` con `role="operator"` y verifique que los pasos **no** incluyan esas rutas.
  - Verificar que `restartTour` con `role="operator"` desde `/` inicia el recorrido correcto.

### 5. Tests E2E

- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/tour.spec.ts" />
  - Extender el test actual para cubrir el recorrido completo del administrador.
  - Agregar un test separado `test.describe('Tour como operador')` que inicie sesión como operador con `loginAsOperator` y recorra el flujo reducido.
  - En el test del operador, verificar que:
    - El tour no intenta navegar a `/productos`.
    - El popover del panel describe las secciones permitidas.
    - El recorrido finaliza en el historial de cierres.

- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />
  - Reutilizar `loginAsAdmin` y `loginAsOperator` para los nuevos tests.

### 6. Documentación

- <ref_file file="C:/developer/paginas/pancheria/README.md" />
  - Actualizar la sección **Guía interactiva** para indicar que el recorrido se adapta al rol del usuario (admin vs operator) y que cada uno ve las funciones que puede usar.

## Archivos y áreas a tocar

- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.test.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/branch-selector.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/usuarios/user-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/stock/stock-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-history.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/tour.spec.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni URLs de API.
- Las rutas del tour deben provenir de <ref_file file="C:/developer/paginas/pancheria/src/config/routes.ts" />.
- No modificar la autorización de páginas: el tour es solo una guía; las redirecciones de admin/operator deben seguir funcionando igual.
- Los tests E2E truncan tablas de negocio; ejecutarlos solo en una base de datos de prueba.
- `.env.local` no debe commitearse.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificar tipos de TypeScript, especialmente en `TourProviderProps` |
| `npm run lint` | Lint y formato |
| `npm test` | Tests unitarios del tour |
| `npm run build` | Build de producción |
| `npm run test:e2e` o `npx playwright test tests/e2e/tour.spec.ts` | Recorridos de admin y operator en entorno de prueba |
