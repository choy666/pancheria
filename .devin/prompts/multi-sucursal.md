# Prompt: Soporte multi-sucursal con aislamiento de datos por login

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas y cierre de caja para una panchería.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Patrón: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md>

## Estado actual relevante

Actualmente el sistema funciona para una única panchería:

- No existe el concepto de sucursal.
- Hay una única cuenta de administrador creada desde variables de entorno.
- El login solo pide usuario y contraseña; no hay selector de sucursal.
- La tabla `cash_registers` tiene un índice único parcial que impide más de una caja abierta a nivel global.
- La tabla `daily_closures` tiene un índice único por fecha a nivel global.
- Todos los productos, recetas, stock, ventas y cierros son compartidos.

Archivos clave:

- Esquema: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- Seed: <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
- Autenticación: <ref_snippet file="C:/developer/paginas/pancheria/src/auth.ts" lines="6-35" />
- Configuración de sesión: <ref_snippet file="C:/developer/paginas/pancheria/src/auth.config.ts" lines="12-36" />
- Verificación de credenciales: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/authService.ts" lines="47-76" />
- Apertura de caja: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" lines="70-102" />
- Confirmación de venta: <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="402-420" />
- Setup de tests E2E: <ref_file file="C:/developer/paginas/pancheria/tests/e2e/global-setup.ts" />

## Objetivo

Implementar soporte multi-sucursal de forma escalable:

1. Cada usuario pertenece a una y solo una sucursal.
2. La sucursal se determina automáticamente al iniciar sesión, **sin selector en el login**.
3. Las credenciales actuales (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) deben seguir funcionando para la sucursal por defecto.
4. Se debe poder crear nuevos usuarios vinculados a otras sucursales.
5. Los datos de cada sucursal deben estar aislados: productos, stock, cajas, ventas y cierres no deben mezclarse.

## Reglas de negocio

1. Un usuario pertenece a una única sucursal (`users.branchId` no nulo).
2. No puede haber dos cajas abiertas en la misma sucursal; sí en distintas.
3. El cierre diario es único por sucursal y fecha.
4. Los productos y recetas son por sucursal. Cada sucursal tiene su propio catálogo aislado.
5. Una receta solo puede vincular productos de la misma sucursal.
6. Una venta solo puede usar productos de la sucursal del usuario y de la caja abierta en esa sucursal.
7. El nombre de la sucursal por defecto y las credenciales nuevas no deben hardcodearse; deben provenir de variables de entorno, configuración o UI de administración. Usar `DEFAULT_BRANCH_NAME` para la sucursal por defecto y, opcionalmente, `NEW_BRANCH_NAME`, `NEW_BRANCH_USERNAME` y `NEW_BRANCH_PASSWORD` para una segunda sucursal vía seed.
8. Los datos históricos existentes deben migrarse a la sucursal por defecto.
9. Preservar el comportamiento de soft delete y las reglas de integridad documentadas en `.devin/informes/lecciones-aprendidas.md`.
10. Los tests E2E solo deben ejecutarse en bases de datos de prueba.

## Implementación detallada

### Base de datos

- Crear tabla `branches` (`id`, `name`, `createdAt`).
- Agregar `branchId` a las tablas `users`, `products`, `cashRegisters`, `sales`, `stockMovements` y `dailyClosures`, configurando `references(() => branches.id)` en cada una.
- Agregar índices compuestos por `branchId` en tablas consultadas por rango o listado: `products (branchId, type, isActive)`, `cashRegisters (branchId, status, deletedAt)`, `sales (branchId, createdAt)`, `stockMovements (branchId, productId)`, `dailyClosures (branchId, date)`.
- Actualizar índices y restricciones:
  - Reemplazar el índice único parcial de `cash_registers` para que sea por `(branchId, status)` cuando `status = 'open'` y `deletedAt IS NULL`.
  - Reemplazar el índice único de `daily_closures.date` por `(branchId, date)`.
- Crear una migración controlada que:
  1. Agregue todas las columnas `branchId` como nullable.
  2. Inserte la sucursal por defecto usando `DEFAULT_BRANCH_NAME`.
  3. Poble `branchId` en las filas existentes con el valor de la sucursal por defecto.
  4. Haga las columnas `branchId` no nulas.
  5. Agregue las foreign keys `references(() => branches.id)`.
- Actualizar las relaciones de Drizzle (`branches` ↔ `users`, `products`, `cashRegisters`, `sales`, `stockMovements`, `dailyClosures`).

### Autenticación y sesión

- Extender `verifyCredentials` para retornar `branchId` (y opcionalmente `branchName`).
- Actualizar `auth.ts` para que `authorize` devuelva la información de sucursal.
- Actualizar `auth.config.ts` para que `jwt` y `session` incluyan `branchId`.
- Crear o actualizar la declaración de tipos de NextAuth (p. ej. `src/types/next-auth.d.ts`) para extender `User`, `JWT` y `Session` con `branchId` y evitar errores de build.
- Crear o extender un helper en `src/lib/auth.ts` para obtener la sucursal de la sesión actual (`getCurrentBranchId` / `requireAuthWithBranch`); lanzar `UnauthorizedError` si no hay sesión y, opcionalmente, si no tiene sucursal asignada.
- El login (`login-form.tsx`) no debe agregar selector de sucursal.

### Usuarios y sucursales

- Implementar un administrador mínimo de usuarios y sucursales (por ejemplo, `/panel/sucursales` y `/panel/usuarios`).
- Restringir el acceso a `/panel/sucursales` y `/panel/usuarios` al usuario administrador (el definido por `ADMIN_USERNAME`) o, en su defecto, a cualquier usuario cuya sucursal sea la por defecto hasta que exista un sistema de roles.
- Permitir crear una sucursal y luego un usuario asociado a ella. El flujo mínimo: crear sucursal → crear usuario con `username`, `password` en texto plano y `branchId`.
- El usuario admin existente debe quedar vinculado a la sucursal por defecto durante la migración.
- En primera instancia se puede soportar la creación del primer usuario de una nueva sucursal vía UI; las credenciales deben hashearse con bcrypt como en `seedAdmin`.

### Catálogo, recetas y stock

- Refactorizar `seedCatalog` en `src/db/seeds.ts` para que acepte un `branchId` y cree productos, recetas y stock iniciales para esa sucursal.
- Cambiar las firmas de `productService` para recibir `branchId`:
  - `listProducts(branchId, includeDeleted?)`
  - `listActiveProducts(branchId)`
  - `listActiveProductsWithAvailability(branchId)`
  - `createProduct(data, branchId)`
  - `getProductById(id, branchId, includeDeleted?)`
  - `updateProduct(id, data, branchId)`
  - `deleteProduct(id, branchId)`, `restoreProduct(id, branchId)`
- Al crear un producto, asignarle `branchId` de la sucursal del usuario logueado antes de insertar.
- Cambiar las firmas de `recipeService` para recibir `branchId`:
  - `getRecipeByProductId(productId, branchId)`
  - `saveRecipe(branchId, compoundProductId, items)`
- Al crear o editar recetas, validar que el producto compuesto y sus insumos pertenezcan a la misma sucursal.
- Cambiar la firma de `stockService` para recibir `branchId`:
  - `listStockAlerts(branchId)`
  - `adjustStock(branchId, productId, quantity, reason, type?)`
  - `getStockHistory(branchId, productId, pagination)`
- Los movimientos de stock deben filtrarse y registrarse dentro de la sucursal del producto/usuario. Asignar `stockMovements.branchId` con el `branchId` del producto afectado.
- La disponibilidad y alertas de stock deben filtrarse por sucursal.

### Caja y ventas

- Cambiar las firmas de `cashRegisterService` para recibir `branchId`:
  - `getOpenCashRegister(branchId)`
  - `openCashRegister({ openedBy, branchId })`
  - `getCashRegisterById(id, branchId, includeDeleted?)`
  - `closeCashRegister(id, closedBy, branchId)`
  - `deleteCashRegister(id, branchId)`, `restoreCashRegister(id, branchId)`, `permanentlyDeleteCashRegister(id, branchId)`
  - `listCashRegisterHistory(start, end, branchId, status?, pagination?)`
  - `listDeletedCashRegisterHistory(start, end, branchId, pagination?)`
  - `calculateCashRegisterSummary(cashRegisterId, branchId, dbOrTx?)`
- `openCashRegister` debe validar que no haya otra caja abierta en esa misma sucursal.
- `getOpenCashRegister` debe buscar la caja abierta de la sucursal del usuario.
- Cambiar las firmas de `saleService` para recibir `branchId`:
  - `calculateAvailability(productId, branchId)`
  - `calculateAvailabilityForProductIds(productIds, branchId)`
  - `validateCartAvailability(items, branchId, productIds?)`
  - `confirmSale({ items, paymentMethod, idempotencyKey, branchId })`
  - `cancelSale(id, reason, branchId)`
- `confirmSale` debe usar la caja abierta de la sucursal del usuario, validar que los productos pertenezcan a esa sucursal y grabar `sales.branchId`.
- `cancelSale` debe validar que la venta y su caja pertenezcan a la sucursal del usuario.
- Los resúmenes de caja deben calcularse filtrando productos por `branchId`.
- Cambiar las firmas de `closureService` para recibir `branchId`:
  - `generateClosure(date, branchId)`
  - `getClosureByDate(date, branchId)`
  - `listClosures(start, end, branchId, pagination?)`
- Los cierres diarios deben calcularse filtrando ventas y productos por `branchId`.

### Repositorios y API

- Actualizar los repositorios para filtrar por `branchId` en consultas de listado, búsqueda por rango y resúmenes. Todos los métodos `findAll`, `findActive`, `findInRange`, `findByDateRange`, `findByProductId`, `findByCashRegisterId`, etc. deben recibir `branchId`.
- Los métodos `findById` deben recibir `branchId` y validar que el registro pertenezca a la sucursal del usuario o retornar `null`.
- Cambiar firmas de repositorios para recibir `branchId` en `productRepository`, `cashRegisterRepository`, `saleRepository`, `recipeRepository`, `stockMovementRepository` y `dailyClosureRepository`.
- Las rutas de API y server actions deben obtener `branchId` de la sesión (mediante `requireAuth` o `getCurrentBranchId`) y pasarlo a los servicios. No confiar en `branchId` enviado por el cliente.
- Rutas y server actions a actualizar:
  - `src/app/api/caja/abrir/route.ts`, `src/app/api/caja/cerrar/route.ts`, `src/app/api/caja/route.ts`, `src/app/api/caja/resumen/route.ts`, `src/app/api/caja/historial/route.ts`, `src/app/api/caja/eliminadas/route.ts`, `src/app/api/caja/[id]/*`
  - `src/app/api/ventas/route.ts`, `src/app/api/ventas/disponibilidad/route.ts`, `src/app/api/ventas/[id]/anular/route.ts`
  - `src/app/api/productos/route.ts`, `src/app/api/productos/[id]/route.ts`, `src/app/api/productos/disponibilidad/route.ts`
  - `src/app/api/recetas/route.ts`
  - `src/app/api/stock/ajustar/route.ts`, `src/app/api/stock/movimientos/route.ts`, `src/app/api/stock/route.ts`
  - `src/app/api/cierre/route.ts`, `src/app/api/cierre/historial/route.ts`
  - `src/app/(panel)/productos/actions.ts`

### UI

- Mostrar el nombre de la sucursal en el panel (`panel-header.tsx`). Actualizar `PanelHeader` para recibir `branchName` junto con `userName`.
- Agregar accesos a `/panel/sucursales` y `/panel/usuarios` en el menú de navegación.
- Login sin cambios de UX salvo mensajes.
- Páginas de administración de sucursales y usuarios (mínimas): listado básico, formulario de creación y mensajes de error.

### Seeds y entorno

- `seeds.ts` debe crear la sucursal por defecto (usando `DEFAULT_BRANCH_NAME`) si no existe, asignarle el usuario admin y luego ejecutar `seedCatalog(defaultBranchId)`. El orden en `main` debe ser: sucursal por defecto → admin → catálogo.
- Si se define una variable de entorno para una segunda sucursal/usuario (`NEW_BRANCH_NAME`, `NEW_BRANCH_USERNAME`, `NEW_BRANCH_PASSWORD`), el seed puede crearlo de forma idempotente. No es obligatorio; el objetivo principal es la UI de administración.
- Actualizar `.env.example` agregando:
  - `DEFAULT_BRANCH_NAME`
  - `NEW_BRANCH_NAME` (opcional)
  - `NEW_BRANCH_USERNAME` (opcional)
  - `NEW_BRANCH_PASSWORD` (opcional)
- Mantener idempotencia: si el admin o la sucursal por defecto ya existen, no volver a crearlos.

### Tests

- Actualizar `authService.test.ts` para contemplar `branchId`.
- Actualizar `lib/auth.test.ts` para contemplar `branchId`.
- Actualizar tests de caja, ventas, productos, recetas, stock y cierres diarios para pasar `branchId`.
- Actualizar tests de repositorios (`productRepository.test.ts`, `cashRegisterRepository.test.ts`, `saleRepository.test.ts`, `recipeRepository.test.ts`, `stockMovementRepository.test.ts`, `dailyClosureRepository.test.ts`) para contemplar filtros por `branchId`.
- Agregar tests de aislamiento:
  - Un usuario de la sucursal A no puede ver ni modificar datos de la sucursal B.
  - `findById` de cualquier repositorio retorna `null` para un registro de otra sucursal.
  - No se puede abrir una caja en una sucursal si ya hay una abierta en esa misma sucursal, pero sí en otra.
  - No se puede generar un cierre diario duplicado para la misma sucursal y fecha.
- Actualizar `tests/e2e/global-setup.ts` para truncar y re-seedear también `users` y `branches`. El orden debe ser consistente con las foreign keys y usar `CASCADE`. Ejecutar `npx tsx src/db/seeds.ts` después del truncate.
- Actualizar `tests/e2e/helpers.ts` si es necesario para soportar login con credenciales de distintas sucursales.

## Archivos y áreas a tocar

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/index.ts" />
- <ref_file file="C:/developer/paginas/pancheria/drizzle.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />
- Nuevo: `src/types/next-auth.d.ts` (declaración de tipos para `branchId`).
- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/authService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/cashRegisterRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/saleRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/recipeRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/stockService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/stockMovementRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/closureService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/dailyClosureRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
- Rutas API: `src/app/api/caja/**`, `src/app/api/ventas/**`, `src/app/api/productos/**`, `src/app/api/recetas/**`, `src/app/api/stock/**`, `src/app/api/cierre/**`.
- Server actions: `src/app/(panel)/productos/actions.ts` y nuevas `src/app/(panel)/sucursales/actions.ts`, `src/app/(panel)/usuarios/actions.ts`.
- UI: `src/app/(panel)/layout.tsx`, `src/components/panel/panel-header.tsx`, `src/app/(panel)/page.tsx`, `src/app/(panel)/sucursales/page.tsx`, `src/app/(panel)/usuarios/page.tsx`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/actions.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/login-form.tsx" />
- Tests: `src/application/services/*.test.ts`, `src/repositories/*.test.ts`, `src/lib/auth.test.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts`.
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/global-setup.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- Generar migración con `npx drizzle-kit generate` y luego `npx drizzle-kit push`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, nombres de sucursal ni URLs de API en el código. El nombre de la sucursal por defecto debe venir de `DEFAULT_BRANCH_NAME`.
- Las credenciales deben seguir viniendo de variables de entorno para el seed; los usuarios creados desde la UI deben almacenarse hasheados.
- No confiar en `branchId` enviado por el cliente; siempre obtenerlo de la sesión autenticada en rutas API y server actions.
- `.env.local` no debe commitearse.
- Antes de aplicar la migración en producción, realizar un backup de la base de datos.
- Ejecutar tests E2E solo en bases de datos de prueba, ya que truncan tablas y re-seedean.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Detectar errores de estilo y tipado |
| `npx tsc --noEmit` | Verificar tipos estáticos |
| `npm run build` | Verificar build de producción |
| `npm test` | Ejecutar tests unitarios |
| `npm run test:e2e` (o `npx playwright test`) | Ejecutar tests E2E en base de prueba |
| `npx drizzle-kit generate` | Generar migraciones tras cambiar el esquema |
| `npx drizzle-kit push` | Aplicar migraciones en base de desarrollo/prueba |

## Notas de diseño

- Se eligió **catálogo por sucursal** para garantizar el aislamiento completo de stock, recetas y ventas. Si en el futuro se decide compartir el catálogo, el esquema debería separar el stock a una tabla `branch_stock` y cambiar el alcance de este prompt.
- Se mantiene una sola base de datos para todas las sucursales; cada sucursal es un tenant lógico.
- El login no muestra selector de sucursal para reducir errores de operadores; la sucursal está implícita en el usuario.
