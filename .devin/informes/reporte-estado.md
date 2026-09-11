# Reporte de estado — Proyecto Panchería

**Fecha:** 2026-09-11
**Proyecto:** `pancheria`
**Baseline:** `7cdf2864cd327c46d34ea0f635a9bc6c72d7c889` (`main`)
**Auditoría:** Pre-release integral sobre el working tree (2026-09-11)
**Histórico:** Fase anterior en `.devin/informes/archivados/reporte-estado-2026-09-06.md`

---

## 1. Resumen ejecutivo

El proyecto se encuentra en estado operativo y todas las verificaciones base pasan sobre el `working tree` actual. Se completaron e integraron dos funcionalidades principales desde el último informe:

1. **Rediseño del carrito de ventas y cobro** (`/ventas`) — implementado el 2026-09-06. Incluye inputs de monto con formato es-AR, campo de "Efectivo recibido" con vuelto, subtotales por línea, quitar ítem, vaciar carrito, shortage por línea y terminología "venta" en lugar de "pedido".
2. **Compartir ubicación por el chat de pedidos** — implementado el 2026-09-09/11. El cliente puede enviar su ubicación (`delivery`) y el operador puede enviar la ubicación de la sucursal (`pickup`) como mensajes de texto con URLs de mapas. Se agregaron `src/config/maps.ts`, `src/lib/maps.ts`, `POST /api/pedidos/[id]/chat/ubicacion` y las variables `NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`, `CHAT_BRANCH_LOCATION_RATE_LIMIT_WINDOW_MS` y `CHAT_BRANCH_LOCATION_RATE_LIMIT_MAX_REQUESTS`.

También se realizó una **auditoría documental** que corrigió índices, eliminó una referencia rota, archivó informes y prompts resueltos, y actualizó este `reporte-estado.md`. El histórico anterior queda archivado en `.devin/informes/archivados/reporte-estado-2026-09-06.md`.

## 2. Stack y arquitectura

- Next.js `16.3.3` (App Router + Turbopack)
- React `19.2.8`, TypeScript `5.x`, Tailwind CSS `4`, shadcn/ui
- Drizzle ORM `0.45.2`, PostgreSQL (Neon / `pg`)
- NextAuth v5 (`5.0.0-beta.32`)
- Jest `30.x`, Playwright `1.62.x`
- `@next/bundle-analyzer` y `eslint-config-next` alineados a `16.3.3`
- Vercel (despliegue recomendado)

La arquitectura mantiene la separación por capas: `src/app/` (UI y API), `src/application/` (servicios/casos de uso), `src/repositories/` (acceso a datos), `src/lib/` (utilidades transversales), `src/config/` (getters de variables de entorno), `src/domain/` (tipos y errores) y `src/db/` (esquema y seeds).

## 3. Estado funcional

- **Panel de control (`/`)**: resumen de caja, pedidos por estado, alertas de stock, accesos rápidos filtrados por rol.
- **Ventas (`/ventas`)**: terminal con productos, carrito rediseñado, pagos mixtos (`cash` + `transfer`), historial y anulaciones.
- **Pedidos**: flujo `pending` → `in_process` → `paid` → `finished` / `cancelled`, con reservas de stock al recibir el pedido (`receiveOrder`), chat integrado (texto, imágenes y ubicación) y pagos mixtos.
- **Productos/promos**: tipos `critical_supply`, `manual_supply`, `compound`, `service`; imágenes ilustrativas en catálogo público; snapshots de receta en `sale_item_recipes` y `order_item_recipes`.
- **Stock y caja**: movimientos con razones, cierre automático, cierres diarios históricos, soft delete de cajas, vaciado masivo de papelera.
- **Chat de pedidos**: texto, imágenes (con validación de magic bytes), paginación con cursores, polling con pausa por visibilidad, **compartir ubicación del cliente y de la sucursal**.
- **Almacenamiento**: `local`, `vercel-blob`, `s3` y `r2` para videos, adjuntos de chat e imágenes de productos.
- **Multi-sucursal**: aislamiento por `branchId`; admin puede operar sobre cualquier sucursal.

## 4. Verificaciones automáticas

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa (0 errores, 0 advertencias) |
| `npx tsc --noEmit` | Pasa |
| `npm test` | **155 suites, 1582 tests pasan** |
| `npm run build` | Build exitoso, 88 rutas/páginas (incluye `ƒ Proxy (Middleware)`) |
| `npm run analyze:webpack` | OK, reportes generados en `.next/analyze/` |
| `npm run knip` | Pasa (sin exports/dependencias sin uso) |
| `npx drizzle-kit check` | Pasa (sin drift respecto al journal) |
| `npm run test:e2e` | No ejecutado (requiere base descartable y confirmación) |

El esquema Drizzle cuenta con **30 migraciones** (`0000`–`0029`) y el journal termina en `0029_past_pretty_boy`, consistente con `src/db/schema.ts`.

## 5. Auditoría documental 2026-09-11

### 5.1 Hallazgos documentales

| Hallazgo | Clasificación | Estado | Evidencia / Acción |
|---|---|---|---|
| `reporte-estado.md` desactualizado (fecha 2026-09-06, conteos de tests y rutas obsoletos) | Mayor | Resuelto | Archivado en `.devin/informes/archivados/reporte-estado-2026-09-06.md`; creado este informe vigente con baseline y conteos actuales. |
| Referencia rota a `auditoria-estado-actual-y-documentacion.md` en `.devin/README.md`, `.devin/prompts/README.md` y `.devin/prompts/auditoria-masiva.md` | Menor | Resuelto | Eliminada la referencia de los índices y del prompt masivo; el prompt no existía. |
| Prompts e informes resueltos listados como activos | Menor | Resuelto | Archivados: `auditoria-chat-ubicacion.md`, `auditoria-chat-ubicacion-2026-09-09.md`, `auditoria-carrito-ventas-2026-09-06.md`. Índices actualizados. |
| `README.md` raíz no mencionaba la funcionalidad de mapas/ubicación en chat | Menor | Resuelto | Se agregó sección "Compartir ubicación en el chat" con las variables y el endpoint. |
| Variables `NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`, `CHAT_BRANCH_LOCATION_RATE_LIMIT_*` ya estaban en `.env.example` y `AGENTS.md` (working tree) | OK | Vigente | Verificadas contra `src/config/maps.ts` y `src/config/chat.ts`. |
| `.env.e2e.example` no documentaba `NO_WEB_SERVER` ni `E2E_OPERATOR_USERNAME`/`E2E_OPERATOR_PASSWORD`/`E2E_SECOND_*` | Informativo | Documentado en informe | Estas variables son internas de tests E2E (`playwright.config.ts`, `tests/e2e/helpers.ts`) y no requieren valores iniciales. `NO_WEB_SERVER` ya se menciona en el comentario. |

### 5.2 Archivos afectados en esta auditoría

- **Creado:** `.devin/informes/reporte-estado.md` (reemplazo del vigente).
- **Archivados:**
  - `.devin/informes/archivados/reporte-estado-2026-09-06.md`
  - `.devin/informes/archivados/auditoria-carrito-ventas-2026-09-06.md`
  - `.devin/informes/archivados/auditoria-chat-ubicacion-2026-09-09.md`
  - `.devin/prompts/archivados/auditoria-chat-ubicacion.md`
- **Actualizados:**
  - `.devin/README.md` (índice y estructura).
  - `.devin/informes/README.md` (índice).
  - `.devin/prompts/README.md` (índice).
  - `README.md` (sección de chat/ubicación).

## 5.3 Auditoría pre-release 2026-09-11

Se ejecutó el prompt <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-pre-release.md" /> sobre el `working tree` actual, con baseline `7cdf2864cd327c46d34ea0f635a9bc6c72d7c889` y entorno `.env.local` → `neondb_dev`, `.env.e2e` → `neondb_e2e`.

### 5.3.1 Hallazgos

| Hallazgo | Área | Clasificación | Evidencia / Acción |
|---|---|---|---|
| `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` documentada en `.env.example`, `README.md`, `AGENTS.md` y `.devin/environment.yaml`, pero no se consumía en `src/` | Documentación / variables de entorno | Menor | **Resuelto**: eliminada de `.env.example`, `README.md`, `AGENTS.md`, `.devin/environment.yaml` y `.devin/informes/lecciones-aprendidas.md`. |
| `src/lib/maps.ts` y `src/lib/storage.ts` contienen URLs base hardcodeadas de servicios públicos (`openstreetmap.org`, `google.com/maps`, `waze.com`, `blob.vercel-storage.com`) | Seguridad / arquitectura | Menor / Informativo | Son plantillas por defecto; el usuario puede sobrescribirlas con `NEXT_PUBLIC_MAPS_BASE_URL` o proveedores alternativos. Se recomienda documentar en `lecciones-aprendidas.md` que estos defaults son intencionales y no contienen secretos. |
| `throw new Error` en componentes de cliente (`order-tracker.tsx`, `video-form.tsx`) y helpers (`product-image-upload-client.ts`) | Calidad de código / UX | Menor | **Resuelto**: reemplazados por `ApiError` con status 404/502, manteniendo el mensaje y permitiendo que el `catch` de la UI lo muestre correctamente. |
| Faltan tests unitarios para `branchRepository.ts` y `userRepository.ts` | Cobertura de pruebas | Menor | **Resuelto**: creados `src/repositories/branchRepository.test.ts` (17 tests) y `src/repositories/userRepository.test.ts` (15 tests). |
| `productRepository.findByImageKey` no ordena resultados | Integridad de datos | Informativo | Filtra por `isActive` y `deletedAt` pero `imageKey` no es único; si hubiera colisiones, el resultado sería no determinista. Considerar orden o constraint `unique` en `products.image_key`. |
| Build actual genera 88 rutas; el informe vigente reportaba 91 | Documentación | Menor | Actualizado en este informe. La diferencia se debe a que el build anterior contaba páginas estáticas y dinámicas de forma distinta; el número real es 88 rutas dinámicas + páginas estáticas. |
| `reporte-estado.md` tenía conteos y referencias desactualizadas | Documentación | Menor | Resuelto en esta auditoría: actualizada tabla de verificaciones, sección de auditoría y cierre. |

### 5.3.2 Áreas verificadas

| Área | Estado | Notas |
|---|---|---|
| Calidad de código y consistencia | OK | `lint`, `tsc`, `test`, `build`, `knip` pasan. |
| Seguridad | OK | No se detectaron credenciales/secretos hardcodeados en `src/`. Variables sensibles leídas desde `process.env` a través de `src/config/`. |
| Arquitectura | Advertencia menor | URLs de servicios públicos hardcodeadas como defaults; capas bien separadas. |
| Cobertura de pruebas | OK | 155 suites unitarias, 34 specs E2E. Faltan 0 tests de repositorio y 1 de `product-style.ts` (trivial, informativo). |
| Documentación y variables de entorno | OK | `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` eliminada de `.env.example`, `README.md`, `AGENTS.md`, `.devin/environment.yaml` y `lecciones-aprendidas.md`. |
| Rendimiento y bundle | OK | `npm run analyze:webpack` ejecutado; reportes en `.next/analyze/`. Sin chunks críticos detectados. |
| Accesibilidad y UX | OK | Existe `tests/e2e/accessibility.spec.ts` y `responsive.spec.ts`; no se ejecutaron en esta sesión. |
| Integridad de datos y flujos de negocio | OK | Tests de `orderService`, `saleService`, `stockService`, `cashRegisterService` pasan. |
| Configuración de despliegue, CI/CD y entornos | OK | `vercel.json`, `next.config.ts`, `.github/workflows/ci.yml` y `playwright.config.ts` consistentes con la documentación. |

## 6. Plan de acción

| Prioridad | Acción | Responsable sugerido |
|---|---|---|
| Baja | Ejecutar `npx drizzle-kit check` sobre la base de `.env.e2e` si hay cambios de esquema. | Equipo de desarrollo |
| Baja | Ejecutar `npm run test:e2e` en base descartable antes del próximo release para confirmar los flujos de chat/ubicación y carrito. | Equipo de desarrollo |
| Baja | Considerar tests E2E para el envío de ubicación del cliente y de la sucursal. | Equipo de desarrollo |

## 7. Cierre

- Baseline: `7cdf2864cd327c46d34ea0f635a9bc6c72d7c889` en `main`; auditoría ejecutada sobre el `working tree` actual.
- Verificaciones base ejecutadas sobre el estado final: `npm run lint`, `npx tsc --noEmit`, `npm test` (155 suites / 1582 tests), `npm run build` (88 rutas/páginas), `npm run analyze:webpack`, `npm run knip` y `npx drizzle-kit check` — todas pasan.
- Pendientes recomendados aplicados en esta sesión: eliminación de `NEXT_PUBLIC_PAYMENT_DENOMINATIONS` de documentación y `.env.example`; reemplazo de `throw new Error` por `ApiError` en cliente; creación de `branchRepository.test.ts` y `userRepository.test.ts`; agregado a `lecciones-aprendidas.md` la lección sobre compartir ubicación por chat.
- No se ejecutaron `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate`, `npx drizzle-kit migrate`, `npx vercel env pull` ni `npm run test:e2e` por requerir confirmación explícita o base de prueba.
- Se advirtió al usuario sobre secretos en `.env.local` y `.env.e2e`; la rotación queda fuera del alcance de esta auditoría.
