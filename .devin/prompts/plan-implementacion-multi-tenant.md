# Prompt: Plan de implementación — plataforma multi-tenant compartida

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- *(El informe estratégico de franquicia/SaaS aún no existe; este prompt actúa como punto de partida para definirlo si se avanza con el modelo multi-tenant.)*
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />

## Estado actual relevante

El sistema soporta múltiples sucursales (`branches`) con aislamiento por `branchId`. Los usuarios tienen `role` (`admin` / `operator`) y `branchId`. Las consultas filtran por `branchId`. No existe un concepto superior de `tenant` u `organization`; todas las sucursales pertenecen al mismo dueño implícito. El catálogo público resuelve la sucursal por `?branchId` o por `DEFAULT_BRANCH_NAME` (<ref_file file="C:/developer/paginas/pancheria/src/lib/branch-resolver.ts" />). La autenticación almacena `branchId` y `role` en el token JWT (<ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />).

## Objetivo

Transformar la aplicación en una plataforma multi-tenant compartida: una sola base de datos, una sola aplicación, muchos clientes. Cada cliente es un `tenant` con sus propias sucursales, usuarios, productos, pedidos, ventas, etc. El aislamiento debe ser por filas (`tenantId`) en todas las entidades de negocio.

**Modelo de operación confirmado:**
- Un único `superadmin` (equipo de ventas/operaciones) da de alta, modifica, suspende y elimina comercios manualmente.
- No hay checkout ni cobro automático dentro de la plataforma por el momento.
- La mensualidad se cobra fuera del sistema (contrato, transferencia, etc.) y el superadmin controla el estado `active`/`suspended`.
- El alcance inicial es de **10 a 50 comercios**.
- La resolución de tenant se hace principalmente por **subdominio** (`donpancho.tuapp.com`) con fallback a query param.

## Reglas de negocio

1. Un `tenant` representa un comercio cliente. Puede tener muchas `branches`.
2. Todo usuario pertenece a un único `tenant` y a una única `branch` (la suya o la default del admin).
3. Un usuario nunca puede cambiar de `tenant`. El admin de un tenant solo puede ver y gestionar datos de su tenant.
4. El `superadmin` es una única persona del equipo de ventas/operaciones. Puede crear, editar, suspender y eliminar tenants desde `/superadmin`.
5. El alta de un nuevo comercio no es self-service. El superadmin crea el tenant, la sucursal inicial, el usuario admin y el subdominio.
6. No hay checkout ni cobro automático en la plataforma. El estado del tenant (`active`/`suspended`) refleja el pago de la mensualidad gestionado fuera del sistema.
7. El catálogo público (`/pedido`) se resuelve por subdominio del tenant. Si no hay mapeo, se usa un tenant por defecto (`DEFAULT_TENANT_SLUG`).
8. Los datos públicos de un tenant (catálogo, pedidos, chat) no requieren autenticación, pero siempre deben filtrarse por `tenantId`.
9. El login debe resolver el `tenant` implícitamente (por subdominio/dominio) o pedir el `tenantSlug`. El `username` debe ser único dentro del `tenant`.
10. Todos los repositorios y servicios deben validar que el `branchId` pertenezca al `tenantId` actual antes de operar.
11. La migración de datos existentes debe crear el tenant `default` (para los datos históricos) y el tenant `platform` (para el superadmin), asignando todas las filas actuales al tenant `default`.
12. Las personalizaciones por tenant (logo, colores, WhatsApp, mensajes, horarios) deben almacenarse en `tenant_settings`, no hardcodearse ni depender únicamente de `process.env`.
13. Los movimientos de stock, ventas, pedidos, cajas, cierres y videos deben incluir `tenantId` además de `branchId`.
14. El borrado lógico de un tenant debe conservar los datos pero bloquear todo acceso nuevo.

## Implementación detallada

### Fase 1 — Esquema de base de datos y migración

#### 1.1 Nuevas tablas

En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> agregar:

- `tenants`:
  - `id: serial().primaryKey()`
  - `slug: varchar().notNull().unique()` (identificador de URL, ej. `donpancho`)
  - `name: varchar().notNull()`
  - `status: enum('active', 'suspended')` (el borrado lógico se hace con `deletedAt`, como en el resto del esquema; no incluir `'deleted'` en este enum)
  - `isPlatform: boolean().default(false)` (identifica si el tenant es la plataforma; solo `true` para el tenant `platform` del superadmin; todos los comercios clientes, incluido `default`, son `false`)
  - `billingEmail: varchar()`
  - `plan: varchar()`
  - `billingStartDate: timestamp()` (fecha de inicio de facturación manual; puede ser null hasta que el superadmin la asigne)
  - `billingDueDate: timestamp()` (fecha de vencimiento de la mensualidad; controlada por el superadmin)
  - `createdAt`, `updatedAt`, `deletedAt`
  - índices por `slug`, `status`, `deletedAt`.

- `tenant_domains`:
  - `id: serial().primaryKey()`
  - `tenantId: integer().references(tenants.id)`
  - `domain: varchar().notNull().unique()` (dominio o subdominio)
  - `isPrimary: boolean()`
  - `createdAt`
  - índice por `tenantId`, `domain`.

- `tenant_settings`:
  - `id: serial().primaryKey()`
  - `tenantId: integer().references(tenants.id).unique()` (una fila por tenant)
  - `defaultBranchId: integer().references(() => branches.id)` (sucursal default para el catálogo público del tenant)
  - `logoUrl: text()`
  - `primaryColor: varchar()`
  - `whatsappNumber: varchar()`
  - `whatsappMessageGreeting: text()`
  - `whatsappMessageClosing: text()`
  - `publicAppName: varchar()`
  - `timezone: varchar()`
  - `currency: varchar()`
  - `jsonb` adicional si se requiere flexibilidad.

- `subscriptions` (opcional, sin cobro automático):
  - `id: serial().primaryKey()`
  - `tenantId`
  - `plan`, `price`, `status`, `startDate`, `endDate`, `billingCycle`.
  - Se usa solo para registro histórico. El cobro se gestiona fuera de la plataforma.

- `tenant_audit_logs` (opcional pero recomendado):
  - `id`, `tenantId`, `userId`, `action`, `entity`, `entityId`, `metadata` (jsonb), `createdAt`.

#### 1.2 Modificar tablas existentes

Agregar `tenantId` (nullable inicialmente para la migración de datos, not null al finalizar) a:
- `branches`
- `users`
- `products`
- `recipes` (inferir el `tenantId` del producto compuesto durante la migración)
- `cash_registers`
- `sales`
- `sale_items`
- `orders`
- `order_items`
- `order_stock_reservations`
- `order_messages`
- `stock_movements`
- `daily_closures`
- `videos`
- `public_order_rate_limits` (cambiar la clave primaria a `(tenantId, ip)`)
- `login_attempts` (cambiar la clave primaria a `(tenantId, username)`)

**Notas:**
- `recipes` no tiene `branchId`; en la migración se le debe asignar el `tenantId` del `compoundProductId`.
- `order_stock_reservations` ya tiene `branchId`; se le agrega `tenantId` con el resto de las entidades de negocio.

#### 1.3 Claves foráneas e índices

- `branches.tenantId` → `tenants.id` (onDelete restrict). `branches.name` deja de ser única global y pasa a ser `(tenantId, name)`.
- `users.tenantId` → `tenants.id` y `users.branchId` → `branches.id`.
- `products.tenantId` + `products.branchId`.
- `recipes.tenantId` y un índice por `(tenantId, compoundProductId)`.
- `order_stock_reservations.tenantId` e índice por `(tenantId, branchId, productId)`.
- `public_order_rate_limits`: cambiar clave primaria de `ip` a `(tenantId, ip)`.
- `login_attempts`: cambiar clave primaria de `username` a `(tenantId, username)`.
- Reemplazar `uniqueIndex` existentes que usen solo `branchId` por `tenantId + branchId` cuando aplique. Por ejemplo:
  - `orders_order_number_unique_idx` → `(tenantId, branchId, orderNumber)`.
  - `sales_idempotency_branch_unique_idx` → `(tenantId, branchId, idempotencyKey)`.
  - `daily_closures_branch_date_unique_idx` → `(tenantId, branchId, date)`.
  - `cash_registers_open_status_idx` → `(tenantId, branchId, status)` where open.
- `users.username`: el unique debe ser por `(tenantId, username)`.

#### 1.4 Migración de datos

- Generar migración con `npx drizzle-kit generate` y revisarla antes de aplicarla.
- La migración debe ejecutarse en una transacción atómica y:
  1. Crear tablas `tenants`, `tenant_domains`, `tenant_settings`, `subscriptions`.
  2. Agregar columnas `tenantId` nullable a las tablas existentes.
  3. Insertar los tenants iniciales:
     - `platform` (`slug = 'platform'`, `isPlatform = true`, `name = 'Plataforma'`) para el superadmin.
     - `default` (`slug = 'default'`, `isPlatform = false`, `name` desde `DEFAULT_TENANT_NAME` o un valor por defecto) para los datos históricos.
  4. Crear una sucursal inicial en el tenant `platform` (p. ej. `Sucursal Plataforma`) para poder asignar el superadmin.
  5. Inferir y actualizar `tenantId` en cada tabla existente a partir de sus relaciones:
     - `branches`, `users`, `products`, `cash_registers`, `sales`, `orders`, etc.: desde `branchId` vía join con `branches`, asignando el tenant `default`.
     - `recipes`: desde `compoundProductId` vía join con `products`.
     - `sale_items`, `order_items`: desde `productId` (o desde `saleId`/`orderId`) vía join.
     - `stock_movements`: desde `branchId` o `productId`.
     - `order_stock_reservations`: desde `branchId` o `orderId`.
  6. Hacer `tenantId` not null.
  7. Crear FKs e índices.
  8. Truncar y recrear `login_attempts` y `public_order_rate_limits` con claves primarias compuestas:
     - `login_attempts` PK `(tenantId, username)`.
     - `public_order_rate_limits` PK `(tenantId, ip)`.
     - Estas tablas contienen datos volátiles; no requieren migración de filas.

- Actualizar `src/db/seeds.ts` (<ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />) para:
  1. Crear el tenant `platform` (si no existe) y su sucursal inicial.
  2. Crear el superadmin (`SUPERADMIN_USERNAME`/`SUPERADMIN_PASSWORD`) asignado al tenant `platform` y a su sucursal.
  3. Crear el tenant `default` (si no existe) y su sucursal inicial.
  4. Crear el admin inicial (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) asignado al tenant `default` y a su sucursal.
  5. Asignar `tenantId` a todo producto, receta, etc.

### Fase 2 — Resolución de tenant

#### 2.1 Nuevo módulo `src/lib/tenant-resolver.ts`

Debe exponer:

```ts
export interface ResolvedTenant {
  tenantId: number;
  slug: string;
  name: string;
  settings: TenantSettings | null;
  primaryDomain: string | null;
}

export async function resolveTenantByHostname(hostname: string): Promise<ResolvedTenant | null>;
export async function resolveTenantBySlug(slug: string): Promise<ResolvedTenant | null>;
export async function resolveTenantById(id: number): Promise<ResolvedTenant | null>;
export async function getDefaultTenant(): Promise<ResolvedTenant | null>;
```

Reglas:
- Primero buscar en `tenant_domains` por `domain` exacto (dominio o subdominio).
- Si no hay coincidencia y el hostname termina en `PLATFORM_DOMAIN` (por ejemplo `donpancho.tuapp.com`), extraer el subdominio y buscar por `slug`.
- Si no se encuentra y la ruta es pública o de panel de comercio, fallback a `DEFAULT_TENANT_SLUG` (variable de entorno).
- Si la ruta es de superadmin (`/superadmin` o `/api/superadmin/*`) y no hay subdominio, fallback al tenant `platform` (`isPlatform = true`).
- Si el tenant está `suspended` o `deleted`, devolver una página de mantenimiento/403 controlada.

**Notas técnicas:**
- En Vercel, el wildcard de subdominios (`*.tuapp.com`) requiere un plan que lo soporte y configuración de DNS. No funciona en `vercel.app`.
- Los dominios personalizados de clientes requieren añadirse al proyecto o gestionarse vía la API de Vercel / un reverse proxy.
- Nunca confiar solo en `id = 1` como fallback; usar `slug` para identificar al tenant default y `isPlatform` para identificar el tenant `platform`.

#### 2.2 Integración con `src/lib/branch-resolver.ts`

- `getDefaultBranchId(tenantId)` resuelve la sucursal default de un tenant:
  - Primero lee `tenant_settings.defaultBranchId` del tenant.
  - Si no está configurada, busca la primera sucursal activa del tenant ordenada por `createdAt`.
  - Si no existe ninguna, devuelve `null`.
- `listPublicBranches` debe filtrar por `tenantId`.
- `parseBranchId` se mantiene.
- Agregar `getDefaultBranchIdOrRedirect(tenantId)` para rutas públicas.
- Crear `resolveBranchFromRequest(request, tenantId)` que combine `branchId` del query param con la validación de que la sucursal pertenezca al tenant.

#### 2.3 Uso en rutas públicas

- `/pedido` y `/pedido/[id]/chat` deben resolver el tenant por `hostname` o por `?tenant=slug`.
- El punto de entrada de cada Server Component y route handler público debe ejecutar `runWithTenant(tenantId, branchId, async () => { ... })` antes de llamar a servicios o repositorios.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" /> debe:
  - Leer `tenant` de `request.headers.get('host')` o de query param `tenant`.
  - Obtener `tenantId`.
  - Resolver `branchId` por query o por default dentro del tenant usando `getDefaultBranchId(tenantId)`.
  - Devolver productos filtrados por `tenantId` y `branchId`.

- `src/app/api/public/pedido/route.ts` y subrutas deben filtrar por `tenantId`.

### Fase 3 — Autenticación y autorización

#### 3.1 Sesión

Actualizar el enum `user_role` en `src/db/schema.ts` a `['superadmin', 'admin', 'operator']` y regenerar migraciones.

En <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />:
- El callback `jwt` debe incluir `tenantId` y `tenantSlug`.
- El callback `session` debe incluir `user.tenantId` y `user.tenantSlug`.
- El `role` del superadmin es `superadmin`.
- Actualizar `src/types/next-auth.d.ts` (<ref_file file="C:/developer/paginas/pancheria/src/types/next-auth.d.ts" />) para extender `User`, `Session` y `JWT` con `tenantId: number` y `tenantSlug: string`.

En <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />:
- El callback `authorize(credentials, request)` recibe el `request`. A partir de `request.headers.get('host')` o del campo `tenantSlug` en `credentials` se resuelve el `tenantId`.
- Si el hostname ya identifica al tenant (subdominio o dominio en `tenant_domains`), no se requiere campo adicional.
- Si el hostname no identifica al tenant (p. ej. `localhost` o raíz del dominio), el formulario muestra un campo `tenantSlug`.
- Para el login del superadmin, si no hay subdominio se usa el slug `platform` o el hostname raíz con fallback al tenant `isPlatform = true`.
- El `tenantId` resuelto se establece en `runWithTenant(tenantId, branchId, ...)` antes de llamar a `authService.verifyCredentials`.
- Buscar el usuario por `username` + `tenantId` (nunca solo por `username`).
- El superadmin debe estar asignado a una sucursal del tenant `platform` para cumplir `users.branchId` NOT NULL.
- Devolver `tenantId`, `tenantSlug`, `branchId`, `branchName` y `role`.

#### 3.2 Helpers de auth

En <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />:
- `getCurrentTenantId(session?)` devuelve `tenantId` del token, del contexto (`tenant-context.ts`) o de la cookie/hostname.
- `getCurrentTenantIdOrRedirect` redirige si no hay tenant.
- `getCurrentBranchId(session?)` devuelve `branchId` del contexto; si usa el token, debe verificar que la sucursal activa pertenezca al `tenantId` actual con `validateBranchInTenant`.
- `requireSuperAdmin` valida `role === 'superadmin'`.
- `requireTenantAdmin` valida `role === 'admin'` dentro del tenant actual.

En <ref_file file="C:/developer/paginas/pancheria/src/lib/with-auth.ts" />:
- `AuthContext` debe incluir `tenantId` y `tenantSlug`.
- `withAuth` debe establecer el contexto de tenant (`runWithTenant`) antes de ejecutar el handler, inyectar `tenantId`, y validar que `branchId` pertenezca al `tenantId`.
- `withSuperAdmin` no requiere `branchId`; solo valida que `session.user.role === 'superadmin'` y que el token contenga `tenantId` del tenant `platform`.

#### 3.3 Nombres de usuario y rate limit de login

- Cambiar `users.username` unique a `(tenantId, username)`.
- Actualizar `authService.verifyCredentials` para buscar por `username` dentro del `tenantId` del contexto (`getCurrentTenantId()`). Conserva la firma `verifyCredentials(username, password)` y lee el tenant del contexto.
- Actualizar `src/lib/rate-limit-store.ts` para usar `(tenantId, username)` como clave, obteniendo `tenantId` del contexto. Tanto `InMemoryRateLimitStore` como `DbRateLimitStore` deben manejar la clave compuesta.
- Si no se puede resolver el tenant por hostname, pedir `tenantSlug` en el formulario de login (nunca usar `slug:usuario` porque rompe la UX y la separación de responsabilidades).

### Fase 4 — Repositorios y servicios

#### 4.1 Contexto de tenant con `AsyncLocalStorage`

Para no reescribir la firma de decenas de repositorios y servicios, se usa el mismo patrón que `transactionService.ts` (<ref_file file="C:/developer/paginas/pancheria/src/application/transactionService.ts" />):

- Crear `src/lib/tenant-context.ts` basado en `AsyncLocalStorage`:
  - `runWithTenant(tenantId, branchId, fn)` — punto de entrada en handlers, layouts, server actions y `authorize`.
  - `getCurrentTenantId()`: devuelve el `tenantId` activo.
  - `getCurrentBranchId()`: devuelve el `branchId` activo.
  - `getCurrentTenant()` y `getCurrentBranch()` (opcionales).

#### 4.2 Patrón de repositorios

Los repositorios leen `tenantId` y `branchId` del contexto. Solo se mantienen explícitos los IDs de entidades concretas (`productId`, `orderId`, `saleId`, etc.).

Ejemplo en <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" />:

```ts
export async function findAll(includeDeleted = false): Promise<ProductRow[]> {
  const tenantId = getCurrentTenantId();
  const branchId = getCurrentBranchId();

  const conditions = [
    eq(products.tenantId, tenantId),
    eq(products.branchId, branchId),
  ];
  ...
}
```

Toda query de negocio debe incluir `tenantId` y, cuando aplique, `branchId`. Nunca confiar solo en `branchId`.

#### 4.3 Servicios

Actualizar todos los servicios en <ref_file file="C:/developer/paginas/pancheria/src/application/services" /> para ejecutarse dentro del contexto de tenant. Los servicios:
- Leen `tenantId`/`branchId` con `getCurrentTenantId()` / `getCurrentBranchId()`.
- Validan que la sucursal pertenezca al tenant actual con `validateBranchInTenant()`.
- Reciben explícitos solo los IDs de las entidades sobre las que operan.

Servicios nuevos:
- `tenantService.ts`: CRUD de tenants, dominios, settings.
- `tenantProvisioningService.ts` (antes `onboardingService.ts`): crear tenant + branch + admin desde `/superadmin` (con rate limit y validación de dominio/slug).
- `subscriptionService.ts`: gestión básica de planes (fase futura; no bloquear el MVP si no se va a cobrar).
- `superadminService.ts`: listar tenants, suspender, reactivar, etc.

Servicios a actualizar obligatoriamente:
- `authService.ts`: `verifyCredentials(username, password)` se ejecuta dentro de un contexto de tenant resuelto previamente; busca `username` dentro del `tenantId` actual.
- `branchService.ts`: todas las operaciones filtran por `tenantId` del contexto; `copyCatalogToBranch` recibe `sourceBranchId` y `targetBranchId`, y usa el `tenantId` del contexto.
- `productService.ts` y `recipeService.ts`: propagan `tenantId` en la creación de productos y recetas.
- `orderService.ts`, `saleService.ts`, `stockService.ts`, `cashRegisterService.ts`, `closureService.ts`, `summaryService.ts`: validan que todos los `branchId` pertenecen al `tenantId` actual.

#### 4.4 Helpers de negocio

- Crear `src/lib/tenant-helpers.ts` con:
  - `validateBranchInTenant(branchId)`: devuelve la sucursal o lanza `ForbiddenError`/`NotFoundError`; usa `getCurrentTenantId()`.
  - `validateUserInTenant(userId)`.
  - `resolveTenantFromRequest(request)`: envoltorio para obtener `tenantId` desde hostname o query param.
- Actualizar `src/lib/product-helpers.ts`, `sale-helpers.ts`, `order-helpers.ts`, `stock-helpers.ts`, `cash-register-helpers.ts`, etc., para leer `tenantId`/`branchId` del contexto cuando reciben `branchId`.

### Fase 5 — Rutas API

#### 5.1 API pública (`/api/public/*`)

- Todas las rutas deben resolver `tenantId` desde `request.headers.get('host')` o query param `tenant`.
- Cada handler debe ejecutar `runWithTenant(tenantId, branchId, () => handler(...))` para que servicios y repositorios lean el contexto.
- Aplicar rate limit con `tenantId + IP` usando `public_order_rate_limits` con clave `(tenantId, ip)`.
- Catálogo, pedidos, chat, estado: filtrar por `tenantId` y `branchId`.
- El catálogo (`/api/public/catalogo`) debe leer `whatsappNumber`, `greeting` y `closing` desde `tenant_settings`, con fallback a las env vars globales durante la transición.

#### 5.2 API del panel (`/api/*`)

- Usar `withAuth` o `withSuperAdmin`.
- `withAuth` resuelve el `tenantId` desde la sesión, establece el contexto de tenant con `runWithTenant` y luego ejecuta el handler.
- `withSuperAdmin` resuelve el superadmin desde la sesión, valida `role === 'superadmin'`, valida que su `tenantId` corresponda al tenant `platform` y establece el contexto con `runWithTenant(tenantId, branchId, ...)` para llamar a `superadminService`.
- Validar `branchId` contra `tenantId`.

#### 5.3 API de superadministrador

Nuevas rutas bajo `/api/superadmin/*`:
- `GET /api/superadmin/tenants`
- `POST /api/superadmin/tenants` — crea el tenant, la sucursal inicial, el usuario admin, el subdominio y la fila inicial de `tenant_settings` con `defaultBranchId`.
- `GET /api/superadmin/tenants/[id]`
- `PATCH /api/superadmin/tenants/[id]`
- `DELETE /api/superadmin/tenants/[id]` (soft delete)
- `POST /api/superadmin/tenants/[id]/suspend`
- `POST /api/superadmin/tenants/[id]/domains`
- `GET /api/superadmin/tenants/[id]/subscriptions`

Todas protegidas por `withSuperAdmin`.
- `withSuperAdmin` valida `role === 'superadmin'` y que el `tenantId` de la sesión sea el tenant `platform`.
- No requieren `branchId` porque operan sobre la plataforma, no sobre una sucursal.
- El alta manual invoca `tenantProvisioningService.createTenant(...)`, no un onboarding público.

**Nota:** no hay onboarding público. El alta es manual y la realiza el superadmin desde el panel.

### Fase 6 — UI y rutas del panel

#### 6.1 Nuevas páginas (solo superadmin)

- Crear el route group `src/app/(superadmin)/` con su propio `layout.tsx`.
- `/superadmin` — dashboard de tenants:
  - Listado con búsqueda y filtros.
  - Botón "Crear comercio" con formulario.
  - Acciones: ver, editar, suspender, eliminar, gestionar dominios y plan.

- `/superadmin/tenants/[id]/page.tsx` — detalle de comercio.
- `/superadmin/tenants/nuevo/page.tsx` — formulario de alta de comercio (tenant + sucursal + admin).
- `/superadmin/tenants/[id]/dominios/page.tsx` — gestión de subdominios.
- `/superadmin/tenants/[id]/suscripciones/page.tsx` — gestión manual del plan y estado.

Protección de acceso:
- El layout de `(superadmin)` debe llamar `requireSuperAdmin()` y redirigir a `/login` si no hay sesión o no tiene rol `superadmin`.
- Actualizar `src/lib/route-guard.ts` y `src/proxy.ts` para que `/superadmin` no sea ruta pública y requiera autenticación.
- Agregar las rutas de superadmin en `src/config/routes.ts`.

No hay `/onboarding` público: el alta la realiza el equipo de ventas/operaciones desde `/superadmin`.

#### 6.2 Panel del tenant

- El selector de sucursales debe mostrar solo sucursales del tenant actual.
- El admin de tenant puede ir a `/sucursales`, `/usuarios`, `/productos`, etc., sin ver otros tenants.
- Header puede mostrar el nombre del tenant y su logo desde `tenant_settings`.
- Si el login no se resuelve por hostname, mostrar un campo `tenantSlug` en el formulario.

#### 6.3 Catálogo público

- `/pedido` y `/pedido/[id]/chat` resuelven el tenant principalmente por **subdominio** (`donpancho.tuapp.com`).
- Query param `?tenant=slug` se mantiene como fallback para pruebas, desarrollo y transición.
- Mostrar logo, nombre y WhatsApp del tenant (desde `tenant_settings` o fallback de env vars).
- **Entrega de `tenant_settings` al cliente:**
  - El Server Component (`PedidoCatalog`) debe cargar `tenant_settings` resuelto por `tenantId` y pasarlo como prop a `PedidoClient`.
  - `PedidoClient` recibe `tenantSettings` (logo, color, WhatsApp, mensajes, nombre público, timezone) y lo usa en lugar de leer `process.env.NEXT_PUBLIC_*`.
  - Las respuestas de `/api/public/catalogo` y `/api/public/pedido` también pueden devolver `tenantSettings` para que el cliente no dependa de variables de entorno.
- Si el tenant está suspendido o eliminado, mostrar página de mantenimiento/403 controlada.
- Si no se puede resolver el tenant y no hay default, redirigir a una landing de selección de comercio.

### Fase 7 — Configuración y white-label

#### 7.1 Variables de entorno

Actualizar archivos de entorno y documentación:
- `.env.example`:
  - `DEFAULT_TENANT_SLUG=default`
  - `DEFAULT_TENANT_NAME=Tenant por defecto`
  - `PLATFORM_DOMAIN=tuapp.com` (dominio base para subdominios)
  - `SUPERADMIN_USERNAME` (opcional, para seed)
  - `SUPERADMIN_PASSWORD` (opcional, para seed)
  - Mantener `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `DATABASE_URL`, etc.
- `.env.e2e.example`: agregar `SUPERADMIN_USERNAME` y `SUPERADMIN_PASSWORD` para tests del panel de superadmin.
- `README.md`: documentar las nuevas variables, el modelo `platform`/`default` y la resolución por subdominio.
- `AGENTS.md`: actualizar el listado de variables de entorno y los comandos de migración/seed.
- `.devin/environment.yaml`: actualizar la descripción del proyecto para reflejar el modelo multi-tenant y la ruta `/superadmin`.
- `src/config/routes.ts`: agregar rutas `/superadmin` y sus subrutas.

#### 7.2 De env vars a base de datos

Mover a `tenant_settings`:
- `NEXT_PUBLIC_WHATSAPP_NUMBER` → `tenant_settings.whatsappNumber`
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` → `tenant_settings.whatsappMessageGreeting`
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` → `tenant_settings.whatsappMessageClosing`
- Logo, colores, nombre público, timezone, currency.

**Importante:** las variables `NEXT_PUBLIC_*` no pueden leerse en runtime del cliente desde la base de datos. Para que el cliente las consuma, el Server Component de `/pedido` debe cargar `tenant_settings` y pasarlas como props al Client Component (por ejemplo, vía contexto o props iniciales).

Mantener en env vars como fallback global:
- `PLATFORM_DOMAIN`, `DEFAULT_TENANT_SLUG`, `DEFAULT_TENANT_NAME`, secreto de auth, URLs de base, credenciales de storage.

### Fase 8 — Almacenamiento y URLs públicas

- En `src/lib/storage.ts` y `src/lib/chat-storage.ts`, usar prefijo `tenants/{tenantId}/branches/{branchId}/` para archivos (tanto en local como en Vercel Blob/S3/R2).
- Asegurar que un tenant no pueda leer archivos de otro:
  - En `local`, las keys incluyen `tenantId`/`branchId` y el endpoint valida que el recurso pertenezca al tenant del contexto.
  - En `vercel-blob`, `s3` o `r2`, el prefijo por sí solo no evita que alguien con la URL acceda al objeto. El control de acceso se hace **no exponiendo URLs ajenas** y validando el permiso antes de devolver la URL.
- Actualizar `src/app/api/videos/[id]/stream/route.ts` para:
  - Buscar el registro en `videos` por el key/id del archivo.
  - Validar `videos.tenantId` contra el `tenantId` de la sesión.
  - Rechazar con 403 si el video pertenece a otro tenant.
- Actualizar `src/app/api/chat/attachment/[key]/route.ts` para:
  - Buscar el `order_message` por `attachmentKey`.
  - Validar que el pedido (`orderId`) pertenezca a una sucursal del `tenantId` del contexto o del token.
  - Rechazar con 403 si el adjunto pertenece a otro tenant.
- Actualizar `src/lib/public-url.ts` para soportar URLs basadas en el hostname del tenant (por ejemplo, `https://donpancho.tuapp.com` en lugar de `NEXT_PUBLIC_APP_URL`). Recibe un `host` opcional desde el request.
- Actualizar `src/lib/whatsapp.ts` para usar el número y mensajes del tenant desde `tenant_settings` y generar el enlace con la URL del tenant.

### Fase 9 — Tests

#### 9.1 Tests unitarios

- `tenant-resolver.test.ts`: pruebas de resolución por dominio, subdominio, slug, default, tenant suspendido.
- `tenantService.test.ts`: CRUD de tenants, duplicados de slug, soft delete.
- `tenantProvisioningService.test.ts`: creación de tenant + branch + admin desde el superadmin.
- `tenant-context.test.ts`: aislamiento de `getCurrentTenantId()` / `getCurrentBranchId()` con `AsyncLocalStorage`.
- `auth.test.ts`: login con `tenantId`, validación de `branch` en tenant.

#### 9.2 Actualizar tests existentes

- Todos los tests de repositorios y servicios deben ejecutarse dentro de `runWithTenant(tenantId, branchId, async () => { ... })`.
- Actualizar factories o helpers de test para generar `tenant` automáticamente.
- Actualizar `tests/e2e/global-setup.ts` para truncar también `tenants`, `tenant_domains`, `tenant_settings` y `subscriptions`.

#### 9.3 Tests E2E

- `multi-tenant/smoke.spec.ts`: un superadmin crea un tenant, se registra, se loguea, crea una sucursal y un producto.
- `multi-tenant/isolation.spec.ts`: intentar acceder a datos de otro tenant debe fallar con 403/404.
- `multi-tenant/public-catalog.spec.ts`: el catálogo público responde correctamente para distintos subdominios.
- `multi-tenant/superadmin-tenant-creation.spec.ts`: flujo de alta manual de un comercio desde `/superadmin`.

### Fase 10 — Migración y rollout

#### 10.1 Estrategia de migración

1. Backup de la base de producción antes de aplicar migraciones.
2. En desarrollo/staging: `npx drizzle-kit generate` para crear los archivos de migración; revisarlos manualmente.
3. Aplicar en staging con `npx drizzle-kit push` (base de prueba) o con el mecanismo de aplicación de migraciones del entorno, siguiendo `.devin/informes/entornos.md`.
4. Correr `npx tsx src/db/seeds.ts` actualizado contra staging para validar. El seed debe crear el tenant `platform` con superadmin y el tenant `default` con el admin histórico.
5. Actualizar archivos de entorno, documentación (`README.md`, `AGENTS.md`, `.env.example`, `.env.e2e.example`, `.devin/environment.yaml`) y `src/config/routes.ts`.
6. Actualizar variables de entorno en producción.
7. Redeploy.
8. Verificar catálogo, login, ventas, pedidos, caja y panel `/superadmin`.

#### 10.2 Rollback

- Tener migración inversa lista o plan de restauración de backup.
- Si falla, restaurar base y revertir deploy.

## Consideraciones de seguridad y entorno

- **Aislamiento de datos:** cada query debe incluir `tenantId`. Nunca confiar solo en `branchId`.
- **Contexto de tenant:** los handlers y Server Components deben ejecutar `runWithTenant` antes de invocar servicios. Los repositorios obtienen `tenantId` y `branchId` del contexto.
- **Subdominios:** en Vercel, configurar wildcard `*.tuapp.com` y capturar el hostname en `request.headers.get('host')`.
- **Dominios personalizados:** el cliente configura un CNAME a `cname.tuapp.com`; Vercel puede manejar dominios custom por proyecto. En multi-tenant con un solo proyecto, se requiere `PLATFORM_DOMAIN` para subdominios; dominios propios requieren validación manual en Vercel o uso de un reverse proxy.
- **No hardcodear credenciales ni secretos:** todos los valores sensibles en variables de entorno.
- **No commitear `.env.local`.**
- **Tests E2E solo en base de prueba** cuyo nombre termine en `test`, `e2e`, `qa`, `staging` o `testing`.
- **Rate limiting:** actualizar `public_order_rate_limits` y `login_attempts` con claves compuestas `(tenantId, ip)` y `(tenantId, username)`.
- **Almacenamiento:** validar en los endpoints de descarga (`/api/videos/[id]/stream`, `/api/chat/attachment/[key]`) que el recurso pertenece al `tenantId` del contexto.
- **RLS opcional:** si se quiere seguridad adicional, investigar Row Level Security de PostgreSQL con Drizzle. No es obligatorio para el MVP.
- **Auditoría:** registrar cambios críticos en `tenant_audit_logs` (creación de usuarios, cambios de stock, anulaciones, cierres).

## Verificaciones

| Fase | Comandos | Propósito |
| --- | --- | --- |
| 1 | `npx drizzle-kit generate` y `npx drizzle-kit check` | Esquema consistente |
| 1 | `npx tsx src/db/seeds.ts` contra base de prueba | Seed funciona con tenant |
| 2-4 | `npx tsc --noEmit` | Tipos correctos |
| 2-4 | `npm run lint` | Estilo y calidad |
| 4 | `npm test` | Tests unitarios actualizados |
| 5-7 | `npm run build` | Build de producción |
| 8 | `npm run knip` | Sin código muerto |
| 9 | `npm run test:e2e` (base de prueba) | Flujos end-to-end |

## Criterios de aceptación

1. El `superadmin` puede crear un tenant con slug, nombre, dominio y admin inicial.
2. El admin del tenant puede loguearse, ver solo sus sucursales, crear productos y recibir pedidos.
3. Un cliente anónimo puede entrar a `tenant.tuapp.com/pedido`, ver el catálogo de ese tenant y hacer un pedido.
4. Dos tenants distintos tienen datos completamente aislados: productos, pedidos, usuarios, cajas.
5. La migración de datos existentes asigna todo al tenant `default` sin pérdida, y se crea el tenant `platform` para el superadmin.
6. Los tests unitarios y E2E pasan.
7. El build de producción es exitoso.

## Notas de implementación

- No intentar implementar todo de una sola vez. Sugerir fases separadas con verificaciones intermedias.
- Priorizar la seguridad del aislamiento sobre las features avanzadas (facturación, suscripciones con pagos).
- Mantener compatibilidad con el flujo actual: el tenant `default` debe funcionar como hoy, con `DEFAULT_TENANT_SLUG`.
- Si hay dudas entre `tenantId` y `branchId`, siempre filtrar por ambos.
- Para login, preferir resolución por hostname; como fallback, agregar un campo `tenantSlug` en el formulario y enviarlo en `credentials` a `authorize`.
- No usar `username` con formato `slug:usuario`: rompe la UX, dificulta el rate limit y no escala.
- El `superadmin` debe residir en el tenant `platform` (`isPlatform = true`) para mantener coherencia sin mezclar datos de clientes.

## Auditoría, riesgos y mejoras aplicadas

Esta sección documenta los ajustes realizados al plan original y los riesgos que aún deben controlarse durante la implementación.

### Correcciones de consistencia con el esquema actual

- `tenants` usa `deletedAt` para borrado lógico, no un enum `status` con valor `deleted`. El `status` solo indica `active`/`suspended`.
- `branches.name` deja de ser única global y pasa a ser única por `(tenantId, name)`.
- `users.username` es único por `(tenantId, username)`.
- `recipes` y `order_stock_reservations` se agregaron explícitamente a la lista de tablas con `tenantId`.
- Las claves primarias de `login_attempts` y `public_order_rate_limits` cambian a `(tenantId, username)` y `(tenantId, ip)` respectivamente.
- Los índices `sales_idempotency_branch_unique_idx`, `daily_closures_branch_date_unique_idx` y `cash_registers_open_status_idx` se actualizan a `(tenantId, branchId, ...)`.

### Autenticación y autorización

- Se aclara que `authorize(credentials, request)` de Auth.js v5 recibe el request; se usa el `host` para resolver `tenantId`.
- Se descarta el formato `slug:usuario` en favor de un campo `tenantSlug` en el formulario como fallback.
- El `superadmin` se modela con `role = 'superadmin'` y reside en el tenant `platform` (`isPlatform = true`).
- `getCurrentBranchId` debe validar que la sucursal pertenezca al tenant actual.

### Migración de datos

- Se agrega la inferencia de `tenantId` por join con `branches`/`products` para cada tabla.
- Se enfatiza que la migración debe ejecutarse en una transacción atómica.
- Se diferencia `npx drizzle-kit generate` (crear archivos) de `npx drizzle-kit push` (aplicar en desarrollo/staging).

### Resolución de tenant y dominios

- Se advierte que el wildcard `*.tuapp.com` en Vercel requiere plan y configuración DNS adecuados; no funciona en `vercel.app`.
- Se menciona que dominios personalizados requieren gestión manual o API de Vercel / reverse proxy.
- El fallback por `id = 1` se reemplaza por `DEFAULT_TENANT_SLUG` (comercio default) y, para el superadmin, por el slug `platform`.

### Configuración y white-label

- Se aclara que `NEXT_PUBLIC_*` no puede leerse dinámicamente desde DB; el Server Component debe cargar `tenant_settings` y pasarlas al cliente.
- `whatsapp.ts`, `public-url.ts`, `storage.ts` y `chat-storage.ts` deben actualizarse para usar el hostname/tenant.

### Tests y E2E

- Se agrega la actualización de `tests/e2e/global-setup.ts` para truncar tablas de tenant.
- Se sugiere test de aislamiento real entre tenants.

### Riesgos pendientes

- **Cambio de firmas reducido con contexto:** gracias a `tenant-context.ts` con `AsyncLocalStorage`, la mayoría de repositorios y servicios conservan su firma. El riesgo se traslada a olvidar ejecutar `runWithTenant` en los puntos de entrada; validar con tests de aislamiento.
- **Migración de producción:** es la operación más riesgosa. Requiere backup, validación en staging y rollback listo.
- **Dominios personalizados:** puede no ser viable automatizarlos con Vercel en el MVP. Considerar subdominios como única opción inicial.
- **Rate limit `memory`:** en multi-tenant, `memory` no aísla ni escala. Usar `db` en producción.
- **Suscripciones:** se marcan como fase futura para no bloquear el MVP.

## Recomendaciones de enfoque pragmático

El objetivo es transformar `pancheria` en una plataforma multi-tenant sin sacrificar estabilidad ni agregar complejidad innecesaria. A continuación se detallan recomendaciones concretas para cada riesgo, priorizando lo simple y funcional sobre lo sofisticado.

### 1. Propagación de `tenantId`: contexto implícito con AsyncLocalStorage

**Análisis:**
- El proyecto ya usa `AsyncLocalStorage` para transacciones (`src/application/transactionService.ts`).
- Cambiar manualmente la firma de ~15 repositorios, ~15 servicios, decenas de helpers, todas las rutas API, tests y E2E es propenso a errores y retrasa el MVP.
- El riesgo de inconsistencias (que un `tenantId` no se propague) es mayor si hay que recordar pasarlo en cada llamada.

**Recomendación:**
- Crear `src/lib/tenant-context.ts` basado en `AsyncLocalStorage`, similar a `transactionStorage`.
- En el punto de entrada (route handlers, Server Components, layouts y `authorize`) ejecutar `runWithTenant(tenantId, branchId, fn)`. No usar middleware de Next.js para resolver el tenant porque necesita acceder a la base de datos.
- Los repositorios y servicios leen `tenantId` con `getCurrentTenantId()` y `branchId` con `getCurrentBranchId()`.
- Para tests, proveer `withTenantContext(tenantId, branchId, fn)`.
- Mantener parámetros explícitos solo para IDs de entidades específicas (`productId`, `orderId`, etc.).
- **No** reescribir todas las firmas. Ajustar solo la capa de entrada y los helpers de validación.

**Consecuencias:**
- Menor superficie de cambio.
- Menor riesgo de propagar mal un `tenantId`.
- Requiere documentar que los repositorios/servicios deben ejecutarse dentro de un contexto.
- Compatible con el patrón de transacciones existente.

### 2. Migración de producción: una sola migración con tenants `platform` y `default` y validación previa

**Análisis:**
- La base actual es single-tenant. Todos los datos existentes pertenecen al mismo dueño.
- El riesgo principal es que cambios de constraints (`branches.name`, `users.username`) fallen si hay duplicados ocultos o datos inconsistentes.
- `public_order_rate_limits` e `login_attempts` contienen datos volátiles; se pueden truncar antes de migrar.

**Recomendación:**
1. Antes de generar migraciones, correr queries de auditoría:
   - `SELECT name, COUNT(*) FROM branches GROUP BY name HAVING COUNT(*) > 1;`
   - `SELECT username, COUNT(*) FROM users GROUP BY username HAVING COUNT(*) > 1;`
2. Generar migración con `npx drizzle-kit generate`, revisar el SQL manualmente.
3. Hacer backup completo de producción.
4. En staging/restauración de producción:
   - Crear tablas `tenants`, `tenant_settings`, `tenant_domains`.
   - Agregar `tenantId` nullable a todas las tablas.
   - Insertar el tenant `platform` (`slug='platform'`, `isPlatform=true`) y el tenant `default` (`slug='default'`, `isPlatform=false`), junto con una sucursal inicial en `platform`.
   - Asignar los datos históricos al tenant `default`.
   - Asignar al superadmin el tenant `platform`.
   - Inferir `tenantId` desde `branchId` o `productId` con joins.
   - Truncar y recrear `public_order_rate_limits` y `login_attempts` con PK compuestas.
   - Hacer `tenantId` not null y crear FKs/índices.
5. Probar `npx tsx src/db/seeds.ts` contra staging.
6. Plan de rollback: restaurar el backup o tener script de reversión.

**Consecuencias:**
- Migración controlada y reversible.
- No se pierden datos históricos.
- El tenant default funciona exactamente como hoy hasta que se active onboarding.

### 3. Dominios: subdominio como opción principal

**Análisis:**
- Vercel soporta wildcard `*.tuapp.com` si el dominio propio apunta a los nameservers de Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
- Dominios personalizados (`pancheriadonpancho.com`) requieren agregarlos manualmente o por la API de Vercel.
- Para 10-50 comercios, lo más simple es subdominio propio + query param de fallback.

**Recomendación:**
- **Resolución principal:** subdominio (`donpancho.tuapp.com`).
- **Fallback:** query param `?tenant=donpancho` para desarrollo, pruebas y transición.
- **Dominios personalizados:** opcional y manual, solo para comercios estratégicos.
- Usar `tenant_domains` para registrar subdominios.

**Consecuencias:**
- Configuración DNS simple: un wildcard cubre todos los comercios.
- No requiere API de Vercel ni añadir dominios uno por uno en el MVP.

### 4. Rate limit: forzar almacenamiento en base de datos en producción

**Análisis:**
- `InMemoryPublicOrderRateLimitStore` usa un `Map` por instancia. En multi-tenant, si la clave es solo `ip`, un atacante afecta a todos los tenants; si es `(tenantId, ip)`, sigue sin compartirse entre instancias.
- `InMemoryRateLimitStore` tiene el mismo problema para intentos de login.
- PostgreSQL ya es la base de datos de la aplicación.

**Recomendación:**
- Cambiar la clave primaria de `public_order_rate_limits` a `(tenantId, ip)` y la de `login_attempts` a `(tenantId, username)`.
- En producción, definir explícitamente `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` y `RATE_LIMIT_STORE_PROVIDER=db`.
- Hacer que `createPublicOrderRateLimitStore` y `createRateLimitStore` usen `db` por defecto en producción si hay `DATABASE_URL`/`POSTGRES_URL`, sin importar el override.
- Si en el futuro la carga de la base lo justifica, evaluar Vercel KV o Redis; no agregarlo ahora.

**Consecuencias:**
- Aislamiento real por tenant.
- Escalabilidad horizontal en Vercel.
- Sin nuevas dependencias.

### 5. Suscripciones y facturación: no automatizar en el MVP

**Análisis:**
- El modelo confirmado es: el superadmin da de alta, modifica, suspende y elimina comercios manualmente.
- No hay checkout ni cobro automático dentro de la plataforma.
- La mensualidad se cobra fuera del sistema (contrato, transferencia, etc.).
- Implementar pagos automáticos requeriría Stripe/Mercado Pago, webhooks, manejo de estados, retries y emails.

**Recomendación:**
- Mantener `tenants.plan` como `varchar` o enum `('basic', 'pro')`.
- `tenants.status` (`active`/`suspended`) refleja si el comercio está al día con la mensualidad.
- El superadmin controla estado y plan desde `/superadmin`.
- `subscriptions` queda como tabla opcional para trazabilidad histórica.
- No agregar checkout, pasarelas ni webhooks en este ciclo.

**Consecuencias:**
- El MVP se enfoca en aislamiento de datos, alta manual y operación multi-tenant.
- No se bloquea el lanzamiento por integración de pagos.
- El superadmin tiene control total sobre altas, bajas y suspensiones.

### Propuesta de fases simplificadas

Para no atacar todo junto, proponer estas fases:

1. **Fase 0 — Preparación sin cambio de funcionalidad:**
   - Crear tablas de tenant.
   - Agregar `tenantId` nullable.
   - Crear tenant `platform` (con superadmin) y tenant `default` (con el comercio histórico).
   - Asignar todos los datos históricos al tenant `default`.
   - Hacer `tenantId` not null.
   - El sistema debe seguir funcionando como hoy para el tenant `default`; el superadmin aún no tiene panel.

2. **Fase 1 — Contexto y resolución de tenant:**
   - Implementar `tenant-context.ts` con `AsyncLocalStorage`.
   - Resolver tenant por subdominio y query param `?tenant=slug`.
   - Adaptar rutas públicas (`/pedido`, `/pedido/[id]/chat`) para usar el contexto.

3. **Fase 2 — Panel de superadmin y autenticación multi-tenant:**
   - Agregar rol `superadmin` y panel `/superadmin`.
   - Alta manual de comercio: crear tenant + sucursal + admin + subdominio.
   - Adaptar login para resolver `tenantId` por subdominio o campo `tenantSlug`.
   - Validar que `branchId` pertenece al `tenantId`.

4. **Fase 3 — Aislamiento real y tests:**
   - Crear test E2E de aislamiento entre tenants.
   - Verificar que no haya fugas de datos.
   - Validar operación de superadmin (CRUD de comercios, suspender, eliminar).

5. **Fase 4 — Mejoras futuras (no prioritarias):**
   - Dominios personalizados manuales.
   - Suscripciones con cobro automático.
   - RLS de PostgreSQL.

**Principio rector:** preferir que el sistema funcione con un único tenant bien aislado y estable antes que tener muchos tenants con inconsistencias.

## Consejos para el modelo confirmado

Esta sección recoge recomendaciones concretas para operar con un superadmin único, 10-50 comercios, cobro manual y resolución por subdominio.

### Superadmin único y alta manual

- **No over-engineer permisos.** Con un solo superadmin, no hace falta un sistema de roles, invitaciones ni audit logs complejos.
- **Crear un seed `SUPERADMIN_USERNAME`/`SUPERADMIN_PASSWORD`** para que el primer login esté disponible inmediatamente.
- **Crear una sucursal inicial en el tenant `platform`** para poder asignar el superadmin (el esquema `users.branchId` es NOT NULL).
- **El panel `/superadmin` debe ser funcional, no elegante.** CRUD de comercios, cambio de estado y asignación de plan es suficiente.
- **Registrar fecha de alta y vencimiento:** `tenants.billingStartDate` y `tenants.billingDueDate` ayudan al superadmin a saber cuándo cobrar.
- **Soft delete por defecto:** nunca eliminar un comercio físicamente para conservar historial fiscal y de ventas.

### 10-50 comercios

- **No preocuparse por RLS en el MVP.** Con 10-50 comercios y un único superadmin, la combinación de:
  - `tenantId` en todas las queries,
  - `tenant-context.ts` con `AsyncLocalStorage` para no propagar `tenantId` manualmente,
  - validación de `branchId` dentro del tenant,
  - `withAuth` y `withSuperAdmin` correctamente implementados,
  - tests de aislamiento,
  es suficiente.
- **Monitorear con logs simples:** quién creó/suspendió un tenant y cuándo.
- **Limitar planes por código:** por ejemplo, plan `basic` = 1 sucursal, plan `pro` = hasta 3 sucursales. El superadmin lo controla manualmente.
- **Empezar con una base de datos única.** No dividir por base de datos ni esquemas. Es el modelo más simple para esta escala.

### Subdominio

- **Comprar el dominio raíz desde el inicio** (`tuapp.com` o similar).
- **Apuntar los DNS a Vercel** para aprovechar wildcard SSL (`*.tuapp.com`).
- **Generar subdominio automáticamente** a partir del slug (`slug.tuapp.com`) al crear el tenant.
- **Validar slug:** solo minúsculas, números y guiones. Rechazar slugs reservados (`www`, `app`, `admin`, `api`, `superadmin`).
- **Mantener query param `?tenant=slug`** para desarrollo, pruebas y soporte.

### Cobro manual

- **No agregar pasarelas de pago.** El superadmin controla `status` (`active`/`suspended`) según el pago recibido.
- **Enviar recordatorios fuera de la plataforma** (WhatsApp/email manual) hasta que se justifique automatizar.
- **Guardar historial de facturación externa:** usar `subscriptions` solo como registro, no como motor de cobro.
- **Suspender, no eliminar:** si un comercio no paga, cambiar `status` a `suspended` y bloquear acceso. Si vuelve, reactivar.

### Migración y puesta en marcha

1. **Desplegar una versión 0** con el esquema multi-tenant, el tenant `default` para el comercio histórico y el tenant `platform` para el superadmin.
2. **Validar que todo sigue funcionando** con el comercio actual y que el superadmin puede loguearse.
3. **Crear el primer comercio de prueba** desde `/superadmin`.
4. **Probar subdominio y login** con ese comercio.
5. **Crear comercios reales de a uno**, acompañando al comercio en la carga inicial de productos/stock.
6. **No habilitar onboarding automático** hasta que el modelo esté validado.

### Checklist antes de dar un comercio por activo

- [ ] Tenant creado con slug único.
- [ ] Subdominio configurado o query param de prueba.
- [ ] Sucursal inicial creada.
- [ ] Usuario admin del comercio creado.
- [ ] Plan asignado (`basic`/`pro`).
- [ ] Productos cargados o catálogo base copiado.
- [ ] Stock inicial ajustado.
- [ ] Caja abierta al menos una vez para validar flujo de ventas.
- [ ] Pedido de prueba realizado en `/pedido`.
