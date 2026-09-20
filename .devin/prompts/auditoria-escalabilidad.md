# Prompt: Auditoría de escalabilidad — Sistema de pedidos (Panchería)

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos, chat de pedidos (texto, imágenes y ubicación), imágenes de productos/promos y gestión de videos.

Stack: Next.js 16.3.3 (App Router + Turbopack), React 19.2.8, TypeScript 5.x, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon serverless, con pooler y conexión unpooled), NextAuth v5 (`5.0.0-beta.32`), Jest 30.x, Playwright 1.62.x. Deploy en Vercel.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/auditoria-deploy-vercel-2026-09-14.md" /> — recomendaciones pendientes relevantes (verificación de migraciones en CI, `VERCEL_PRODUCTION_URL`).
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/plan-implementacion-multi-tenant.md" /> — marco de negocio para la sección de multi-tenancy (objetivo: 10–50 comercios, superadmin, subdominios).
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-pre-release.md" /> — auditoría integral vigente; **no repetir hallazgos ya documentados**, enfocarse en el ángulo de escalabilidad.

Archivos de código de lectura inicial obligatoria (además de los que surjan durante la auditoría):

- <ref_file file="C:/developer/paginas/pancheria/package.json" /> y <ref_file file="C:/developer/paginas/pancheria/next.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/vercel.json" /> y `.github/workflows/{ci,expire-orders}.yml`
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- Estructura completa de `src/app/api/` (51 `route.ts` al 2026-09-19; verificar conteo actual)
- `src/config/*.ts` — **todas las perillas de escalabilidad son variables de entorno**; sin leer este directorio la auditoría queda ciega.
- <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/proxy.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/transactionService.ts" /> e `idempotencyService.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" />, `rate-limit-store.ts` y `public-order-rate-limit-store.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/lib/logger.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" /> y `tests/e2e/global-setup.ts`

## Estado actual relevante

- **Roles:** `admin` / `operator` (no "sucursal"); cada usuario tiene `branchId` y las consultas filtran por sucursal. El aislamiento depende de ese filtro en cada ruta/servicio.
- **Storage de archivos:** cuatro proveedores — `local`, `vercel-blob`, `s3` y `r2` — seleccionados por `STORAGE_PROVIDER` (videos, adjuntos de chat e imágenes de productos).
- **Actualización en cliente:** solo polling con intervalos configurables (`NEXT_PUBLIC_*_REFRESH_INTERVAL_MS`); no hay WebSockets ni SSE en `src/`.
- **Rate limiting propio:** dos stores independientes — intentos de login (`RATE_LIMIT_STORE_PROVIDER`, tabla `login_attempts`) y pedidos/chat público (`PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER`, tabla `public_order_rate_limits`); ambos soportan `memory` o `db`.
- **Crons (3):** `rate-limit-cleanup` y `chat-attachments-cleanup` en `vercel.json` (diarios, `0 0 * * *`), `expire-orders` vía GitHub Actions cada 5 minutos (`*/5 * * * *`). Todos protegidos por `CRON_SECRET`.
- **Arquitectura en capas:** `src/app` (UI/API), `src/application` (servicios, `transactionService`, `idempotencyService`), `src/domain`, `src/repositories`, `src/lib`, `src/config`, `src/db`, `src/components`, `src/hooks`, `src/types`, más `src/proxy.ts`, `src/auth.ts`, `src/auth.config.ts`.
- **Dependencias sensibles:** `next-auth` en beta, `drizzle-orm` 0.x, overrides de `nanoid` en `package.json`.
- **Flujo de pedidos:** `pending` → `in_process` → `paid` → `finished`/`cancelled`; las reservas de stock (`order_stock_reservations`) se crean al recibir el pedido (`receiveOrder`), no al crearlo — verificar en código qué recursos retiene un pedido `pending` expirado.

## Objetivo

Emitir un informe objetivo sobre la escalabilidad futura del sistema, con evidencia en el código para cada afirmación. La auditoría es **de solo lectura sobre el código**: no se modifican archivos de negocio ni se ejecutan comandos destructivos.

## Qué auditar (cada hallazgo con evidencia: archivo y línea o nombre de función/exportación)

### 1. Base de datos

- Índices: ¿las queries frecuentes (pedidos por estado/sucursal, mensajes por pedido, ventas por caja/fecha, stock por producto) están cubiertas por índices en `src/db/schema.ts`?
- Queries N+1 en `src/repositories/` y rutas API. Paginación real en DB (LIMIT/OFFSET o cursor) vs. traer todo y filtrar en memoria. El chat ya usa cursores (`before`/`after`); verificar el resto.
- Transacciones: ¿las operaciones multi-tabla (crear pedido + reservar stock, cerrar venta + descontar recetas) son atómicas vía `transactionService`? ¿Hay race conditions de stock con pedidos concurrentes (locks, `SELECT FOR UPDATE`, constraint checks)?
- Crecimiento: ¿qué tablas crecen sin límite (`order_messages`, `stock_movements`, `public_order_rate_limits`, `login_attempts`, adjuntos)? ¿Hay retención/archivado además de los crons existentes?
- Neon serverless: impacto del pooler, cold starts, límites de conexiones con múltiples instancias serverless. Marcar como "verificar en producción" lo que dependa de la configuración de Neon no visible en el repo.

### 2. Backend / API

- ¿Las rutas de `src/app/api` escalan horizontalmente? Buscar estado en memoria de proceso (Maps, singletons, caches en módulo) que rompa con más de una instancia — empezando por `src/lib/rate-limit-store.ts`, `public-order-rate-limit-store.ts` en modo `memory` y cualquier caché en `src/lib/`.
- Polling: estimar la carga generada (N clientes × intervalo) en `/api/caja/resumen`, `/api/panel/resumen`, catálogo público y chat, usando los defaults de `src/config/`. Evaluar sostenibilidad a 10/100 operadores concurrentes y según el marco del plan multi-tenant (10–50 comercios). ¿Conviene SSE/WebSocket/Realtime? Estimar el costo de migración (marcar como **estimación**).
- Serverless: duración de funciones, trabajo pesado en requests (imágenes, agregaciones), ausencia de colas/background jobs fuera de los 3 crons.
- Expiración de pedidos por cron de 5 min: verificar en código qué pasa con stock reservado y pedidos en estados intermedios si el cron se atrasa o falla (las reservas se crean en `receiveOrder`; un `pending` expirado no debería retener stock — confirmarlo o reportarlo).

### 3. Frontend

- Tamaño de bundle (`npm run analyze:webpack` genera los HTML en `.next/analyze/`), client components innecesarios, waterfalls de fetching.
- SSR/`force-dynamic`: páginas públicas (`/pedido`, `/pedido/[id]/chat`) son dinámicas — impacto en TTFB y costo bajo tráfico. ¿Se puede cachear el catálogo (ISR, `unstable_cache`, CDN) sin romper stock/precios en vivo?
- Imágenes/videos: optimización, límites de tamaño (`src/config/product-images.ts`, `src/config/videos.ts`), ancho de banda.

### 4. Caching y consistencia

- ¿Existe estrategia de cache (Next.js cache, headers, revalidate)? ¿Invalidación correcta al cambiar productos/stock?
- Polling + cache de CDN: riesgo de datos stale en catálogo y panel.

### 5. Autenticación, seguridad y multi-tenancy

- NextAuth v5 beta: riesgos de la versión, sesiones (JWT vs DB) y escalabilidad.
- Autorización por sucursal: ¿un `operator` de la sucursal A puede leer/modificar datos de la sucursal B vía API? Verificar filtros de `branchId` en cada ruta; patrón documentado: `getCurrentBranchIdOrRedirect` en Server Components vs `getCurrentBranchId` (→403) en rutas API.
- Rate limiting: cobertura real de rutas públicas, bypass, IP spoofing (`TRUSTED_PROXY_IP_HEADER`, `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS`), comportamiento del provider `db` con múltiples instancias.
- CSP (`src/lib/csp-helpers.ts`, `src/proxy.ts`, `next.config.ts`), subida de archivos (MIME, tamaño, magic bytes), fuga de datos en respuestas.

### 6. Storage y archivos

- Adjuntos de chat, imágenes de productos y videos: crecimiento, costos de Blob/S3/R2, limpieza de huérfanos (¿`chat-attachments-cleanup` cubre solo `chat/`? ¿qué pasa con imágenes de productos y videos huérfanos?), URLs firmadas vs públicas (`GET /api/chat/attachment/[key]`, `GET /api/productos/imagen/[key]`).

### 7. Observabilidad y operación

- Logging (`src/lib/logger.ts`): ¿suficiente para diagnosticar en producción? ¿Sin datos sensibles?
- Alertas/métricas: ¿qué pasa si un cron falla, la DB se cae o el rate limiter se dispara? ¿Hay health checks?
- Manejo de errores en API (`src/lib/api-handler.ts`): consistente, sin stack traces al cliente; `NotFoundError` → 404, `DomainError` → 400, `ForbiddenError` → 403.

### 8. Testing, CI/CD y deuda técnica

- Cobertura real: unit (Jest), E2E (Playwright), accesibilidad. ¿Tests de concurrencia/carga? ¿Tests de las transacciones de stock?
- CI: gates de lint/tipos/build/knip en `.github/workflows/ci.yml`, tiempo de pipeline, flakiness E2E.
- Dependencias riesgosas: `next-auth@beta`, `drizzle-orm` 0.x, overrides de `nanoid`, versiones fijadas vs flotantes.
- `npm run knip`: código muerto que oculte problemas.

### 9. Escalabilidad del negocio

- Multi-sucursal: ¿qué tan lejos está de ser multi-tenant real? Cruzar con `plan-implementacion-multi-tenant.md` (datos, auth y rate limits aislados por sucursal; objetivo documentado: 10–50 comercios).
- Picos: ¿qué pasa un viernes a la noche con 200 pedidos simultáneos y 20 operadores en panel? Identificar el primer cuello de botella con evidencia.
- Costos: estimación de Neon + Vercel + Blob/S3 bajo crecimiento ×10 — **estimación**, basada en defaults de configuración y supuestos documentados, no verificable en código.

## Reglas de oro

1. Idioma español en todo: explicaciones, comentarios, documentación e informe.
2. Auditoría de solo lectura: **no modificar archivos de negocio**. Solo se permite crear/editar el archivo de informe en `.devin/informes/` y los índices de `.devin`.
3. Prohibido ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push/generate/migrate`, `npm run test:e2e`, `npx playwright test` ni `npx vercel env pull` sin confirmación explícita del usuario y base de datos de prueba. Para "demostrar" race conditions o N+1, alcanza con evidencia de código; si se propone una prueba destructiva, documentarla como recomendación, no ejecutarla.
4. Nunca hardcodear ni exponer credenciales, URLs de APIs, secretos ni valores de `.env.local`/`.env.e2e` en el informe.
5. Sin hallazgos inventados: cada afirmación con evidencia en el código (`archivo:línea`, `<ref_file .../>` o nombre de función/exportación). Lo que no pueda verificarse se marca explícitamente como "no verificable"; lo que dependa de infraestructura fuera del repo (plan de Vercel/Neon, límites de cuenta) se lista como "verificar en producción".
6. Las estimaciones (costos, orden de quiebre, costo de migración a SSE/WS) se etiquetan como **estimaciones** con supuestos explícitos; no son hallazgos verificables.
7. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo** (convención del proyecto; en la tabla de riesgo se pueden mapear a 🔴/🟡/🟢/⚪).
8. No repetir hallazgos ya documentados en `reporte-estado.md`, `lecciones-aprendidas.md` ni en las auditorías archivadas; referenciarlos en vez de re-derivarlos.

## Metodología

1. **Preparación:** ejecutar `git status`, `git log --oneline -20` y `git rev-parse HEAD` para establecer baseline y fecha del informe.
2. **Lectura base:** toda la documentación obligatoria y los archivos de código listados arriba.
3. **Verificaciones base (solo lectura):** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`; opcional `npm run analyze:webpack` para bundle. Documentar resultados.
4. **Análisis por áreas:** recorrer las 9 secciones con búsquedas dirigidas (`process.env`, `new Map`, `setInterval`, `forUpdate`, `findFirst`, `findMany` sin `limit`, `force-dynamic`, `NEXT_PUBLIC_`).
5. **Síntesis:** clasificar hallazgos, estimar orden de quiebre, plan de acción priorizado.
6. **Cierre:** escribir el informe, actualizar índices, registrar el trabajo en `reporte-estado.md` si corresponde.

## Entregables

1. **Informe** en `.devin/informes/auditoria-escalabilidad-YYYY-MM-DD.md` (archivo fechado, como el resto de auditorías puntuales del proyecto).
2. **Índices actualizados** en el mismo cambio: `.devin/informes/README.md` y el bloque Estructura/Estado de `.devin/README.md` (regla de índices de `.devin/prompts/README.md`).
3. Si el informe deja pendientes accionables, reflejarlos en la tabla §6 de `reporte-estado.md` o documentar por qué no aplica.

## Formato del informe

1. **Veredicto** (1 párrafo): ¿es escalable a futuro? Sí / Sí con condiciones / No — y por qué.
2. **Cuadro de riesgo**: tabla con área, severidad (🔴 crítico / 🟡 mayor / 🟢 menor / ⚪ informativo), probabilidad y esfuerzo de corrección.
3. **Hallazgos detallados**: por cada problema — qué, dónde (`archivo:línea` o `<ref_snippet .../>`), por qué es un problema al escalar, cómo reproducirlo o demostrarlo (evidencia de código; sin ejecutar nada destructivo), fix recomendado.
4. **Orden de quiebre estimado**: qué falla primero a 10×, 50×, 100× de carga — sección de **estimación** con supuestos explícitos.
5. **Plan de acción**: quick wins (<1 día), corto plazo (<1 sprint), estratégicos (>1 sprint), ordenados por impacto/esfuerzo.
6. **Lo que está bien**: decisiones que sí favorecen la escalabilidad (no todo es negativo).

Encabezado del informe: fecha, baseline (`git rev-parse HEAD`), alcance ejecutado y comandos corridos.

## Criterio de aceptación

- El informe cubre las nueve áreas y respeta el formato.
- Todo hallazgo tiene evidencia concreta o está marcado como "no verificable" / "verificar en producción".
- Las estimaciones están etiquetadas con supuestos.
- No se repiten hallazgos ya documentados sin referencia cruzada.
- El informe queda archivado en `.devin/informes/` con índices sincronizados.
- No se modificó código de negocio ni se ejecutaron comandos destructivos.
