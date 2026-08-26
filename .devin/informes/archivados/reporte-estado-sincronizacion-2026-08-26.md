# Reporte de estado — Auditoría de sincronización de tests, E2E y documentación

**Fecha:** 2026-08-26  
**Proyecto:** `pancheria`  
**Baseline:** `HEAD` (`1a4c061`) — branch `main`

---

## 1. Resumen ejecutivo

Se ejecutó la auditoría de sincronización solicitada sobre **tests unitarios (Jest)**, **tests end-to-end (Playwright)** y **documentación vigente** (`AGENTS.md`, `README.md`, `.env.example`, `.devin/environment.yaml`, prompts e informes). Se corrigieron desfases documentales respaldados por el código y se documentaron gaps de cobertura que requieren tareas separadas.

**Verificaciones automáticas:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` pasan. La suite unitaria reporta **92 suites y 893 tests**.

**No se ejecutaron** `npm run test:e2e`, `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate` ni `npx drizzle-kit check` por requerir confirmación explícita del usuario y una base de datos descartable.

---

## 2. Tabla de sincronización

| Área | Estado | Evidencia | Referencias |
|------|--------|-----------|-------------|
| **Tests unitarios (Jest)** | Sincronizados / con gaps identificados | 92 suites, 893 tests pasan. Funcionalidades críticas (`convertOrderToSale`, rate limit, `idempotencyService`, soft delete) están cubiertas. Faltan tests para `getPublicBaseUrl`, `rate-limit.ts`, `rate-limit-store.ts` y varias rutas API de caja. | <ref_file file="C:/developer/paginas/pancheria/package.json" />, listado de `npx jest --listTests` |
| **Tests E2E (Playwright)** | Sincronizados / con riesgos de selectores | 22 specs cubren flujos principales. Existen locators frágiles (`data-slot` de shadcn, `td:nth-child`, nombres hardcodeados del seed) y flujos no cubiertos (rate limit, expiración de pedidos, cierre automático de caja). | <ref_file file="C:/developer/paginas/pancheria/tests/e2e" />, análisis de `data-testid` en `src/` |
| **Documentación de variables de entorno** | Corregida | `.env.example`, `AGENTS.md`, `README.md` y `.devin/environment.yaml` fueron actualizados. Se eliminaron variables no consumidas por el código, se agregaron aliases de Vercel Postgres y `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`. | <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />, <ref_file file="C:/developer/paginas/pancheria/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" /> |
| **Prompts y blueprints** | Parcialmente corregida | Se actualizó la versión de Next.js de `16.3.2` a `16.3.3` en los prompts activos. `.devin/environment.yaml` ahora refleja las variables y la estructura real. | <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/correccion-tests-e2e-caja-y-entorno.md" /> |
| **Guía de funcionamiento** | Vigente | `guia-funcionamiento-pancheria.md` refleja el estado actual del flujo de pedidos, stock y caja. | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> |
| **Plan de acción** | Pendientes actualizados | Los pendientes de E2E y DRS continúan abiertos. La sincronización de `.devin` se avanzó en esta sesión. | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/plan-de-accion-pendientes.md" /> |

---

## 3. Hallazgos y acciones correctivas

### Crítico

Ningún hallazgo crítico que afecte el build o la seguridad. No se encontraron credenciales expuestas.

### Mayor

#### 3.1 Variables de entorno documentadas pero no consumidas por el código

`CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` y `PUBLIC_ORDER_RATE_LIMIT_CLEANUP_SCHEDULE` aparecían en `.env.example`, `AGENTS.md`, `README.md` y `.devin/environment.yaml`, pero **no se leen en ningún archivo de `src/`**. Los schedules de los cron jobs están hardcodeados en <ref_file file="C:/developer/paginas/pancheria/vercel.json" />.

**Acción aplicada:**
- Se eliminaron ambas variables de `.env.example` y se reemplazaron por un comentario que remite a `vercel.json`.
- Se eliminaron de la lista de variables de `AGENTS.md` y se agregó una nota sobre `vercel.json`.
- Se eliminaron de los listados de variables de `README.md` y `.devin/environment.yaml`.

> Referencias: búsqueda en `src/` sin resultados para `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` ni `PUBLIC_ORDER_RATE_LIMIT_CLEANUP_SCHEDULE`; <ref_file file="C:/developer/paginas/pancheria/vercel.json" />.

---

### Menor

#### 3.2 Faltaban aliases de Vercel Postgres en `.env.example`

`src/db/index.ts` prueba `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`, y `drizzle.config.ts` prueba `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`. `AGENTS.md` ya los mencionaba en troubleshooting, pero `.env.example` no los exponía como alternativas.

**Acción aplicada:** se agregaron `POSTGRES_URL`, `POSTGRES_PRISMA_URL` y `POSTGRES_URL_NON_POOLING` como alternativas comentadas en `.env.example`, y se actualizó la descripción de `DATABASE_URL` en `AGENTS.md`.

> Referencias: <ref_file file="C:/developer/paginas/pancheria/src/db/index.ts" />, <ref_file file="C:/developer/paginas/pancheria/drizzle.config.ts" />, <ref_file file="C:/developer/paginas/pancheria/.env.example" />.

#### 3.3 `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` no estaba documentada

El componente <ref_file file="C:/developer/paginas/pancheria/src/components/conditional-analytics.tsx" /> consume `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`, pero no estaba en `AGENTS.md`, `README.md` ni `.devin/environment.yaml` (sí estaba en `.env.example`).

**Acción aplicada:** se agregó la descripción en `AGENTS.md`, `README.md` (sección de videos) y `.devin/environment.yaml`.

#### 3.4 Faltaban variables de caja y seed en algunos documentos

`NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS`, `NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS` y `NEW_BRANCH_NAME`/`NEW_BRANCH_USERNAME`/`NEW_BRANCH_PASSWORD` no aparecían en todos los documentos principales.

**Acción aplicada:** se agregaron a los listados de variables de `README.md` y `.devin/environment.yaml`.

#### 3.5 Versiones desactualizadas de Next.js en prompts

`pancheria.prompt.md`, `auditoria-y-documentacion.md` y `correccion-tests-e2e-caja-y-entorno.md` indicaban `Next.js 16.3.2`; `package.json` y el build usan `16.3.3`.

**Acción aplicada:** se actualizaron a `Next.js 16.3.3`.

> Referencia: <ref_file file="C:/developer/paginas/pancheria/package.json" />.

#### 3.6 `TRUSTED_PROXY_IP_HEADER` faltaba en `.devin/environment.yaml`

La variable se usa en <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" /> pero no se listaba en el blueprint.

**Acción aplicada:** se agregó a las entradas `database`, `pedidos` y `deploy` de `.devin/environment.yaml`.

#### 3.7 `HOST` / `PORT` no estaban documentados

`getPublicBaseUrl()` en <ref_file file="C:/developer/paginas/pancheria/src/lib/public-url.ts" /> lee `HOST` y `PORT` como fallback de desarrollo antes de caer a `localhost:3000`.

**Acción aplicada:** se agregó la descripción en `AGENTS.md`.

---

### Informativo

#### 3.8 Node.js en CI vs documentación

`.github/workflows/ci.yml` usa Node.js 22 mientras `README.md` y `.devin/environment.yaml` indican 20 LTS. Esto es compatible porque la documentación dice "20 LTS o superior".

**Acción aplicada:** se aclaró el nombre del paso en `.devin/environment.yaml` a "Instalar Node.js 20 LTS o superior".

#### 3.9 Estructura `(public)`

`.devin/environment.yaml` y los prompts listaban `src/app/(public)/` como grupo de rutas. El grupo existe (<ref_file file="C:/developer/paginas/pancheria/src/app/(public)/layout.tsx" />), pero solo contiene rutas bajo `pedido/`. Para mayor precisión, `environment.yaml` ahora dice `src/app/(public)/pedido/`.

---

## 4. Tests unitarios — estado y gaps

### 4.1 Conteos

| Métrica | Valor |
|---------|-------|
| Archivos `*.test.ts` | 42 |
| Archivos `*.test.tsx` | 13 |
| Total archivos de test | 55 |
| Tests `.test.ts` | 793 |
| Tests `.test.tsx` | 100 |
| **Total tests** | **893** |
| Suites reportadas por Jest | 92 |

Los conteos coinciden con `npm test`.

### 4.2 Funcionalidades clave cubiertas

| Funcionalidad | Test | Estado |
|---------------|------|--------|
| `convertOrderToSale` | `src/application/services/orderService.test.ts` | Sincronizado. Feliz, errores, idempotencia, precios históricos y stock. |
| Rate limit store público | `src/lib/public-order-rate-limit-store.test.ts` | Sincronizado. `memory` y `db`. |
| `idempotencyService` | `src/application/idempotencyService.test.ts` | Parcial. `isIdempotencyKeyUsed` cubierta; `findExistingByIdempotencyKey` solo se mockea. |
| Soft delete productos/cajas | `src/application/services/productService.test.ts`, `src/application/services/cashRegisterService.test.ts` | Sincronizado. |
| `getWhatsAppMessageParts` | `src/lib/whatsapp.test.ts` | Parcial. No hay test directo de `getWhatsAppMessageParts`; `buildWhatsAppUrl` no está cubierta. |
| `getPublicBaseUrl` | — | **Falta.** Usado en `src/lib/whatsapp.ts` y `src/lib/storage.ts`. |

### 4.3 Archivos de producción sin test (gaps relevantes)

#### `src/lib/*`

- `public-url.ts` — `getPublicBaseUrl()` (alta prioridad).
- `rate-limit.ts` — `getClientIp` y `createRateLimiter` (alta prioridad).
- `rate-limit-store.ts` — `InMemoryRateLimitStore` y `DbRateLimitStore` para login (alta prioridad).
- `api-handler.ts` — `withApiErrorHandling` (alta prioridad).
- `storage.ts` — múltiples proveedores de almacenamiento (media).
- `summaryService.ts` — cálculo de resúmenes de venta (media).

#### Rutas API sin test

- `src/app/api/caja/abrir/route.ts`
- `src/app/api/caja/cerrar/route.ts`
- `src/app/api/caja/resumen/route.ts`
- `src/app/api/pedidos/[id]/confirmar/route.ts`
- `src/app/api/caja/[id]/*/route.ts` (detalle, restaurar, permanente, eliminadas)
- `src/app/api/videos/*/route.ts` (upload, stream)

#### Componentes sin test

Muchos componentes UI (`caja-panel.tsx`, `chat-composer.tsx`, `video-player.tsx`, etc.) no tienen test. Esto es aceptable si se cubren con E2E, pero conviene priorizar los críticos.

> Ver la sección 7 para recomendaciones de tareas separadas.

---

## 5. Tests E2E — estado y riesgos

### 5.1 Especificaciones encontradas

Se encontraron **22 specs** en `tests/e2e/*.spec.ts`:

| Spec | Flujo |
|------|-------|
| `login.spec.ts` | Login y redirecciones |
| `productos-y-recetas.spec.ts` | Creación/edición de productos y recetas |
| `roles-y-sucursales.spec.ts` | Roles, sucursales y usuarios |
| `pedido.spec.ts` | Catálogo, carrito y creación de pedido |
| `pedido-chat.spec.ts` | Chat de pedidos |
| `pedido-chat-adjuntos.spec.ts` | Adjuntos en el chat |
| `pedido-sucursal-y-stock.spec.ts` | Sucursal, carrito y confirmación de pedido |
| `ventas-disponibilidad.spec.ts` | Disponibilidad en terminal |
| `ventas-historial.spec.ts` | Venta, cierre e historial |
| `ventas-stock-compartido.spec.ts` | Promos con insumos compartidos |
| `stock-y-movimientos.spec.ts` | Ajustes y movimientos de stock |
| `caja-aislamiento-y-trazabilidad.spec.ts` | Aislamiento de cajas por sucursal |
| `caja-cierre-vacios.spec.ts` | Caja sin ventas |
| `flujo-diario.spec.ts` | Flujo completo de operación |
| `smoke.spec.ts` | Smoke de páginas protegidas |
| `tour.spec.ts` | Recorrido interactivo |
| `videos.spec.ts` | Videos, subida y reproducción |
| `responsive.spec.ts` | Responsividad móvil |
| `validaciones-y-papelera.spec.ts` | Validaciones y papelera de cajas |
| `paso3.spec.ts`, `paso4.spec.ts` | Flujos guiados de operador |
| `prod-login-and-tour.spec.ts` | Smoke de producción |

### 5.2 Riesgos identificados

| Riesgo | Gravedad | Evidencia |
|--------|----------|-----------|
| **Dependencia de nombres del seed** | Mayor | `productos-y-recetas.spec.ts`, `paso3.spec.ts`, `paso4.spec.ts`, `ventas-historial.spec.ts` buscan `Pan`, `Salchichas`, `Coca de 1L`, `Promo 1`, `Vaso de gaseosa`. Si el seed cambia, fallan. |
| **Uso de `data-slot` de shadcn/ui** | Mayor | `productos-y-recetas.spec.ts`, `roles-y-sucursales.spec.ts`, `caja-cierre-vacios.spec.ts`, `flujo-diario.spec.ts`, `ventas-disponibilidad.spec.ts`, `ventas-stock-compartido.spec.ts`, `ventas-historial.spec.ts` usan `[data-slot="select-content"]`, `[data-slot="select-item"]`, `[data-slot="card"]`, `[data-slot="badge"]`, `[data-slot="dialog-close"]`. Son atributos internos que pueden cambiar. |
| **Selectores por posición (`td:nth-child`)** | Menor | `productos-y-recetas.spec.ts` usa `td:nth-child(5) [data-slot="badge"]`. Frágil ante reordenamiento de columnas. |
| **Uso de `.first()`, `.last()`, `.nth()` sin selectores estables** | Menor | 88 usos en specs; pueden ser frágiles si hay duplicados. |

### 5.3 `data-testid` expuestos pero no usados en E2E

- `empty-trash`
- `restore-cash-register-{id}`, `permanent-delete-cash-register-{id}`, `delete-cash-register-{id}`
- `branch-select-label`, `single-branch-indicator`
- `whatsapp-icon`, `order-summary`
- `recent-orders-banner`
- `checkout-button`

### 5.4 Flujos críticos no cubiertos por E2E

- Edición/eliminación de recetas.
- Cambio de precios de productos.
- Rate limiting de pedidos y chat.
- Expiración automática de pedidos (`ORDER_EXPIRATION_MS`).
- Cierre automático de cajas (`CAJA_AUTO_CLOSE_HOURS`).
- Anulación de pedidos.
- Cambio de contraseña de usuarios.
- Búsqueda/filtrado y paginación en listados.

---

## 6. Discrepancias corregidas entre documentación y código

| Discrepancia | Archivos afectados | Corrección aplicada |
|--------------|-------------------|---------------------|
| Variables de cron no consumidas por el código | `.env.example`, `AGENTS.md`, `README.md`, `.devin/environment.yaml` | Eliminadas `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` y `PUBLIC_ORDER_RATE_LIMIT_CLEANUP_SCHEDULE`; se agregó nota remitiendo a `vercel.json`. |
| Faltaban aliases de Vercel Postgres en `.env.example` | `.env.example`, `AGENTS.md` | Agregados `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`. |
| `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` no documentada | `AGENTS.md`, `README.md`, `.devin/environment.yaml` | Agregada descripción. |
| Variables de caja y seed faltaban en docs | `README.md`, `.devin/environment.yaml` | Agregadas `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS`, `NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS`, `NEW_BRANCH_*`. |
| `TRUSTED_PROXY_IP_HEADER` faltaba en blueprint | `.devin/environment.yaml` | Agregada a `database`, `pedidos` y `deploy`. |
| `HOST` / `PORT` no documentados | `AGENTS.md` | Agregados como opcionales para el fallback de desarrollo de `getPublicBaseUrl()`. |
| Versión de Next.js desactualizada en prompts | `.devin/prompts/pancheria.prompt.md`, `auditoria-y-documentacion.md`, `correccion-tests-e2e-caja-y-entorno.md` | Actualizadas a `16.3.3`. |
| Estructura `(public)` imprecisa | `.devin/environment.yaml` | Cambiado a `src/app/(public)/pedido/`. |

---

## 7. Recomendaciones y tareas separadas

### 7.1 Alta prioridad — tests unitarios

1. **Crear `src/lib/public-url.test.ts`** para `getPublicBaseUrl()` con casos de browser, servidor, producción, `HOST`/`PORT` y fallback de desarrollo.
2. **Crear `src/lib/rate-limit.test.ts`** para `getClientIp` (headers Vercel, `X-Forwarded-For`, `TRUSTED_PROXY_IP_HEADER`) y `createRateLimiter`.
3. **Crear `src/lib/rate-limit-store.test.ts`** para `InMemoryRateLimitStore` y `DbRateLimitStore`.
4. **Crear `src/lib/api-handler.test.ts`** para `withApiErrorHandling` (`DomainError` → 400, `NotFoundError` → 404, `ForbiddenError` → 403, `ECONNREFUSED` → 503, client abort → 499).
5. **Crear tests para rutas críticas de caja y pedidos** (`caja/abrir`, `caja/cerrar`, `caja/resumen`, `pedidos/[id]/confirmar`).

### 7.2 Media prioridad — tests E2E

1. **Eliminar dependencia de nombres del seed** en `productos-y-recetas.spec.ts`, `paso3.spec.ts`, `paso4.spec.ts`, `ventas-historial.spec.ts`. Crear productos vía API o usar `data-testid` estables.
2. **Reemplazar `data-slot` de shadcn/ui** por `data-testid` en los componentes afectados (select, badge, card, dialog).
3. **Reemplazar `td:nth-child`** por `data-testid` en celdas de tablas.
4. **Agregar tests para flujos faltantes:** edición/eliminación de recetas, rate limit, expiración de pedidos, cierre automático de caja, anulación de pedidos.

### 7.3 Baja prioridad — documentación y blueprints

1. Verificar `.devin/environment.yaml` con `devin.exe cloud drs build` cuando se configure `devin.exe auth login`.
2. Revisar periódicamente prompts archivados para eliminar referencias a `sentAt` y otras funcionalidades eliminadas.
3. Considerar agregar una sección de "selectores E2E" en `lecciones-aprendidas.md` o `AGENTS.md` para reforzar el uso de `data-testid` sobre `data-slot` y `nth-child`.

---

## 8. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `git log --oneline -30` | Baseline confirmado (`1a4c061` en `main`) |
| 2 | `npx jest --listTests` | 92 archivos listados |
| 3 | `npm run lint` | Pasa (exit 0) |
| 4 | `npx tsc --noEmit` | Pasa |
| 5 | `npm test` | 92 suites, 893 tests pasan |
| 6 | `npm run build` | Build exitoso (42 páginas dinámicas) |
| 7 | `npm run knip` | Sin problemas |
| 8 | Verificación de `data-testid` | 28 atributos en `src/`, 45 referencias en `tests/e2e/` |
| 9 | Búsqueda de variables no consumidas (`CHAT_ATTACHMENTS_CLEANUP_SCHEDULE`, `PUBLIC_ORDER_RATE_LIMIT_CLEANUP_SCHEDULE`) | No usadas en `src/` |

---

## 9. Enlaces relevantes

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/plan-de-accion-pendientes.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
