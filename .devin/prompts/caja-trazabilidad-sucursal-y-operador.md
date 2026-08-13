# Prompt: Caja con trazabilidad de sucursal y operador e historial aislado

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, cierre de caja y usuarios multi-sucursal.

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

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/multi-sucursal.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/control-de-acceso-y-sucursales.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/roles-y-permisos.md>

## Estado actual relevante

El soporte multi-sucursal y el control de acceso por rol ya están implementados:

- `users.branchId` vincula a cada usuario con una única sucursal.
- `products`, `cash_registers`, `sales`, `stock_movements` y `daily_closures` tienen `branchId`.
- `cash_registers` ya almacena `openedBy` y `closedBy` como nombres de usuario.
- `getCurrentBranchId` en <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" /> devuelve la sucursal asignada para `operator` y la sucursal activa seleccionada por `admin`.
- `cashRegisterService.openCashRegister` y `closeCashRegister` reciben `branchId` y usuario.
- `productService` crea productos con `branchId` y aisla recetas por sucursal.
- `userService` solo permite crear usuarios `operator` vinculados a una sucursal.
- Las rutas API de caja, productos, ventas y recetas obtienen `branchId` desde `getCurrentBranchId(session)` y nunca del cliente.

## Objetivos pendientes

1. Reforzar la trazabilidad visible en el historial de cajas: agregar columnas "Abierta por" y "Cerrada por".
2. Mostrar el nombre de la sucursal activa en el detalle de caja cuando el usuario es `admin`.
3. Consolidar la UI de resumen de caja para evitar duplicación entre `CajaPanel`, `CajaStatus`, `cierre/[id]/page.tsx` y `ventas/historial/[id]/page.tsx`.
4. Agregar tests de aislamiento explícitos que verifiquen que `findById` de cajas, productos y ventas retorna `null` para otra sucursal.
5. Verificar que las lecturas de recetas en `saleService` y `summaryService` filtran o validan correctamente por `branchId`.
6. Asegurar que el historial de ventas (`/ventas/historial`) muestre sucursal y operador cuando el usuario es `admin`.

## Reglas de negocio

1. Una caja pertenece a una única sucursal (`cash_registers.branchId`).
2. Solo puede haber una caja abierta por sucursal.
3. `openedBy` y `closedBy` deben ser el nombre del usuario autenticado en la sesión (`session.user.name` con fallback controlado).
4. El `operator` solo puede listar, consultar, abrir, cerrar y anular datos de su sucursal asignada.
5. El `admin` puede cambiar la sucursal activa mediante el selector del panel; todas las operaciones de caja, ventas, productos y stock deben usar la sucursal activa.
6. Productos, recetas, promos y servicios deben filtrarse por `branchId`; una receta no puede vincular productos de otra sucursal.
7. Todo `findById` de repositorios debe retornar `null` si el registro pertenece a otra sucursal.
8. No se hardcodean IDs, nombres de sucursal, nombres de usuario ni credenciales.
9. El rol `admin` solo se crea en el seed; la UI solo permite crear usuarios `operator`.
10. Las variables sensibles siempre provienen de `.env.local` o de configuraciones dinámicas.

## Implementación detallada

### Backend

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
  - Verificar que `cash_registers.branchId`, `cash_registers.openedBy` y `cash_registers.closedBy` existen.
  - Verificar índices que impidan más de una caja abierta por sucursal (`cash_registers_open_status_idx` parcial por `branchId, status`).

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />
  - `openCashRegister` recibe `branchId` y `openedBy` y los asigna.
  - `closeCashRegister` recibe `branchId`, `id` y `closedBy`; valida que la caja exista y pertenezca a la sucursal.
  - `getOpenCashRegister` debe devolver solo la caja de la sucursal indicada; si hay una abierta en otra sucursal, no debe afectar a la consulta actual.
  - **Pendiente**: agregar tests que verifiquen `openedBy`, `closedBy` y `branchId` al abrir y cerrar caja, y que `getOpenCashRegister(branchId)` no devuelva una caja de otra sucursal.

- <ref_file file="C:/developer/paginas/pancheria/src/repositories/cashRegisterRepository.ts" />
  - `findOpen`, `findById`, `findInRange` y `findDeletedInRange` filtran por `branchId`.
  - `findById` retorna `null` cuando la caja existe pero pertenece a otra sucursal.
  - **Pendiente**: agregar test de `findById` con `branchId` incorrecto que espere `null`.

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/abrir/route.ts" />
  - Usar `session.user.name` como `openedBy` (con fallback `"Usuario"` si no estuviera presente).
  - No permitir abrir caja sin `branchId` válido.

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/cerrar/route.ts" />
  - Usar `session.user.name` como `closedBy`.
  - Si no se recibe `id`, cerrar la caja abierta de la sucursal activa.

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/historial/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/resumen/route.ts" />
  - Obtener `branchId` con `getCurrentBranchId(session)` y nunca aceptarlo del cliente.
  - Para `admin`, el `branchId` es el de la sucursal activa; para `operator`, el de la sesión.

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />
  - `createProduct` asigna el `branchId` actual.
  - `updateProduct` y `deleteProduct` validan que el producto pertenezca a la sucursal.
  - `listActiveProductsWithAvailability` calcula disponibilidad solo con productos de la misma sucursal.

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" />
  - `saveRecipe` valida que todos los insumos y el producto compuesto pertenezcan a la misma sucursal.

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" />
  - Revisar que las consultas de recetas (`db.query.recipes.findMany`) filtran o validan por `branchId` cuando se usan para calcular disponibilidad, confirmar ventas o anular ventas.
  - Si no filtran por `branchId`, agregar la validación o documentar por qué es seguro (IDs globales + `recipeService.saveRecipe` ya valida pertenencia).

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" />
  - `createUser` asigna `branchId` y fuerza `role = 'operator'`.
  - `updateUser` solo permite editar usuarios `operator`; bloquear explícitamente cualquier rol distinto de `operator` si la validación actual no lo hace.

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/ventas/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/productos/route.ts" />
  - Confirmar que `GET` y `POST` usan `getCurrentBranchId(session)` y, cuando corresponde, `requireAdmin`.
  - Nota: estos archivos no tienen `PUT`, `PATCH` ni `DELETE`; si se agregan en el futuro, deben seguir el mismo patrón.

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/recetas/route.ts" />
  - Confirmar que `GET` y `POST` usan `requireAdmin` y `getCurrentBranchId`.

### Frontend

- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" />
  - Ya muestra `openedBy`; verificar que el mensaje de apertura respete la sucursal actual.
  - Mostrar el nombre de la sucursal activa cuando el usuario es `admin`.

- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" />
  - Ya muestra `openedBy`.
  - Considerar unificar con `CajaPanel` o con el futuro componente compartido de resumen.

- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-history.tsx" />
  - **Pendiente**: agregar columnas "Abierta por" y "Cerrada por" en el historial de cajas.
  - **Opcional**: para `admin`, agregar columna "Sucursal" y permitir filtrar por sucursal activa (reutilizar `BranchSelector` de la navbar o un selector local que invoque `setActiveBranchAction`).

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />
  - Mostrar `openedBy`, `closedBy` y, para `admin`, el nombre de la sucursal.
  - Verificar que un `operator` no pueda acceder al detalle de una caja de otra sucursal (`notFound` o `403`).
  - Refactorizar para compartir el resumen de caja con un componente común (ver sección de refactor).

- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />
  - Mantener el selector de sucursal solo para `admin`; el `operator` siempre ve el nombre de su sucursal asignada.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" />
  - Verificar que solo `admin` pueda acceder a la gestión de productos.

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/actions.ts" />
  - Mantener el listado de todos los usuarios para `admin`, mostrando la sucursal asignada.
  - Forzar `role = 'operator'` al crear usuarios.

### Refactor sugerido: componente compartido de resumen de caja

Crear un componente reutilizable (por ejemplo, `src/components/caja/cash-register-summary.tsx`) que reciba un `CashRegister` y el nombre de la sucursal, y renderice:

- ID y estado.
- Fechas de apertura y cierre, duración.
- `openedBy` y `closedBy`.
- Indicador de cierre automático.
- Totales (efectivo, transferencia, ventas).
- Resúmenes de productos e insumos críticos.

Reemplazar las secciones duplicadas en:

- `src/components/caja/caja-panel.tsx`
- `src/components/caja/caja-status.tsx`
- `src/app/(panel)/cierre/[id]/page.tsx`
- `src/app/(panel)/ventas/historial/[id]/page.tsx`

Esto reduce duplicación y garantiza que futuros cambios (como agregar el nombre de sucursal) se apliquen en un solo lugar.

### Tests

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.test.ts" />
  - Agregar tests que verifiquen `openedBy`, `closedBy` y `branchId` al abrir y cerrar caja.
  - Verificar que `getOpenCashRegister(branchId)` no devuelva una caja de otra sucursal.

- <ref_file file="C:/developer/paginas/pancheria/src/repositories/cashRegisterRepository.test.ts" />
  - Agregar test de aislamiento: `findById(branchId, id)` retorna `null` cuando la caja existe pero pertenece a otra sucursal.

- <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.test.ts" />
  - Agregar test de aislamiento: `findById(branchId, id)` retorna `null` para un producto de otra sucursal.

- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.test.ts" />
  - Agregar test de aislamiento: un producto de la sucursal A no es visible ni editable desde la sucursal B.

- `tests/e2e/`
  - Login como `operator` de la sucursal A; abrir caja; confirmar que aparece en el historial y en el panel con su nombre.
  - Login como `operator` de la sucursal B; intentar consultar la caja de la sucursal A y confirmar que no es accesible.
  - Login como `admin`; cambiar de sucursal activa; verificar que el catálogo y el historial cambian según la sucursal seleccionada.
  - Crear un producto como `admin` en una sucursal; cambiar a otra sucursal y verificar que no aparece en el catálogo.

### Seeds y migraciones

- <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
  - El seed ya crea la sucursal por defecto, el `admin` y el catálogo. Verificar que `seedCatalog` asigna `branchId` a todos los productos y que las recetas se crean entre productos de la misma sucursal.
  - Si se opta por agregar `openedByUserId`/`closedByUserId`, generar una migración controlada que agregue las columnas nullable, las popule con los IDs actuales usando una JOIN con `users` por `username`, y luego ajuste `NOT NULL` si corresponde.

## Archivos y áreas a tocar

- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/cashRegisterService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/repositories/cashRegisterRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/abrir/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/cerrar/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/historial/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/caja/resumen/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-history.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/[id]/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/ventas/historial/[id]/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/recipeService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/userService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/usuarios/actions.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />
- `src/components/caja/cash-register-summary.tsx` (nuevo componente compartido)
- Tests unitarios de servicios y repositorios.
- Tests E2E en `tests/e2e/`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, nombres de sucursal, nombres de usuario ni URLs de API.
- `.env.local` no debe commitearse.
- Las rutas API deben obtener `branchId` siempre desde la sesión (`getCurrentBranchId`) y nunca desde el cliente.
- El `admin` cambia de sucursal activa a través de la cookie `activeBranchId` configurada con `httpOnly`, `sameSite: 'lax'` y `secure` en producción.
- Ejecutar tests E2E únicamente en una base de datos de prueba; `tests/e2e/global-setup.ts` trunca tablas y re-seedea.
- Si se modifica el esquema, usar `npx drizzle-kit generate` y `npx drizzle-kit push` en un entorno de prueba primero.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificar tipos |
| `npm run lint` | Detectar errores de estilo |
| `npm test` | Ejecutar tests unitarios |
| `npm run build` | Verificar build de producción |
| `npm run test:e2e` (o `npx playwright test`) | Validar flujos de caja, acceso por sucursal y catálogo aislado |
| `npm run dev` | Validación manual: login como `admin`, cambiar sucursal, crear caja, login como `operator` de otra sucursal y verificar aislamiento |
| `npx drizzle-kit push` | Solo si se agregan columnas de trazabilidad de usuario |

## Decisiones de diseño

1. **¿Se requiere agregar `openedByUserId` y `closedByUserId` en `cash_registers`?**
   - **Decisión**: no en esta iteración. Basta con `openedBy` y `closedBy` como nombres de usuario, siempre obtenidos desde `session.user.name` con fallback controlado. Si en el futuro se requiere auditoría robusta ante cambios de nombre de usuario, se puede agregar una migración opcional que agregue columnas nullable y las popule desde `users.id`.

2. **¿El `admin` necesita una vista consolidada del historial de cajas de todas las sucursales en una sola pantalla?**
   - **Decisión**: no. El administrador cambia de sucursal activa mediante el `BranchSelector`; esto mantiene la coherencia con el resto del sistema (`productos`, `stock`, `ventas`) y simplifica los permisos. Si más adelante se requiere una vista consolidada, se evaluará como feature separada.

3. **¿El historial de ventas (`/ventas/historial`) también debe mostrar la sucursal y el operador que la registró para el `admin`?**
   - **Decisión**: sí, en el detalle de caja y en la lista de ventas se debe mostrar `openedBy` y el nombre de la sucursal activa cuando el usuario es `admin`. Esto requiere extender la UI de ventas para incluir esos campos sin romper la vista del `operator`.
