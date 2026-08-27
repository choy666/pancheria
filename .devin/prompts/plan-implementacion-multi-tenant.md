# Prompt: Plan de implementación — plataforma multi-tenant compartida

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/informe-estrategico-franquicia-saas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />

## Estado actual relevante

El sistema soporta múltiples sucursales (`branches`) con aislamiento por `branchId`. Los usuarios tienen `role` (`admin` / `operator`) y `branchId`. Las consultas filtran por `branchId`. No existe un concepto superior de `tenant` u `organization`; todas las sucursales pertenecen al mismo dueño implícito. El catálogo público resuelve la sucursal por `?branchId` o por `DEFAULT_BRANCH_NAME` (<ref_file file="C:/developer/paginas/pancheria/src/lib/branch-resolver.ts" />). La autenticación almacena `branchId` y `role` en el token JWT (<ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />).

## Objetivo

Transformar la aplicación en una plataforma multi-tenant compartida: una sola base de datos, una sola aplicación, muchos clientes. Cada cliente es un `tenant` con sus propias sucursales, usuarios, productos, pedidos, ventas, etc. El aislamiento debe ser por filas (`tenantId`) en todas las entidades de negocio. Debe existir un rol `superadmin` para gestionar tenants, y un flujo de onboarding automático para nuevos clientes.

## Reglas de negocio

1. Un `tenant` representa un comercio cliente. Puede tener muchas `branches`.
2. Todo usuario pertenece a un único `tenant` y a una única `branch` (la suya o la default del admin).
3. Un usuario nunca puede cambiar de `tenant`. El admin de un tenant solo puede ver y gestionar datos de su tenant.
4. El `superadmin` pertenece a un tenant especial (por ejemplo, `tenantId = 1` o un campo `isPlatform = true`) y puede crear, editar, suspender y gestionar todos los tenants.
5. El catálogo público (`/pedido`) se resuelve por dominio/subdominio del tenant. Si no hay mapeo, se usa un tenant por defecto (`DEFAULT_TENANT_SLUG`).
6. Los datos públicos de un tenant (catálogo, pedidos, chat) no requieren autenticación, pero siempre deben filtrarse por `tenantId`.
7. El login debe resolver el `tenant` implícitamente (por subdominio/dominio) o pedir el `tenantSlug`. El `username` debe ser único dentro del `tenant`.
8. Todos los repositorios y servicios deben validar que el `branchId` pertenezca al `tenantId` actual antes de operar.
9. La migración de datos existentes debe crear un tenant `default` y asignar todas las filas actuales a él.
10. Las personalizaciones por tenant (logo, colores, WhatsApp, mensajes, horarios) deben almacenarse en `tenant_settings`, no hardcodearse ni depender únicamente de `process.env`.
11. Los movimientos de stock, ventas, pedidos, cajas, cierres y videos deben incluir `tenantId` además de `branchId`.
12. El borrado lógico de un tenant debe conservar los datos pero bloquear todo acceso nuevo.

## Implementación detallada

### Fase 1 — Esquema de base de datos y migración

#### 1.1 Nuevas tablas

En <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> agregar:

- `tenants`:
  - `id: serial().primaryKey()`
  - `slug: varchar().notNull().unique()` (identificador de URL, ej. `donpancho`)
  - `name: varchar().notNull()`
  - `status: enum('active', 'suspended', 'deleted')`
  - `billingEmail: varchar()`
  - `plan: varchar()`
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
  - `logoUrl: text()`
  - `primaryColor: varchar()`
  - `whatsappNumber: varchar()`
  - `whatsappMessageGreeting: text()`
  - `whatsappMessageClosing: text()`
  - `publicAppName: varchar()`
  - `timezone: varchar()`
  - `currency: varchar()`
  - `jsonb` adicional si se requiere flexibilidad.

- `subscriptions` (MVP básico):
  - `id: serial().primaryKey()`
  - `tenantId`
  - `plan`, `price`, `status`, `startDate`, `endDate`, `billingCycle`.

- `tenant_audit_logs` (opcional pero recomendado):
  - `id`, `tenantId`, `userId`, `action`, `entity`, `entityId`, `metadata` (jsonb), `createdAt`.

#### 1.2 Modificar tablas existentes

Agregar `tenantId` (not null) a:
- `branches`
- `users`
- `products`
- `recipes` (vía `compoundProductId` y `supplyId` que ya tendrán `tenantId`)
- `cash_registers`
- `sales`
- `sale_items`
- `orders`
- `order_items`
- `order_messages`
- `stock_movements`
- `daily_closures`
- `videos`
- `public_order_rate_limits` (añadir `tenantId` para aislamiento)
- `login_attempts` (añadir `tenantId` si se hace por tenant)

**Nota:** `recipes` en sí no necesita `tenantId` si sus productos ya lo tienen, pero conviene agregarlo por conveniencia de consultas e índices.

#### 1.3 Claves foráneas e índices

- `branches.tenantId` → `tenants.id` (onDelete restrict).
- `users.tenantId` → `tenants.id` y `users.branchId` → `branches.id`.
- `products.tenantId` + `products.branchId`.
- Reemplazar `uniqueIndex` existentes que usen solo `branchId` por `tenantId + branchId` cuando aplique. Por ejemplo, `orders_order_number_unique_idx` debe ser `(tenantId, branchId, orderNumber)`.
- Revisar `users.username`: el unique debe ser por `(tenantId, username)` si se permite mismo username en distintos tenants.

#### 1.4 Migración de datos

- Generar migración con `npx drizzle-kit generate`.
- La migración debe:
  1. Crear tablas `tenants`, `tenant_domains`, `tenant_settings`, `subscriptions`.
  2. Agregar columnas `tenantId` nullable a las tablas existentes.
  3. Insertar tenant `default` con `slug = 'default'`, usando `DEFAULT_TENANT_NAME` o un valor por defecto.
  4. Actualizar todas las filas existentes con `tenantId = 1`.
  5. Hacer `tenantId` not null.
  6. Crear FKs e índices.

- Actualizar `src/db/seeds.ts` (<ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />) para:
  1. Crear el tenant default.
  2. Crear la sucursal default asignada a ese tenant.
  3. Crear el admin asignado al tenant y a la sucursal.
  4. Asignar `tenantId` a todo producto, receta, etc.

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
- Primero buscar en `tenant_domains` por `domain` exacto.
- Si no hay coincidencia y el hostname es `*.tuapp.com`, extraer el subdominio y buscar por `slug`.
- Si no se encuentra, fallback a `DEFAULT_TENANT_SLUG` (variable de entorno) o al tenant con `id = 1`.
- Si el tenant está `suspended` o `deleted`, lanzar `ForbiddenError`.

#### 2.2 Integración con `src/lib/branch-resolver.ts`

- `getDefaultBranchId` debe aceptar `tenantId`:
  - `getDefaultBranchId(tenantId)` busca la sucursal por `DEFAULT_BRANCH_NAME` dentro del tenant.
- `listPublicBranches` debe filtrar por `tenantId`.
- `parseBranchId` se mantiene.

#### 2.3 Uso en rutas públicas

- `/pedido` y `/pedido/[id]/chat` deben resolver el tenant por `hostname` o por `?tenant=slug`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" /> debe:
  - Leer `tenant` de `request.headers.get('host')` o de query param `tenant`.
  - Obtener `tenantId`.
  - Resolver `branchId` por query o por default dentro del tenant.
  - Devolver productos filtrados por `tenantId` y `branchId`.

- `src/app/api/public/pedido/route.ts` y subrutas deben filtrar por `tenantId`.

### Fase 3 — Autenticación y autorización

#### 3.1 Sesión

En <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />:
- El callback `jwt` debe incluir `tenantId` y `tenantSlug`.
- El callback `session` debe incluir `user.tenantId` y `user.tenantSlug`.
- El `role` del superadmin puede ser `superadmin` además de `admin`.

En <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" />:
- El `authorize` debe recibir `tenantId` (de alguna fuente) y buscar el usuario por `username` + `tenantId`.
- Si se usa dominio/subdominio, `tenantId` se infiere del `request` (ver cómo pasarlo en Auth.js credentials).
- Alternativa: en el formulario de login agregar un campo `tenantSlug` o usar `username` con formato `slug:usuario`.

#### 3.2 Helpers de auth

En <ref_file file="C:/developer/paginas/pancheria/src/lib/auth.ts" />:
- `getCurrentTenantId(session?)` devuelve `tenantId` del token o de la cookie/hostname.
- `getCurrentTenantIdOrRedirect` redirige si no hay tenant.
- `getCurrentBranchId` debe verificar que la sucursal activa pertenezca al `tenantId` actual.
- `requireSuperAdmin` valida `role === 'superadmin'`.
- `requireTenantAdmin` valida `role === 'admin'` dentro del tenant actual.

En <ref_file file="C:/developer/paginas/pancheria/src/lib/with-auth.ts" />:
- `AuthContext` debe incluir `tenantId`.
- `withAuth` y `withSuperAdmin` deben inyectar `tenantId`.

#### 3.3 Nombres de usuario

- Cambiar `users.username` unique a `(tenantId, username)`.
- Actualizar `authService.verifyCredentials` para buscar por `username` + `tenantId`.
- Si se mantiene el login por username puro, agregar `email` o pedir `tenantSlug` en el formulario.

### Fase 4 — Repositorios y servicios

#### 4.1 Patrón de repositorios

Cada función que recibe `branchId` debe recibir `tenantId` y verificar que `branch.tenantId = tenantId`.

Ejemplo en <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" />:

```ts
export async function findAll(
  tenantId: number,
  branchId: number,
  includeDeleted = false
): Promise<ProductRow[]> { ... }
```

Las condiciones deben ser:

```ts
const conditions = [
  eq(products.tenantId, tenantId),
  eq(products.branchId, branchId),
];
```

#### 4.2 Servicios

Actualizar todos los servicios en <ref_file file="C:/developer/paginas/pancheria/src/application/services" /> para:
- Recibir `tenantId` de la sesión o del resolver.
- Llamar a los repositorios con `tenantId`.
- Validar que `branchId` pertenece al `tenantId` antes de operar (puede centralizarse en un helper `validateBranchBelongsToTenant`).

Servicios nuevos:
- `tenantService.ts`: CRUD de tenants, dominios, settings.
- `onboardingService.ts`: crear tenant + branch + admin.
- `subscriptionService.ts`: gestión básica de planes.
- `superadminService.ts`: listar tenants, suspender, etc.

#### 4.3 Helpers de negocio

- `src/lib/tenant-helpers.ts`: `validateBranchInTenant(tenantId, branchId)`, `validateUserInTenant(tenantId, userId)`.
- Actualizar `src/lib/product-helpers.ts`, `sale-helpers.ts`, `order-helpers.ts`, `stock-helpers.ts`, etc., para propagar `tenantId` donde se necesite.

### Fase 5 — Rutas API

#### 5.1 API pública (`/api/public/*`)

- Todas las rutas deben resolver `tenantId` desde `request.headers.get('host')` o query param `tenant`.
- Aplicar rate limit con `tenantId` + IP si es posible.
- Catálogo, pedidos, chat, estado: filtrar por `tenantId` y `branchId`.

#### 5.2 API del panel (`/api/*`)

- Usar `withAuth` o `withSuperAdmin`.
- Inyectar `tenantId`.
- Validar `branchId` contra `tenantId`.

#### 5.3 API de superadministrador

Nuevas rutas bajo `/api/superadmin/*`:
- `GET /api/superadmin/tenants`
- `POST /api/superadmin/tenants`
- `GET /api/superadmin/tenants/[id]`
- `PATCH /api/superadmin/tenants/[id]`
- `DELETE /api/superadmin/tenants/[id]` (soft delete)
- `POST /api/superadmin/tenants/[id]/suspend`
- `POST /api/superadmin/tenants/[id]/domains`
- `GET /api/superadmin/tenants/[id]/subscriptions`

Protegidas por `withSuperAdmin`.

### Fase 6 — UI y rutas del panel

#### 6.1 Nuevas páginas

- `/superadmin` — dashboard de tenants:
  - Listado con búsqueda y filtros.
  - Botón "Crear tenant" con formulario.
  - Acciones: ver, editar, suspender, eliminar, gestionar dominios y suscripciones.

- `/superadmin/tenants/[id]/page.tsx` — detalle de tenant.
- `/superadmin/tenants/nuevo/page.tsx` — formulario de creación.
- `/superadmin/tenants/[id]/dominios/page.tsx` — gestión de dominios.
- `/superadmin/tenants/[id]/suscripciones/page.tsx` — gestión de suscripciones.
- `/onboarding` — formulario público de registro de nuevo comercio (tenant, branch, admin user).

#### 6.2 Panel del tenant

- El selector de sucursales debe mostrar solo sucursales del tenant actual.
- El admin de tenant puede ir a `/sucursales`, `/usuarios`, `/productos`, etc., sin ver otros tenants.
- Header puede mostrar el nombre del tenant y su logo desde `tenant_settings`.

#### 6.3 Catálogo público

- `/pedido` debe resolver tenant por hostname.
- Mostrar logo, nombre y WhatsApp del tenant.
- Si el tenant está suspendido, mostrar página de mantenimiento.

### Fase 7 — Configuración y white-label

#### 7.1 Variables de entorno

Actualizar `.env.example`:
- `DEFAULT_TENANT_SLUG=default`
- `DEFAULT_TENANT_NAME=Tenant por defecto`
- `PLATFORM_DOMAIN=tuapp.com` (dominio base para subdominios)
- `SUPERADMIN_USERNAME` (opcional, para seed)
- `SUPERADMIN_PASSWORD` (opcional, para seed)
- Mantener `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `DATABASE_URL`, etc.

#### 7.2 De env vars a base de datos

Mover a `tenant_settings`:
- `NEXT_PUBLIC_WHATSAPP_NUMBER` → `tenant_settings.whatsappNumber`
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` → `tenant_settings.whatsappMessageGreeting`
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` → `tenant_settings.whatsappMessageClosing`
- Logo, colores, nombre público.

Mantener en env vars como fallback global:
- `PLATFORM_DOMAIN`, `DEFAULT_TENANT_SLUG`, secreto de auth, URLs de base, credenciales de storage.

### Fase 8 — Almacenamiento

- En `src/lib/storage.ts` y `src/lib/chat-storage.ts`, usar prefijo `tenants/{tenantId}/branches/{branchId}/` para archivos.
- Asegurar que un tenant no pueda leer archivos de otro. Si se usa Vercel Blob, el prefijo basta; validar el `tenantId` en la URL de descarga.
- Actualizar `src/app/api/chat/attachment/[key]/route.ts` y `src/app/api/videos/[id]/stream/route.ts` para validar que el archivo pertenece al tenant de la request.

### Fase 9 — Tests

#### 9.1 Tests unitarios

- `tenant-resolver.test.ts`: pruebas de resolución por dominio, subdominio, slug, default, tenant suspendido.
- `tenantService.test.ts`: CRUD de tenants, duplicados de slug, soft delete.
- `onboardingService.test.ts`: creación de tenant + branch + admin.
- `auth.test.ts`: login con `tenantId`, validación de `branch` en tenant.

#### 9.2 Actualizar tests existentes

- Todos los tests de repositorios y servicios deben crear un tenant y pasar `tenantId`.
- Actualizar factories o helpers de test para generar `tenant` automáticamente.

#### 9.3 Tests E2E

- `multi-tenant/smoke.spec.ts`: un superadmin crea un tenant, se registra, se loguea, crea una sucursal y un producto.
- `multi-tenant/isolation.spec.ts`: intentar acceder a datos de otro tenant debe fallar con 403/404.
- `multi-tenant/public-catalog.spec.ts`: el catálogo público responde correctamente para distintos subdominios.
- `multi-tenant/onboarding.spec.ts`: flujo de registro de nuevo comercio.

### Fase 10 — Migración y rollout

#### 10.1 Estrategia de migración

1. Backup de la base de producción antes de aplicar migraciones.
2. Ejecutar migración en staging.
3. Correr `src/db/seeds.ts` actualizado contra staging para validar.
4. Actualizar variables de entorno en producción.
5. Redeploy.
6. Verificar catálogo, login, ventas, pedidos, caja.

#### 10.2 Rollback

- Tener migración inversa lista o plan de restauración de backup.
- Si falla, restaurar base y revertir deploy.

## Consideraciones de seguridad y entorno

- **Aislamiento de datos:** cada query debe incluir `tenantId`. Nunca confiar solo en `branchId`.
- **Subdominios:** en Vercel, configurar wildcard `*.tuapp.com` y capturar el hostname en `request.headers.get('host')`.
- **Dominios personalizados:** el cliente configura un CNAME a `cname.tuapp.com`; Vercel puede manejar dominios custom por proyecto. En multi-tenant con un solo proyecto, se requiere `PLATFORM_DOMAIN` para subdominios; dominios propios requieren validación manual en Vercel o uso de un reverse proxy.
- **No hardcodear credenciales ni secretos:** todos los valores sensibles en variables de entorno.
- **No commitear `.env.local`.**
- **Tests E2E solo en base de prueba** cuyo nombre termine en `test`, `e2e`, `qa`, `staging` o `testing`.
- **Rate limiting:** actualizar `public_order_rate_limits` y `login_attempts` para incluir `tenantId` si aplica.
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
5. La migración de datos existentes asigna todo al tenant `default` sin pérdida.
6. Los tests unitarios y E2E pasan.
7. El build de producción es exitoso.

## Notas de implementación

- No intentar implementar todo de una sola vez. Sugerir fases separadas con verificaciones intermedias.
- Priorizar la seguridad del aislamiento sobre las features avanzadas (facturación, suscripciones con pagos).
- Mantener compatibilidad con el flujo actual: el tenant `default` debe funcionar como hoy, con `DEFAULT_TENANT_SLUG`.
- Si hay dudas entre `tenantId` y `branchId`, siempre filtrar por ambos.
- Para login, la opción más simple es agregar `tenantSlug` en el formulario y enviarlo a `authorize`.
