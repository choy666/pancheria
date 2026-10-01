# Prompt: Mapa visual de arquitectura del proyecto Panchería

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat por pedido y gestión de videos con reproducción y Cast.

Stack real (verificado contra `package.json` y el código): Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5 (Auth.js), Jest, Playwright, despliegue en Vercel con cron jobs declarados en `vercel.json`.

Documentación de referencia obligatoria (leer antes de diagramar):
- `AGENTS.md`
- `README.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/reporte-estado.md`
- `.devin/informes/guia-funcionamiento-pancheria.md`
- `.env.example` (para servicios externos e integraciones configuradas)

## Misión

Generar un mapa visual completo de la arquitectura REAL del proyecto, navegable en tres niveles, mantenible en Git como texto (Mermaid), y que permita entender el sistema completo en pocos segundos sin recorrer carpetas.

Esta tarea es exclusivamente **análisis + documentación + visualización**. No se modifica código, schemas, APIs ni comportamiento funcional.

## Reglas de oro (del proyecto)

1. Todo en español: explicaciones, comentarios, nombres de archivos de documentación y labels de diagramas (los identificadores técnicos — tablas, rutas, archivos — quedan en su nombre real).
2. Nunca exponer secretos: en los diagramas y documentos NO va el valor de `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, tokens de storage ni URLs con credenciales. Referenciar la variable de entorno, no su valor.
3. No ejecutar `npm run test:e2e` ni `npx tsx src/db/seeds.ts`: truncan/modifican la base de datos.
4. No inventar arquitectura: toda relación debe verificarse en el código. Si no puede verificarse, se marca `UNKNOWN / UNVERIFIED`.
5. La implementación real tiene prioridad sobre README y documentación; las discrepancias se documentan, no se corrigen.

## Mapa del código real (puntos de anclaje verificados al 2026-10-01)

Usar estos puntos de entrada; no asumir nada fuera de ellos sin verificar:

| Capa | Ubicación real |
| ---- | -------------- |
| Presentación pública | `src/app/(public)/pedido/` — catálogo (`page.tsx`), `[id]` (seguimiento/chat del pedido) y `seguimiento/`. Fuera de los route groups existe también `src/app/sesion-finalizada/` |
| Presentación panel | `src/app/(panel)/` — dashboard (`page.tsx`), pedidos, ventas, caja (`cierre`), productos, stock, sucursales, usuarios, videos, perfil |
| Presentación auth | `src/app/(auth)/login` |
| Mutaciones | **Dos canales:** API routes en `src/app/api/` **y** Server Actions en `actions.ts` junto a páginas (`(panel)/actions.ts`, `(panel)/{perfil,productos,sucursales,usuarios,videos}/actions.ts`, `(auth)/login/actions.ts`). Los flujos pueden ser `UI → Server Action → Service → Repository → DB` |
| API | `src/app/api/` — `caja`, `pedidos` (incluye `pedidos/[id]/chat/stream` SSE), `productos`, `public/{catalogo,disponibilidad,pedido,sucursal}` (con `public/pedido/[id]/chat/stream` SSE), `recetas`, `stock`, `ventas`, `videos`, `chat/attachment`, `panel/resumen`, `cron/*`, `health`, `auth/[...nextauth]` |
| Application | `src/application/` — `services/` (14 servicios por dominio: auth, branch, cashRegister, catalog, chat, cleanup, order, product, recipe, sale, stock, summary, user, video) + `transactionService`, `idempotencyService` |
| Domain | `src/domain/` — `types.ts`, `errors.ts` (capa deliberadamente fina); tipos compartidos adicionales en `src/types/` |
| Infrastructure / helpers | `src/lib/` (lógica compartida: rate-limit, storage, chat-stream, helpers por dominio), `src/repositories/`, `src/db/` (`schema.ts`, `seeds.ts`, `catalog-copy.ts`) |
| Config por dominio | `src/config/` (caja, chat, videos, storage-origins, database, rate-limit, cache, orders, etc.) |
| Componentes | `src/components/` (agrupados por módulo: `caja`, `cart`, `chat`, `pedidos`, `productos`, `promo`, `videos`, …). Ojo: coexisten `pedido` (singular) y `pedidos` (plural) — verificar qué consume cada uno |
| Hooks | `src/hooks/` |
| Auth | `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts` (en Next 16 `proxy.ts` reemplaza a `middleware.ts`) |
| DB schema | `src/db/schema.ts` + migraciones en `drizzle/` |
| Crons declarados | `vercel.json` → `/api/cron/rate-limit-cleanup`, `/api/cron/chat-attachments-cleanup`. **Verificado 2026-10-01:** `src/app/api/cron/expire-orders` existe pero **no está agendado** en `vercel.json` (re-verificar por si cambió; si no se invoca por otro medio, documentarlo como ruta sin agendar) |
| Chat en tiempo real | `src/lib/chat-stream.ts` — SSE hacia el cliente con poll interno a la base (`intervalMs`, `heartbeatMs`); lo consumen `api/pedidos/[id]/chat/stream` (panel) y `api/public/pedido/[id]/chat/stream` (público) |
| Scripts / ops | `scripts/` (`dev-e2e.ts`, `drizzle-baseline.ts`, etc.) |
| Tests | `tests/e2e/` (Playwright) + `*.test.ts` junto al código (Jest) |

Módulos funcionales a verificar (la mayoría confirmados; validar cada uno contra rutas + servicio + repositorio antes de incluirlo):

- Caja (apertura/cierre/historial/papelera/auto-cierre por turnos)
- Ventas (carrito interno, pagos `cash`/`transfer`, historial)
- Pedidos (panel) y Pedidos públicos (`/api/public/pedido`, seguimiento, rate limit)
- Stock (ajustes, movimientos, reservas `order_stock_reservations`)
- Productos (disponibilidad, imágenes, papelera, promociones via `src/components/promo`)
- Recetas (productos compuestos, `sale_item_recipes`/`order_item_recipes`)
- Usuarios y roles (`user_role`: `admin`, `operator`)
- Sucursales (multi-tenant: `branches`, contactos, horarios, turnos overnight)
- Chat (mensajes por pedido, adjuntos, SSE/polling)
- Videos (upload, storage provider, Cast)
- Auth (NextAuth v5, credentials, `login_attempts`)

Tablas reales en `src/db/schema.ts` (usar estos nombres en el ER): `branches`, `users`, `products`, `recipes`, `cash_registers`, `sales`, `sale_payments`, `sale_items`, `sale_item_recipes`, `orders`, `order_items`, `order_item_recipes`, `order_stock_reservations`, `order_messages`, `stock_movements`, `videos`, `login_attempts`, `public_order_rate_limits`.

Estados reales de pedido (`order_status`): `pending → in_process → paid → finished`, más `cancelled`. Tipos de `stock_movements`: `sale`, `cancellation`, `manual_adjustment`, `restock`, `reserve`, `reserve_release`. Métodos de pago: solo `cash` y `transfer` — **no hay Mercado Pago en el código** (verificar y marcarlo explícitamente; no asumirlo por documentación o configuración del entorno).

## Trabajo a realizar

### 1. Analizar primero, diagramar después

- Inspeccionar el repositorio completo y leer la documentación existente (`README.md`, `AGENTS.md`, `.devin/informes/`).
- Identificar la arquitectura real desde el código: presentation (route groups), API routes **y Server Actions** (`actions.ts`), application services, domain, repositories, DB, auth, crons, integraciones, servicios externos, tests, infra/deploy.
- Comparar documentación vs implementación; documentar discrepancias (la implementación manda).

### 2. Overview principal (NIVEL 1)

Un diagrama Mermaid minimalista del sistema completo. Reemplazar nombres genéricos por los módulos reales. Debe responder en ~10 segundos: qué es el sistema, sus módulos, cómo se comunican, dónde está la base, qué servicios externos usa y los flujos críticos. Prohibido el grafo gigante con un nodo por archivo.

### 3. Arquitectura por capas (NIVEL 2)

Representar las capas reales del proyecto:

- Presentation: route groups `(public)`, `(panel)`, `(auth)`, componentes por módulo, hooks relevantes.
- Application: `src/application/services/*` + servicios transversales (`transactionService`, `idempotencyService`).
- Domain: `src/domain/` (finas: tipos + errores — documentarlo tal cual, no inflarlo).
- Infrastructure: `src/repositories/`, `src/db/`, `src/lib/` (helpers por dominio, rate-limit, storage, cache), `src/config/`, auth, storage providers, crons.

Si la organización real no encaja en estas categorías, respetar la real.

### 4. Módulos principales (NIVEL 2)

Cada módulo verificado como unidad independiente con sus piezas reales:

```text
PEDIDOS
├── UI            → (panel)/pedidos + components/pedidos
├── API           → api/pedidos, api/public/pedido
├── Application   → orderService
├── Domain        → tipos/errores usados
├── Repository    → orderRepository, orderStockReservationRepository, orderMessageRepository
├── Database      → orders, order_items, order_item_recipes, order_stock_reservations, order_messages
└── Integrations  → stock, chat, rate-limit, …
```

### 5. Relaciones importantes

Verificar en código y mostrar solo las reales:

- Pedidos → Stock: disponibilidad → `order_stock_reservations` → conversión a venta → deducción (`stock_movements`). Verificar el orden real (¿reserva antes o después de `paid`? ¿quién libera reservas: cancelación, `expire-orders`, cierre de caja?).
- Auth: `users` → role (`admin`/`operator`) → `branch_id` → acceso por sucursal. Verificar dónde se resuelve la sucursal activa (`src/lib/branch-resolver.ts`, `selected-branch.ts`).
- Multi-sucursal: usuario → sucursal → alcance de pedidos/stock/caja/config.
- Base de datos: entidades y FK principales en el overview; detalle completo en la vista dedicada.

### 6. Vista de base de datos (NIVEL 3)

Diagrama ER Mermaid con las tablas reales de `src/db/schema.ts`, sus FK y `relations()` de Drizzle. Incluir enums relevantes (`order_status`, `stock_movement_type`, `payment_method`, `user_role`, `cash_register_status`, `delivery_type`, `sale_status`, `product_type`, `critical_supply_type`, `order_message_sender`). Una tabla sin relación clara queda aislada, no inventada.

### 7. Vista de ciclo de vida del pedido

Diagrama exclusivo del flujo real, verificado transición por transición en `orderService`/`orderRepository`:

```text
Cliente → catálogo público → carrito → POST /api/public/pedido → pending
  → (operador) in_process → paid → finished
```

Incluir, solo si existen en código: `cancelled`, expiración (`expire-orders` — **verificado 2026-10-01: la ruta existe pero no está agendada en `vercel.json`**; confirmar si se invoca por otro medio o es dead/unscheduled), reserva/liberación de stock (`reserve`/`reserve_release`), conversión pedido→venta, mensajes de chat asociados. Marcar lo no verificable como `UNKNOWN / UNVERIFIED`.

### 8. Vistas de flujo request/data

Mínimo 3 flujos trazados punta a punta: `UI → Route/API o Server Action → Service → Repository → DB` (los `actions.ts` son un canal real de mutación: no omitirlos). Candidatos según criticidad real: crear pedido público, cerrar caja (resumen + movimientos), registrar venta con deducción de stock/recetas, autenticación + resolución de sucursal, un flujo vía Server Action (p. ej. gestión de productos o sucursales). Elegir los 3–5 más importantes según el código.

### 9. Servicios externos

Clasificar cada uno como `USED` (importado/llamado en código), `CONFIGURED` (env var/SDK presente sin uso confirmado), `DOCUMENTED ONLY` o `UNKNOWN`. Puntos a verificar:

- PostgreSQL/Neon (`DATABASE_URL` y aliases Vercel Postgres)
- Vercel (deploy + crons de `vercel.json`)
- Vercel Blob / S3 / R2 (`STORAGE_PROVIDER`, imports dinámicos en `src/lib/storage.ts`)
- Filesystem local (`STORAGE_PROVIDER=local`)
- Mercado Pago: **verificado 2026-10-01 — cero referencias en `src/`, `.env.example` y `README.md`**. Documentarlo como ausente; si aparece en alguna config futura, clasificarlo `CONFIGURED`/`DOCUMENTED ONLY`, nunca `USED` sin un import que lo respalde.
- Cast de videos, analytics condicional, cualquier fetch saliente en `src/lib/fetch.ts`/`chat-stream.ts`.

### 10. Vista de stack

Solo tecnologías realmente detectadas en `package.json`/imports (verificado 2026-10-01): Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui (+ `@base-ui/react`), Drizzle + PostgreSQL (`@neondatabase/serverless` + `pg`), NextAuth v5, Zod, dinero.js (dinero), bcrypt, driver.js (tour guiado → `components/tour`), date-fns, lucide-react, nanoid, Jest, Playwright (+ axe-core), Vercel (+ crons), storage providers (`@vercel/blob`, `@aws-sdk/client-s3` + `s3-presigned-post`).

### 11. Salud de la arquitectura (solo observaciones, sin arreglos)

Documentar, con evidencia, hallazgos como:

- Dependencias circulares o acoplamiento excesivo (p. ej. concentración de lógica en `src/lib/`).
- Repositories/servicios duplicados o sin consumidores; rutas API sin cliente aparente.
- Rutas cron sin agendar en `vercel.json` (**verificado 2026-10-01: `expire-orders` no está agendado** — confirmar si se dispara por otro medio o es dead code).
- Tablas de rate-limit con consumidores confirmados — **no son huérfanas** (verificado 2026-10-01): `login_attempts` ← `src/lib/rate-limit-store.ts`; `public_order_rate_limits` ← `src/lib/public-order-rate-limit-store.ts` + `api/public/disponibilidad`. Verificar si queda alguna otra tabla sin consumidor claro.
- Documentación desactualizada (README/AGENTS vs código), módulos sin tests, integraciones configuradas sin uso.

NO corregir nada: solo documentar.

### 12. Formato de los diagramas

Mermaid (texto, versionable): `flowchart`/`graph` para overview y módulos, `erDiagram` para la base, `sequenceDiagram` para al menos un flujo crítico (p. ej. crear pedido o cerrar caja). Nada de PNG estático como fuente única.

## Organización de archivos

El proyecto no tiene `docs/`; la documentación vive en `.devin/informes/`. Crear:

```text
.devin/informes/arquitectura/
├── README.md                 ← índice navegable + NIVEL 1 embebido
├── overview.md               ← NIVEL 1: sistema completo
├── modulos.md                ← NIVEL 2: módulos y capas
├── base-de-datos.md          ← NIVEL 3: ER completo
├── flujo-pedidos.md          ← ciclo de vida del pedido
├── flujos-de-datos.md        ← 3–5 flujos punta a punta
├── servicios-externos.md     ← USED / CONFIGURED / DOCUMENTED ONLY / UNKNOWN
├── stack.md                  ← tecnologías detectadas
├── salud-arquitectura.md     ← observaciones (sin fixes)
└── diagramas/
    ├── overview.mmd
    ├── base-de-datos.mmd
    ├── flujo-pedidos.mmd
    └── flujos-de-datos.mmd
```

Reglas de integración:

- Agregar la entrada de `arquitectura/` en `.devin/informes/README.md` (sección "Referencia viva" o equivalente) y en `.devin/README.md` si corresponde; el documento es **referencia viva, no se archiva**.
- Encabezado estándar del proyecto (`abierto | en curso | implementado | archivado`): usar `**Estado:** en curso` mientras se trabaja → `implementado` al cerrar.
- Cada `.md` embebe sus diagramas Mermaid en fences ```mermaid y además referencia el `.mmd` fuente en `diagramas/` (los `.mmd` son la fuente regenerable; los `.md` la lectura).
- No duplicar lo ya documentado en `guia-funcionamiento-pancheria.md`: enlazarlo donde aplique.
- Tres niveles navegables: NIVEL 1 overview → NIVEL 2 módulos/capas → NIVEL 3 código/DB. No mezclar los tres niveles en un solo gráfico.

## Diseño visual

Minimalista, limpio y profesional: poca información por nodo, jerarquía clara, `classDef` con colores discretos, sin cruces innecesarios ni "spaghetti". Priorizar claridad sobre cantidad de nodos.

## Validación

- Sintaxis Mermaid: verificar cada `.mmd`/bloque renderizando (Mermaid Live o `npx -y @mermaid-js/mermaid-cli` si el entorno lo permite; no instalar dependencias nuevas al proyecto por esto).
- Nombres: cada tabla/ruta/servicio/repositorio citado debe existir en el código (verificar con búsquedas, no de memoria).
- Relaciones: cada arista debe tener evidencia en código; si no, `UNKNOWN / UNVERIFIED`.
- Links internos entre los `.md` deben funcionar con rutas relativas.
- No requiere lint/tsc/build/tests: es documentación pura. No modificar código bajo ninguna circunstancia.

## Informe final

Entregar un resumen con:

1. **Arquitectura descubierta** — capas, módulos, DB, integraciones, infraestructura.
2. **Archivos creados/modificados** — lista exacta.
3. **Hallazgos importantes** — problemas o inconsistencias con evidencia.
4. **Discrepancias de documentación** — README/AGENTS/informes vs código real.
5. **Unknowns** — todo lo no verificable, marcado `UNKNOWN / UNVERIFIED`.
6. **Validación** — qué se verificó y resultado.
7. **Próximo paso recomendado** — cómo mantener el mapa actualizado (p. ej. regenerar tras cambios en `src/db/schema.ts`, `vercel.json` o `src/app/api/`; considerar incluir la revisión del mapa en `checklist-pre-push.md` o como paso de las auditorías periódicas).

## Restricción final

No refactorizar, no arreglar hallazgos, no cambiar código funcional, no inventar arquitectura. Primero descubrir la arquitectura real; después representarla. El objetivo: abrir `.devin/informes/arquitectura/README.md` y obtener una visión clara, completa y profesional del sistema sin leer el código fuente.
