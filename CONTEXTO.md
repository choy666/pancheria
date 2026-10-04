# CONTEXTO.md — Panchería

> **Propósito de este archivo:** documento de contexto portable para asistentes de IA (Claude, ChatGPT, etc.). Resume la arquitectura, el dominio y las reglas del proyecto para que las respuestas sean consistentes con el código real y no dupliquen lógica existente.
>
> **Generado:** 2026-10-04 · **Commit:** `987bab1` · **Fuente canónica de reglas:** `AGENTS.md`
>
> **Uso recomendado:** subirlo como Knowledge de un Project en Claude.ai. Cuando una pregunta requiera código exacto, adjuntar además el archivo canónico indicado en §10 — este documento es un mapa, no una copia del código.

---

## 1. Qué es el proyecto

Sistema de gestión para una panchería (hot dogs / comida rápida) con dos superficies:

- **Panel privado** (`/` con sesión): terminal de ventas, productos, recetas, stock, caja, pedidos, usuarios, sucursales, videos.
- **Superficie pública** (`/pedido`): catálogo, carrito, pedidos sin login, chat cliente↔operador, seguimiento.

Todo dato de negocio está aislado por **sucursal** (`branchId`). Es multi-tenant por sucursal, no por cuenta.

## 2. Stack

- **Next.js 16.3.3** (App Router, Turbopack) + **React 19.2.8** + **TypeScript**
- **Drizzle ORM 0.45.2** sobre **PostgreSQL (Neon serverless)**
- **NextAuth v5** (beta) — sesiones JWT; el middleware se llama `src/proxy.ts` (Next 16 renombró `middleware.ts`)
- **Tailwind CSS v4** + shadcn/ui + `@base-ui/react` + `lucide-react`
- **dinero.js** para dinero, **zod v4** para validación, **bcrypt** para passwords, `date-fns`
- Testing: **Jest** + Testing Library (unitarios) y **Playwright** (E2E y accesibilidad con axe-core)
- Deploy: **Vercel**; storage de archivos: `local` | `vercel-blob` | `s3` | `r2`

## 3. Arquitectura por capas

```
src/
├── app/            # App Router: páginas en (panel) / (public) / (auth) + API routes
├── application/    # services: casos de uso (orderService, saleService, cashRegisterService,
│                   #   productService, recipeService, branchService, chatService,
│                   #   stockService, userService, videoService, catalogService, ...)
├── repositories/   # acceso a datos por entidad (la paginación vive acá, con PaginationParams)
├── domain/         # tipos y errores de dominio (DomainError, NotFoundError, InsufficientStockError)
├── db/             # schema.ts (Drizzle), conexión, seeds
├── components/     # UI por feature: caja, cart, chat, pedido, pedidos, productos, promo,
│                   #   stock, sucursales, usuarios, ventas, videos, ui (shadcn)
├── hooks/          # hooks React (useCart/useSellableCart, useDashboard, useCast, ...)
├── config/         # constantes y getters de env vars (routes, caja, chat, videos, product-images, maps)
├── lib/            # helpers transversales (money, catalog, *-helpers, storage, rate-limit, maps, auth)
└── types/          # tipos compartidos
```

Regla de flujo: **ruta API → service → repository → schema**. La lógica de negocio va en `application/services`, no en handlers ni componentes.

## 4. Modelo de dominio

### Tablas (`src/db/schema.ts`)

`branches`, `users`, `products`, `recipes`, `cash_registers`, `sales`, `sale_payments`, `sale_items`, `orders`, `order_items`, `sale_item_recipes`, `order_item_recipes`, `order_stock_reservations`, `order_messages`, `stock_movements`, `videos`, `login_attempts`, `public_order_rate_limits`.

### Enums clave

| Enum | Valores |
|---|---|
| `user_role` | `admin`, `operator` |
| `product_type` | `critical_supply`, `manual_supply`, `compound`, `service` |
| `critical_supply_type` | `bread`, `sausage`, `beverage` |
| `payment_method` | `cash`, `transfer` |
| `sale_status` | `active`, `cancelled` |
| `order_status` | `pending` → `in_process` → `paid` → `finished` · `cancelled` |
| `stock_movement_type` | `sale`, `cancellation`, `manual_adjustment`, `restock`, `reserve`, `reserve_release` |
| `cash_register_status` | `open`, `closed` |
| `delivery_type` | `delivery`, `pickup` |
| `order_message_sender` | `client`, `operator` |

### Tipos de producto (regla central del dominio)

- `critical_supply`: insumo crítico (pan/salchicha/bebida). Con `autoDiscount: true` en la receta es el **único que descuenta stock**. Obligatorio en promos.
- `manual_supply`: insumo opcional en recetas (salsas, condimentos). **No descuenta stock**. Quitarlo no cambia el precio de la promo.
- `compound`: promo con receta propia (`recipes` define insumos, cantidades, `isOptional`, `selectedByDefault`).
- `service`: extra ilimitado, sin stock. Puede ser opción gratuita dentro de una promo **y** producto cobrable standalone con `price` propio.
- Vendibles al público: `compound`, `service`, y `critical_supply` tipo `beverage`. Lógica en `src/lib/catalog.ts`.

## 5. Flujos de negocio críticos

- **Pedido público `pending` NO reserva stock.** `createOrder` valida disponibilidad sin reservar; `receiveOrder` (→ `in_process`) crea reservas en `order_stock_reservations` + movimiento `reserve`; `convertOrderToSale` y `cancelOrder` liberan la reserva solo si estaba `in_process`. La expiración de `pending` (`ORDER_EXPIRATION_MS`, default 1 h) no toca stock y también es **lazy** en las lecturas.
- **Ventas** soportan pagos mixtos (`sale_payments` con cash/transfer). `confirmSale`, `createOrder` y `convertOrderToSale` comparten helpers (`validateProductsForOperation`, `buildSaleItemValues`). `convertOrderToSale` conserva precios históricos del pedido.
- **Snapshots de receta**: cada venta/pedido persiste la receta seleccionada en `sale_item_recipes`/`order_item_recipes` — editar una receta jamás altera el historial.
- **Idempotencia**: pedidos y ventas usan `INSERT ... ON CONFLICT DO NOTHING` + huella SHA-256 canónica del payload. Misma clave+misma huella deduplica; misma clave+payload diverso → **409**. Todo campo nuevo de ítem (ej. `notes`) debe entrar en la huella.
- **Carrito**: `quantity` se modela como N líneas independientes (una por unidad); solo se fusionan líneas idénticas (producto + receta + nota). El carrito se invalida al cambiar de sucursal.
- **Caja**: `open`/`closed` con soft delete + papelera (`/api/caja/eliminadas`, restaura stock). Avisos por turnos de `branches.opening_hours` (JSONB, soporta overnight `close < open`, TZ vía `NEXT_PUBLIC_BRANCH_TIMEZONE`): `fuera_de_horario` / `cierre_recomendado` calculados en el servidor.
- **Soft delete vs hard delete**: productos, cajas y videos = soft delete (`deletedAt`) con papelera; el archivo asociado NO se libera hasta el hard delete. Sucursales = hard delete total en cascada, sin historial.
- **Chat de pedidos**: `order_messages` con token público (`cancellationToken`), polling con backoff o SSE opt-in. Es el único canal con el cliente — **la integración con WhatsApp fue eliminada, no reintroducirla**.
- **Tokens de URL no autorizan dinero**: la cancelación pública solo toca `pending`/`in_process`; anular un pedido `paid` exige panel autenticado.

## 6. Reglas duras (no negociables)

1. **Todo en español**: código de usuario, comentarios, docs.
2. **Cero hardcodeo**: credenciales, URLs, dominios y parámetros salen de env vars / `src/config/`. Ni URLs de mapas ni dominios de storage en literales.
3. **Aislamiento por `branchId`**: toda query de negocio filtra por sucursal.
4. **Dinero**: UI muestra pesos argentinos enteros (`formatMoney` → `$ 1.500`, sin centavos); storage en `numeric(10,2)`; validaciones con `Math.round`.
5. **Validación con zod** en bordes (rutas API, formularios).
6. **Errores**: `NotFoundError` → 404, `DomainError` → 400, fallos de conexión DB → 503 (helper en `src/lib/db-errors.ts`). Server actions con `useActionState` **devuelven** `{ error }`, no lanzan.
7. **Convención env vars**: lógica de negocio en vars de servidor (`X`); el valor resuelto viaja en el payload; `NEXT_PUBLIC_*` solo para lo que el cliente necesita autónomamente. No crear getters duales `X ?? NEXT_PUBLIC_X`.
8. **No leer `localStorage`/APIs de cliente en render** (hydration mismatch): estado inicial SSR-seguro + carga en `useEffect`.
9. **Nada de `get`+`set` para operaciones atómicas**: usar `ON CONFLICT`, transacciones o `SELECT FOR UPDATE`.
10. **Endpoints públicos de escritura llevan rate limit** (`createRateLimiter` con scope propio).
11. **La superficie pública no expone stock interno**: sanitizar en wrappers (`toPublicCatalogProduct`), errores con `code` estructurado.
12. **JWT se revalida**: paths con `auth()` deben pasar por `revalidateSessionUser` para rechazar usuarios eliminados.
13. **Migraciones**: todo cambio en `schema.ts` se acompaña de `npx drizzle-kit generate` + commit en `drizzle/`.
14. **`data-testid`** en componentes que testea Playwright; nunca `getByText` con números sueltos.

## 7. Comandos

| Acción | Comando |
|---|---|
| Dev | `npm run dev` |
| Build | `npm run build` (no requiere DB) |
| Lint | `npm run lint` |
| Tests unitarios | `npm test` |
| Tipos | `npx tsc --noEmit` |
| E2E | `npm run test:e2e` (**solo contra base descartable**, ver §9) |
| Migración: generar | `npx drizzle-kit generate` |
| Migración: aplicar | `npx drizzle-kit migrate` |
| Seed | `npx tsx src/db/seeds.ts` |

## 8. Entornos y seguridad (resumen)

- Runtime DB: `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`. Migraciones: `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING`.
- Auth: `AUTH_SECRET` (preferido) o `NEXTAUTH_SECRET` ≥32 bytes; `AUTH_URL` tiene prioridad sobre `NEXTAUTH_URL` y **debe ser el dominio real en producción** (si queda en localhost, los redirects se rompen).
- `STORAGE_PROVIDER=local` solo en dev — el filesystem de Vercel es efímero. El build de producción lo rechaza.
- Rate limiting: `memory` en dev/test, `db` recomendado en producción multi-instancia (`login_attempts`, `public_order_rate_limits`).
- Crons: `rate-limit-cleanup` y `chat-attachments-cleanup` (schedule en `vercel.json`), `expire-orders` (GitHub Actions). Protegidos por `CRON_SECRET`. Los schedules **no** son env vars.
- **Detalle completo de las ~60 env vars: `.env.example` y `AGENTS.md`** — no asumas una variable que no esté ahí.

## 9. Advertencias de testing

- `tests/e2e/global-setup.ts` **trunca todas las tablas de negocio** y re-seedea. Nunca correr E2E contra una base con datos reales; el nombre de la base debe terminar en `test`/`e2e`/`testing`/`qa`/`staging`.
- E2E requiere `.env.e2e` (base descartable, credenciales de seed, `DATA_CACHE_REVALIDATE_S=0`).
- Inserciones bulk en specs se limpian en `finally` — los specs comparten la misma base.

## 10. Archivos canónicos por tema (para adjuntar al chat)

| Si la pregunta toca… | Adjuntar |
|---|---|
| Tablas, columnas, relaciones, enums | `src/db/schema.ts` |
| Reglas de negocio de un flujo | el service correspondiente en `src/application/services/` (ej. `orderService.ts`) |
| Un endpoint concreto | el `route.ts` en `src/app/api/...` |
| Catálogo / vendibilidad de productos | `src/lib/catalog.ts` |
| Dinero, formato, validación de montos | `src/lib/money.ts` |
| Carrito | `src/hooks/useCart.ts`, `src/lib/cart-helpers.ts` |
| Turnos/horarios de sucursal | `src/lib/branch-helpers.ts`, `src/lib/cash-register-helpers.ts` |
| Env vars | `.env.example` |
| Reglas completas del proyecto | `AGENTS.md` (este doc es su resumen) |
| Errores ya cometidos / decisiones tomadas | `.devin/informes/lecciones-aprendidas.md` |
| Funcionamiento funcional completo | `.devin/informes/guia-funcionamiento-pancheria.md` |

## 11. Instrucciones para el asistente que lee esto

- Respondé siempre en español y siguiendo las reglas de §6.
- Este doc describe el proyecto al commit `987bab1` (2026-10-04). Si tu respuesta depende de un código exacto que podría haber cambiado, **pedime el archivo canónico** en vez de asumir.
- No propongas helpers/sistemas que ya existen (rate-limit, storage, chat, money, api-handler): revisá la tabla §10 o pedime el archivo.
- No reintroduzcas integración con WhatsApp ni endpoints de escritura públicos sin rate limit.
- Cuando sugieras cambios de schema, recordá que requieren migración Drizzle commiteada.

---

*Para regenerar/actualizar: revisar secciones 4-5 tras cambios de schema o flujos, y actualizar fecha + commit del encabezado. Las partes variables (tablas, enums, rutas) se derivan de `src/db/schema.ts` y `src/app/`.*
