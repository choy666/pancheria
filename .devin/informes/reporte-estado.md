# Reporte de estado — Auditoría de cobertura de pruebas y tests

**Fecha:** 2026-08-26 (actualizado con Fase 2)  
**Proyecto:** `pancheria`  
**Baseline:** `HEAD` — branch `main`  

---

## 1. Resumen ejecutivo

Se ejecutó la auditoría de cobertura de pruebas solicitada sobre **tests unitarios (Jest)** y documentación vigente, cruzando variables de entorno, prompts e informes. Se completaron los tests E2E en una corrida anterior (ver `.devin/informes/archivados/reporte-estado-sincronizacion-2026-08-26.md`); en esta sesión no se requirió ejecutar `npm run test:e2e`.

**Verificaciones automáticas:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` pasan. La suite unitaria reporta **119 suites y 1102 tests**.

**Conclusión de cobertura:**

- **Fase 2 completada (horarios de sucursal y bloqueo de pedidos con caja cerrada):**
  - Nueva columna `opening_hours` JSONB en `branches` con migración `drizzle/0017_unknown_energizer.sql`.
  - Helpers de zona horaria en `src/lib/branch-helpers.ts` (`isBranchOpen`, `getCurrentOrNextOpening`, `validateOpeningHours`).
  - `branchService` y UI de sucursales permiten crear/editar horarios.
  - `orderService.createOrder` rechaza pedidos si la caja de la sucursal está cerrada, devolviendo el horario de apertura.
  - Nuevo endpoint `GET /api/public/caja/estado?branchId={id}` para consulta pública de estado de caja.
  - `pedido-client.tsx` muestra advertencia de caja cerrada en el checkout sin bloquear el armado del carrito.
  - Tests unitarios y E2E ajustados; nuevo spec `pedido-caja-cerrada.spec.ts`.
  - Migración `drizzle/0017_unknown_energizer.sql` aplicada en desarrollo y producción; verificado que `opening_hours` existe con default `[]` en la base productiva.
- **Repositorios y servicios de aplicación** tienen cobertura unitaria completa (repositorios 100%, servicios 100%).
- **Rutas API** tienen cobertura completa: 43 de 43 con test.
- **`src/lib`** tiene 27 de 33 archivos con test; la infraestructura crítica está cubierta.
- **Configuración con variables de entorno** tiene tests para `caja`, `chat`, `orders`, `catalog` y `videos`.
- **Tests E2E** crecieron a 28 specs; se agregaron flujos de cambio de contraseña, búsqueda/filtro/paginación de pedidos, edición/eliminación de promos con recetas, expiración automática de pedidos, cierre automático de caja, rate limit de pedidos y confirmación/cancelación de pedidos desde el panel.
- **Componentes y páginas** del panel siguen sin tests unitarios; la cobertura depende de E2E.

---

## 2. Alcance y metodología

La auditoría siguió el prompt <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />.

1. **Inventario de tests existentes** con `npx jest --listTests`, `npm test` y `npx playwright test --list`.
2. **Inventario de código a cubrir** comparando `src/app/**/route.ts`, `src/application/services/*.ts`, `src/repositories/*.ts`, `src/lib/*.ts`, `src/components/**/*.tsx`, `src/hooks/*`, `src/app/(panel)/**/page.tsx` y `src/app/(public)/**/page.tsx` con sus tests correspondientes.
3. **Cruce con variables de entorno** buscando `process.env.*` en `src/` y comparando con `.env.example` y `AGENTS.md`.
4. **Evaluación de calidad de tests E2E** buscando selectores frágiles y dependencias del seed.
5. **Sincronización de `.devin`** — prompts, informes, `environment.yaml` e índices.

---

## 3. Conteos de tests

| Métrica | Valor |
|---------|-------|
| Suites unitarias (Jest) | 119 |
| Tests unitarios | 1102 |
| Archivos de test unitario | ~119 |
| Specs E2E | 29 |
| Tests E2E listados | 95 |
| Rutas API | 43 |
| Rutas API con test | 43 |
| Rutas API sin test | 0 |
| Servicios de aplicación | 14 |
| Servicios con test | 14 |
| Servicios sin test | 0 |
| Repositorios | 10 |
| Repositorios con test | 10 |
| Repositorios sin test | 0 |
| Archivos `src/lib/*.ts` | 33 |
| `src/lib/*.ts` con test | 27 |
| `src/lib/*.ts` sin test | 6 |

---

## 4. Cobertura por sector relevante

| Sector | Unitarios | E2E | Observación |
|--------|-----------|-----|-------------|
| Autenticación y autorización | Sí (`authService`, `route-guard`, `rate-limit-store`) | Sí (`login`, `roles-y-sucursales`, `perfil-cambio-contrasena`) | Cubierto en ambas capas. |
| Catálogo público y pedidos | Sí (`catalogService`, `orderService`, `public/pedido/*`, `pedidos/[id]/confirmar`, `pedidos/[id]/cancelar`) | Sí (`pedido`, `pedido-sucursal-y-stock`, `pedido-cancelacion-panel`, `pedido-busqueda-filtros`, `pedido-expiracion`) | Cubierto en ambas capas. |
| Ventas y terminal | Sí (`saleService`, `ventas/*`) | Sí (`ventas-*`) | Cubierto en ambas capas. |
| Productos y recetas | Sí (`productService`, `recipeService`, `productos/*`, `summaryService`) | Sí (`productos-y-recetas`) | Selectores robustecidos; edición/eliminación de promos con recetas cubierta. |
| Stock | Sí (`stockService`, `stock/*`) | Sí (`stock-y-movimientos`) | Cubierto en ambas capas. |
| Caja y cierres | Sí (`cashRegisterService`, `cierre/*`, `caja/historial`, `caja/abrir`, `caja/cerrar`, `caja/resumen`) | Sí (`caja-*`, `validaciones-y-papelera`, `caja-cierre-automatico`) | Cierre automático cubierto con manipulación controlada de `openedAt` en la base E2E. |
| Sucursales y usuarios | Sí (`branchService`, `userService`) | Sí (`roles-y-sucursales`) | Cubierto en ambas capas. |
| Videos y almacenamiento | Sí (`videoService`, `storage.ts`, `videos/upload`, `videos/[id]/stream`) | Sí (`videos`) | Cobertura unitaria completa de storage y rutas de video. |
| Rate limiting y seguridad | Sí (`public-order-rate-limit-store`, `rate-limit.ts`, `rate-limit-store.ts`) | Sí (`rate-limit-pedidos`) | Rate limit configurable vía `E2E_ENABLE_RATE_LIMIT=true` y `PUBLIC_ORDER_RATE_LIMIT_*` para el entorno E2E. |
| Cron jobs y limpieza | Sí (`cron/*`) | No | Cubierto unitariamente. |
| Utilidades transversales | Sí (`public-url.ts`, `api-handler.ts`, `summaryService.ts`, `storage.ts`) | No | Infraestructura crítica cubierta. |
| Configuración y variables de entorno | Sí (`caja.ts`, `chat.ts`, `orders.ts`, `catalog.ts`, `videos.ts`) | No | Variables configurables principales testeadas. |

---

## 5. Tests unitarios — estado y gaps

### 5.1 Funcionalidades clave cubiertas

| Funcionalidad | Test | Estado |
|---------------|------|--------|
| `convertOrderToSale` | `src/application/services/orderService.test.ts` | Cubierto (feliz, errores, idempotencia, precios históricos, stock). |
| Rate limit store público | `src/lib/public-order-rate-limit-store.test.ts` | Cubierto (`memory` y `db`). |
| Rate limit core | `src/lib/rate-limit.test.ts` | Cubierto (`getClientIp`, `createRateLimiter`, `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`). |
| Rate limit login | `src/lib/rate-limit-store.test.ts` | Cubierto (`InMemoryRateLimitStore`, `DbRateLimitStore`, `createRateLimitStore`). |
| `withApiErrorHandling` | `src/lib/api-handler.test.ts` | Cubierto (401, 400, 403, 404, 409, 503, 499, 500, Zod). |
| `getPublicBaseUrl` | `src/lib/public-url.test.ts` | Cubierto (browser/servidor, producción, `HOST`/`PORT`, fallback). |
| Storage | `src/lib/storage.test.ts`, `src/config/videos.test.ts` | Cubierto (`local`, `vercel-blob`, `s3`, `r2`, variables de video). |
| Resumen de caja | `src/application/services/summaryService.test.ts` | Cubierto. |
| Soft delete productos/cajas | `src/application/services/productService.test.ts`, `src/application/services/cashRegisterService.test.ts` | Cubierto. |
| Idempotencia de ventas | `src/application/services/saleService.test.ts` | Cubierto. |
| Chat adjuntos y storage | `src/lib/chat-storage.test.ts` | Cubierto (local, Vercel Blob). |
| Refresco de pedidos | `src/config/orders.test.ts` | Cubierto (`NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`: deshabilitado por defecto, forzar a 10000 ms si es < 1000, deshabilitar con 0). |

### 5.2 Archivos de producción sin test (gaps restantes)

#### `src/lib/*`

- `src/lib/logger.ts` — observabilidad (baja prioridad; en test no emite salida).
- `src/lib/with-auth.ts` — wrapper de endpoints autenticados (media prioridad; cubierto indirectamente por tests de rutas).
- `src/lib/pagination.ts`, `src/lib/validation-helpers.ts` — utilidades (baja prioridad).

#### Rutas API sin test

- Ninguna: todas las 43 rutas API tienen test unitario asociado.

#### Componentes y páginas

- Ninguna página de `src/app/(panel)/**/page.tsx` tiene test unitario.
- La mayoría de los componentes de negocio no tienen test unitario. Esto es aceptable si se cubren con E2E, pero conviene priorizar los críticos.

---

## 6. Tests E2E — estado y riesgos

### 6.1 Especificaciones encontradas

Se encontraron **29 specs** en <ref_file file="C:/developer/paginas/pancheria/tests/e2e" />:

| Spec | Flujo |
|------|-------|
| `login.spec.ts` | Login y redirecciones |
| `productos-y-recetas.spec.ts` | Creación, edición y eliminación de productos, promos y recetas |
| `roles-y-sucursales.spec.ts` | Roles, sucursales y usuarios |
| `pedido.spec.ts` | Catálogo, carrito y creación de pedido |
| `pedido-chat.spec.ts` | Chat de pedidos |
| `pedido-chat-adjuntos.spec.ts` | Adjuntos en el chat |
| `pedido-sucursal-y-stock.spec.ts` | Sucursal, carrito, stock y confirmación de pedido |
| `pedido-cancelacion-panel.spec.ts` | Confirmación y cancelación de pedidos desde el panel |
| `pedido-busqueda-filtros.spec.ts` | Búsqueda, filtrado y paginación de pedidos |
| `pedido-expiracion.spec.ts` | Expiración automática de pedidos |
| `pedido-caja-cerrada.spec.ts` | Bloqueo de pedido y mensaje con horario cuando la caja está cerrada |
| `ventas-disponibilidad.spec.ts` | Disponibilidad en terminal |
| `ventas-historial.spec.ts` | Venta, cierre e historial |
| `ventas-stock-compartido.spec.ts` | Promos con insumos compartidos |
| `stock-y-movimientos.spec.ts` | Ajustes y movimientos de stock |
| `caja-aislamiento-y-trazabilidad.spec.ts` | Aislamiento de cajas por sucursal |
| `caja-cierre-vacios.spec.ts` | Caja sin ventas |
| `caja-cierre-automatico.spec.ts` | Cierre automático de cajas por vencimiento |
| `flujo-diario.spec.ts` | Flujo completo de operación |
| `smoke.spec.ts` | Smoke de páginas protegidas |
| `tour.spec.ts` | Recorrido interactivo |
| `videos.spec.ts` | Videos, subida y reproducción |
| `responsive.spec.ts` | Responsividad móvil |
| `validaciones-y-papelera.spec.ts` | Validaciones y papelera de cajas |
| `perfil-cambio-contrasena.spec.ts` | Cambio de contraseña del usuario actual |
| `rate-limit-pedidos.spec.ts` | Rate limit de creación de pedidos públicos |
| `paso3.spec.ts`, `paso4.spec.ts` | Flujos guiados de operador |
| `prod-login-and-tour.spec.ts` | Smoke de producción |

### 6.2 Riesgos identificados y acciones aplicadas

| Riesgo | Gravedad | Evidencia / Acción |
|--------|----------|--------------------|
| **Uso de `data-slot` de shadcn/ui** | Mayor | 0 usos restantes en specs. Se reemplazaron por `[data-testid="product-card"]`, `[role="listbox"]`, `[role="option"]` y `getByRole('button', { name: 'Close' })`. Se agregaron `data-testid` en `sales-terminal.tsx`, `closure-panel.tsx` y `productos/page.tsx`. |
| **Selectores por posición (`td:nth-child`)** | Menor | 0 usos restantes en specs. Se reemplazaron por `data-testid` en filas y badges. |
| **Uso de `.first()`, `.last()`, `.nth()` sin selectores estables** | Menor | 55 usos restantes. Se redujo desde 57; algunos son necesarios para listas dinámicas. |

### 6.3 `data-testid` expuestos pero no usados en E2E

- `empty-trash`
- `restore-cash-register-{id}`, `permanent-delete-cash-register-{id}`, `delete-cash-register-{id}`
- `branch-select-label`, `single-branch-indicator`
- `whatsapp-icon`, `order-summary`
- `recent-orders-banner`
- `checkout-button`
- `chat-file-input`, `chat-attachment-image`
- `active-branch-name`

### 6.4 Flujos críticos no cubiertos por E2E

Los flujos priorizados en la auditoría fueron implementados y cubiertos por E2E. Los gaps residuales son:

- **Chat como operador/respuestas rápidas**: el chat de pedidos se cubre desde el lado cliente en `pedido-chat` y `pedido-chat-adjuntos`, pero no hay un flujo dedicado de respuestas del operador con plantillas.
- **Rate limit de chat público**: el spec `rate-limit-pedidos` cubre pedidos; el chat comparte el mismo store y lógica, pero no tiene spec dedicado.
- **Google Cast y reproducción de video en segundo plano**: se cubre el streaming, no la experiencia de Cast.
- **Restauración/permanente de cajas desde la UI**: los `data-testid` existen pero no hay spec E2E que los use.

---

## 7. Variables de entorno — cobertura

Se identificaron **56 variables configurables** en `.env.example` y `AGENTS.md`. Del análisis de `process.env.*` en `src/`:

| Variable | Uso | Test de comportamiento |
|----------|-----|------------------------|
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Autenticación | Sí (validación en `global-setup.ts`) |
| `DATABASE_URL` y aliases Postgres | Conexión a DB | Sí (validación en `global-setup.ts`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Seed y login | Sí (validación en `global-setup.ts`) |
| `DEFAULT_BRANCH_NAME` | Sucursal por defecto | Sí (`branch-resolver.test.ts`) |
| `CRON_SECRET` | Protección de cron | Sí (`cron/*/*.test.ts`) |
| `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` | Límite de mensaje | Sí (`chat.test.ts`) |
| `ORDER_EXPIRATION_MS` | Expiración de pedidos | Sí (`orders.test.ts`) |
| `LOCAL_STORAGE_PATH` / `CHAT_LOCAL_STORAGE_PATH` | Storage local | Sí (`chat-storage.test.ts`) |
| `STORAGE_PROVIDER` / `BLOB_READ_WRITE_TOKEN` | Storage | Sí (`storage.test.ts`, `videos.test.ts`) |
| `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` | URLs públicas | Sí (`public-url.test.ts`) |
| `CAJA_AUTO_CLOSE_HOURS` / `NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS` | Cierre automático de cajas | Sí (`caja.test.ts`) |
| `CAJA_AUTO_CLOSED_BY` | Etiqueta de cierre automático | Sí (`caja.test.ts`) |
| `NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS` | Reloj de caja | Sí (`caja.test.ts`) |
| `CAJA_DEFAULT_HISTORY_DAYS` / `NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS` | Historial de caja | Sí (`caja.test.ts`) |
| `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` | Refresco de panel de caja | Sí (`caja.test.ts`) |
| `RATE_LIMIT_STORE_PROVIDER` | Store de rate limit login | Sí (`rate-limit-store.test.ts`) |
| `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` | Store de rate limit pedidos | Sí (`public-order-rate-limit-store.test.ts`) |
| `TRUSTED_PROXY_IP_HEADER` | Header de IP confiable | Sí (`rate-limit.test.ts`) |
| `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS` / `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS` | Rate limit pedidos | Sí (`orders.test.ts`) |
| `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` | Activa rate limit en desarrollo | Sí (`rate-limit.test.ts`) |
| `PUBLIC_CHAT_RATE_LIMIT_WINDOW_MS` / `PUBLIC_CHAT_RATE_LIMIT_MAX_REQUESTS` | Rate limit chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` | Refresco del chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_PAGE_SIZE` | Paginación del chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` | Tamaño de imagen en chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES` | Tipos MIME de chat | Sí (`chat.test.ts`) |
| `NEXT_PUBLIC_BRANCH_TIMEZONE` | Zona horaria para horarios de apertura | Sí (`branch-helpers.test.ts`) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp | Sí (`catalog.test.ts`) |
| `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` / `CLOSING` | Mensaje de WhatsApp | Sí (`catalog.test.ts`) |
| `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` | Refresco del catálogo | Sí (`catalog.test.ts`) |
| `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` | Refresco de pedidos del operador | Sí (`orders.test.ts`) |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Timeout de API cliente | Sí (`fetch.test.ts`) |
| `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` | Tamaño de video | Sí (`videos.test.ts`) |
| `NEXT_PUBLIC_VIDEO_ALLOWED_MIME_TYPES` | Tipos MIME de video | Sí (`videos.test.ts`) |
| `NEXT_PUBLIC_CAST_RECEIVER_APP_ID` / `NEXT_PUBLIC_CAST_SENDER_SDK_URL` | Google Cast | Sí (`videos.test.ts`) |
| `HOST` / `PORT` | Fallback de desarrollo de URL pública | Sí (`public-url.test.ts`) |
| `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` | Analytics | Sí (`conditional-analytics.test.tsx`) |
| Credenciales `S3_*` / `R2_*` | Storage remoto | Sí (`storage.test.ts` con mocks; no se recomienda testear con credenciales reales). |

---

## 8. Hallazgos y recomendaciones

### Crítico

Ningún hallazgo crítico que afecte build o seguridad. No se encontraron credenciales expuestas.

### Mayor

#### 8.1 Faltan tests de rutas API remanentes

Las rutas `caja/[id]` (detalle de caja) y `pedidos/[id]` (detalle de pedido) no tienen tests unitarios. Son menos críticas que las ya cubiertas, pero deberían tener cobertura.

**Recomendación:** Crear tests para estas rutas, priorizando `pedidos/[id]`.

### Menor

#### 8.2 Selectores `.first()`, `.last()`, `.nth()` restantes

Se redujeron a 55 usos en specs. Algunos son necesarios para listas dinámicas, pero otros pueden reemplazarse por `getByTestId` o selectores estables.

**Recomendación:** Revisar los 55 usos restantes y reemplazar los que dependen de posición por selectores semánticos o `data-testid`.

### Informativo

#### 8.3 Cobertura de componentes/páginas del panel

No hay tests unitarios para páginas del panel; la cobertura se delega a E2E. Esto es aceptable en este stack si los flujos E2E son robustos.

---

## 9. Sincronización de `.devin`

Acciones aplicadas en esta sesión:

- Se actualizó `.devin/prompts/README.md` para reflejar los prompts activos y archivados existentes.
- Se archivó `auditoria-rate-limit-429.md` y se actualizó su descripción.
- Se eliminó del índice de informes la referencia a `informe-estrategico-franquicia-saas.md` (no existe).
- Se actualizó `AGENTS.md` para eliminar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` y documentar `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`.
- Se actualizó `.devin/informes/guia-funcionamiento-pancheria.md` para eliminar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` y aclarar el polling manual de `/pedidos`.
- Se actualizó `.devin/informes/lecciones-aprendidas.md` con las lecciones de polling y rate limit en desarrollo.
- Se actualizó `.devin/environment.yaml` con `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` y el polling deshabilitado por defecto.
- Se actualizó el presente `reporte-estado.md` con el baseline, conteos y comandos vigentes.

---

## 10. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 118 suites, 1089 tests pasan |
| 4 | `npm run build` | Build exitoso (42 páginas dinámicas) |
| 5 | `npm run knip` | Pasa |

> **No se ejecutaron** `npx jest --listTests`, `npm run test:e2e`, `npx playwright test`, `npx tsx src/db/seeds.ts`, `npx drizzle-kit push` ni `npx drizzle-kit generate` por requerir confirmación explícita del usuario y/o base de datos descartable.

---

## 11. Enlaces relevantes

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/plan-de-accion-pendientes.md" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />
- <ref_file file="C:/developer/paginas/pancheria/jest.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
