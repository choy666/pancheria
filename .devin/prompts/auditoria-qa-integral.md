# Prompt: Auditoría QA integral con ejecución de tests — Proyecto Panchería

## Rol

Actuá como ingeniero senior de QA y arquitecto de pruebas. Tu tarea NO es escribir tests de inmediato: primero debés elaborar tu propio plan de auditoría (Etapa 1), esperar mi aprobación, y recién después ejecutarlo (Etapa 2) y reportar (Etapa 3).

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos con carrito, chat de pedidos (texto, imágenes y ubicación), imágenes ilustrativas de productos/promos y gestión de videos con reproducción y Google Cast.

Stack: Next.js 16.3.3 (App Router + Turbopack), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon / `pg`), NextAuth v5, Jest 30, Playwright 1.62, axe-core, despliegue en Vercel.

Arquitectura por capas: `src/app/` (rutas `(auth)`, `(panel)`, `(public)`, `api/`), `src/application/` (casos de uso e `idempotencyService`), `src/repositories/`, `src/db/` (schema Drizzle + seed), `src/domain/` (tipos/errores), `src/components/`, `src/lib/` (helpers), `src/config/` (getters de `process.env`).

Reglas de negocio clave para la auditoría:

- Estados de pedido: `pending → in_process → paid → finished`, o `cancelled`. Tipo de entrega: `delivery` / `pickup`.
- Reserva de stock al crear el pedido (`order_stock_reservations`), descuento definitivo al pagar, reintegro al cancelar. Expiración de `pending` por `ORDER_EXPIRATION_MS` + cron `/api/cron/expire-orders` cada 5 min (disparado por `.github/workflows/expire-orders.yml`, protegido con `CRON_SECRET`).
- Aislamiento multi-sucursal por `branchId`; roles `admin` / `operator`; selector de sucursal activa.
- Ventas con pago simple o mixto (`sale_payments`), moneda en pesos argentinos vía `dinero.js` y `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`.
- Productos `simple` / `compound` (promos con recetas e insumos `critical_supply`/`manual_supply`), snapshots en `sale_item_recipes` y `order_item_recipes`.
- Caja por turnos (`openingHours`, turnos overnight soportados), cierre automático (`CAJA_AUTO_CLOSE_HOURS`), papelera de cajas (`TRASH_RESTORE_BATCH_SIZE`), cierres diarios.
- Timezone de sucursal: `NEXT_PUBLIC_BRANCH_TIMEZONE` (default `America/Argentina/Buenos_Aires`).

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/.env.e2e.example" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/archivados/auditoria-escalabilidad-2026-09-19.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-cobertura-de-pruebas.md" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/jest.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/global-setup.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/.github/workflows/ci.yml" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

## Estado actual relevante

- Ya existen ~35 specs E2E en `tests/e2e/` que cubren: pedidos (creación, reserva, expiración, cancelación, chat con adjuntos, sucursal cerrada, filtros), concurrencia de stock, rate limit de pedidos, caja (aislamiento, cierre automático, papelera), cierres diarios, ventas (disponibilidad, historial, pago mixto, stock compartido), productos/recetas, sucursales, roles, videos, login, responsive y accesibilidad con axe-core.
- Los tests unitarios (`*.test.ts`) conviven junto a repositorios, servicios y helpers (`src/lib/`).
- `playwright.config.ts`: `workers: 1`, `fullyParallel: false`, solo proyecto `chromium`, timeout 60 s, `webServer` = `npm run dev:e2e` con health check en `/api/caja/resumen`.
- La auditoría de escalabilidad 2026-09-19 ya documentó riesgos futuros (polling, caché, multi-tenant, observabilidad): **no duplicarla**; referenciarla y agregar solo lo nuevo.

## Reglas innegociables

1. **NUNCA** ejecutar E2E ni scripts que limpien tablas contra producción o cualquier base que no sea la descartable de `.env.e2e`. `tests/e2e/global-setup.ts` trunca todas las tablas con `RESTART IDENTITY CASCADE` y re-ejecuta el seed. Antes de correr nada, verificar que `DATABASE_URL` de `.env.e2e` sea local o que el nombre de la base termine en `test`, `e2e`, `testing`, `qa` o `staging`. No usar `E2E_ALLOW_REMOTE_DB` salvo autorización explícita.
2. `.env.e2e` debe incluir `DATA_CACHE_REVALIDATE_S=0`: los helpers mutan `branches`/`cash_registers` directo en la base y el caché de servidor serviría datos viejos.
3. No modificar código de producción en esta fase salvo autorización expresa. Solo lectura, creación de tests/informes y, si falta un selector, agregar `data-testid` (avisándome antes).
4. No inventar hallazgos: cada uno debe tener pasos de reproducción y evidencia (captura, log, salida de test o cita de código).
5. Indicar explícitamente qué NO pudiste probar y por qué.
6. Todo en español. Severidades según convención del proyecto: **crítico**, **mayor**, **menor**, **informativo**.
7. No exponer `.env.local`, `.env.e2e`, secretos ni URLs de base de datos en tests, capturas ni informes. Nada hardcodeado: credenciales y parámetros siempre desde variables de entorno.
8. Reusar los helpers de `tests/e2e/helpers.ts` (`loginAsAdmin`, `loginAsOperator`, `getTestSecondBranch`, `ensureCashRegisterOpen/Closed`, `createProductViaApi`, `createPromoWithRecipeViaApi`, `expireOrderById`, `setBranchOpeningHours`, `setCashRegisterOpenedAt`, `setUniqueClientIp`, `listAllProductsViaApi`, `unique`, `clearSession`) en lugar de duplicar lógica. Si un patrón nuevo se repite, agregarlo como helper ahí.
9. Antes de escribir tests, releer `lecciones-aprendidas.md` (locators con `.first()` ante múltiples coincidencias, `data-testid` sobre `data-slot`/nth-child, fake timers para casos con `new Date()`, IP única por test para rate limit).
10. Preferir `<ref_file .../>` o nombres de función/exportación sobre `<ref_snippet ... lines="..."/>` en el informe.

## Objetivo

Encontrar problemas actuales y riesgos futuros en cuatro capas, sin duplicar la cobertura ya existente:

### Capa 1 — Flujos críticos de negocio

- Pedido completo: `/pedido` (catálogo, carrito, checkout) → `/pedido/[id]/chat` → panel `/pedidos` (`pending → in_process → paid → finished`), seguimiento público `/pedido/seguimiento`.
- Ventas: terminal `/ventas`, pago mixto (`sale_payments`), anulación (`sale_status = cancelled`), precios históricos.
- Caja: `/caja` (apertura/cierre/resumen), `/cierre` (cierre diario), historial y papelera de cajas, avisos por turno (`fuera_de_horario`, `cierre_recomendado`).
- Stock: `/stock` (ajustes, movimientos, restock), reservas de pedidos, insumos compartidos entre promos.

### Capa 2 — Escenarios de borde y concurrencia

- Stock simultáneo: dos clientes comprando el último insumo; dos operadores vendiendo la misma promo (verificar qué cubre `concurrencia-stock.spec.ts` y `ventas-stock-compartido.spec.ts` antes de agregar).
- Doble envío: submit duplicado de checkout/venta/mensaje de chat (`idempotencyService`), doble clic en confirmar pago.
- Carrera expiración vs. pago: pedido que expira por cron mientras el operador lo marca como pagado.
- Transiciones de estado inválidas: `paid → pending`, `finished → cancelled`, `cancelled → *`, operar sobre pedidos de otra sucursal.
- Pedido vencido no pagable: un `pending` expirado no debe poder confirmarse/pagarse aunque el cron `expire-orders` todavía no haya corrido. La expiración lazy al leer ya está verificada en código: `expireStalePendingOrders` en `orderService.ts` actúa como respaldo del cron en lecturas (ver también `describe('expiración lazy en lecturas')` en `orderService.test.ts`); para forzar un pedido vencido usar `expireOrderById`.
- Corte de red durante el checkout con reintento (simular con `context.setOffline()` / `page.route()` que aborta; verificar que el reintento no duplique pedido ni reservas — ver `idempotencyService`).
- Abuso de reservas: muchos pedidos `pending` que inmovilizan stock sin pagar (varias IPs/teléfonos con `setUniqueClientIp` y `PUBLIC_ORDER_RATE_LIMIT_*`); medir si el rate limit y la expiración alcanzan como mitigación.
- Zonas horarias y turnos: `NEXT_PUBLIC_BRANCH_TIMEZONE`, turnos overnight (`close < open`), cierre automático (`setCashRegisterOpenedAt`), pedidos cerca de medianoche.
- Redondeos y dinero: centavos con `dinero.js`, denominaciones configuradas, pagos mixtos que no suman el total, vuelto negativo.
- Datos extremos: nombres con caracteres especiales/emoji, mensajes de chat en `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, cantidades y precios límite, catálogo con más de `NEXT_PUBLIC_CATALOG_PAGE_SIZE` ítems, adjuntos grandes o de tipo inválido.

### Capa 3 — Seguridad y aislamiento

- IDOR entre sucursales: acceder/modificar pedidos, ventas, cajas, productos y chats de otra `branchId` (usar `getTestSecondBranch`).
- Escalada de rol: `operator` intentando acciones de `admin` (sucursales, usuarios, eliminaciones); rutas del panel sin sesión.
- Endpoints públicos: `POST /api/public/pedido`, `/api/public/catalogo`, `/api/public/disponibilidad`, `/api/public/sucursal/*`, chat público `/api/pedidos/[id]/chat` — validación Zod, rate limit (`public_order_rate_limits`, `login_attempts`, `CHAT_BRANCH_LOCATION_RATE_LIMIT_*`), spoofing de `X-Forwarded-For` vs `TRUSTED_PROXY_IP_HEADER`.
- Payloads manipulados por el cliente en `POST /api/public/pedido`: precios, cantidades, totales o `productId`/`branchId` alterados — el servidor debe recomputar precios y disponibilidad desde la base, nunca confiar en el payload; incluir productos `isActive = false` o de otra sucursal en el carrito.
- Subida de archivos: adjuntos de chat e imágenes de productos — MIME, magic bytes, tamaño, path traversal en `STORAGE_PROVIDER=local`.
- `CRON_SECRET` en `/api/cron/expire-orders`, `/api/cron/rate-limit-cleanup`, `/api/cron/chat-attachments-cleanup`.
- Headers de seguridad y CSP en `next.config.ts` y `src/proxy.ts` (incluidos `frame-src` de mapas). Verificar contra el **build de producción**: en dev el CSP incluye `unsafe-eval` en `script-src` y en producción no (`src/lib/csp-helpers.ts`), así que un bug de CSP solo se ve en prod.

### Capa 4 — Experiencia visual y accesibilidad por perfil

| Perfil | Rutas prioritarias | Qué observar |
| ------ | ------------------ | ------------ |
| Cliente en celular gama baja + red lenta | `/pedido`, `/pedido/seguimiento`, `/pedido/[id]/chat` | 360/390 px, throttling de CPU/red de Playwright, estados de carga, layout shift, teclado virtual |
| Cajero apurado en tablet | `/ventas`, `/caja`, `/pedidos` | 768 px, objetivos táctiles, diálogos de confirmación, densidad de información |
| Persona mayor / baja visión | flujo completo `/pedido` | zoom 200 %, contraste, tamaños de fuente, mensajes de error legibles |
| Usuario de teclado / lector de pantalla | login, `/pedido`, `/ventas` | navegación solo con Tab/Enter/Escape, foco visible, orden lógico, roles y labels (axe-core como piso, no como techo) |
| Persona con daltonismo | badges de estado en `/pedidos`, `/stock`, `/caja` | información que dependa solo del color (estados, alertas de stock, avisos de turno) |

Criterios de esta capa:

- **Piso WCAG 2.2 AA** en los tests nuevos. Las tags de axe **no son acumulativas**: `wcag22aa` sola ejecuta 1 regla (`target-size`) — la lista correcta es `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` (70 reglas con axe-core 4.13). Verificar que la versión instalada soporte la tag antes de usarla. Dato para el informe: el spec existente usa solo `wcag21aa` (3 reglas), así que hoy no está midiendo contraste, labels ni roles — documentarlo como brecha, no degradarlo.
- **Medir contra build de producción**, no contra `next dev` (que infla tiempos por compilación bajo demanda). Dos trampas: (a) `npm run start` solo carga `.env.local`, **no** `.env.e2e`; (b) las `NEXT_PUBLIC_*` se fijan en `next build`, no en `start` — el build e2e debe correr **con el entorno e2e cargado** (script gemelo de `scripts/dev-e2e.ts` con argv `build`+`start`, o equivalente) o `NEXT_PUBLIC_BRANCH_TIMEZONE`, `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`, `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH`, etc. quedarán con valores de `.env.local`. El `.next` resultante queda "contaminado" con esos valores: al terminar la medición, reconstruir con `npm run build` normal (o aislar el `distDir`) antes de seguir. Verificar que el servidor use la base descartable y correr Playwright con `NO_WEB_SERVER=1`.
- **WebKit**: `playwright.config.ts` solo tiene el proyecto `chromium`. Probar `/pedido` en WebKit si el browser está instalado (`npx playwright install webkit` + proyecto ad-hoc o config temporal); si no es posible, reportarlo como "no probado" con el motivo.
- Separar en el informe **defecto objetivo** (violación medible: contraste insuficiente, foco perdido, error de axe) de **observación subjetiva** (densidad, claridad percibida), marcando cada ítem.

## Etapa 1 — Plan de auditoría (entregable, sin ejecutar)

a) **Reconocimiento** (solo lectura):
   - `git rev-parse HEAD` y `git status` como baseline.
   - Mapear rutas API (`src/app/api/**/route.ts`), páginas (`(public)`, `(panel)`, `(auth)`), servicios (`src/application/services/`), helpers (`src/lib/`) y schema.
   - Inventariar specs existentes leyéndolos (no solo por nombre): qué escenario cubre cada uno y con qué profundidad. Ídem `*.test.ts` unitarios.
   - Detectar qué de la lista de riesgos ya está cubierto, parcialmente cubierto o ausente.

b) **Escribir el plan propio** en `.devin/informes/plan-auditoria-qa-YYYY-MM-DD.md` con:
   - Matriz de riesgos (impacto × probabilidad) priorizada.
   - Lista de escenarios por capa marcando `[cubierto: archivo.spec.ts → test('...')]` / `[parcial: qué falta]` / `[brecha nueva]` — el `[cubierto]` debe citar el `test()` concreto dentro del spec, no solo el nombre del archivo. Incluir escenarios no mencionados en este prompt que el reconocimiento revele.
   - Herramienta por escenario: Jest (unitario/integración), Playwright UI, `page.request` (concurrencia vía `Promise.all`, fuzzing de API, headers), `AxeBuilder`, capturas por viewport, throttling de red/CPU, `npx lighthouse` (opcional — no es dependencia del proyecto).
   - Criterio de "listo" por escenario y estimación de archivos nuevos (`tests/e2e/{area}-{caso}.spec.ts`).

c) **Listar supuestos, dudas y qué necesitás de mí. Esperar mi aprobación antes de continuar.**

## Etapa 2 — Ejecución (solo tras aprobación)

### 2.0 — Verificación previa del entorno y guard de base

- `.env.e2e` existe, `DATA_CACHE_REVALIDATE_S=0`, `AUTH_SECRET`/`NEXTAUTH_SECRET` ≥ 32 bytes, `ADMIN_USERNAME`/`ADMIN_PASSWORD` consistentes con el seed.
- Leer `tests/e2e/global-setup.ts` y describir en el plan qué valida su guard (patrón de nombre de base, host local, `E2E_ALLOW_REMOTE_DB`) antes de correr cualquier E2E.
- Comparar host y nombre de la `DATABASE_URL` de `.env.e2e` contra la de `.env.local` **sin imprimir ninguno de los dos valores**: reportar solo si coinciden o difieren y si el nombre cumple el patrón descartable.

### 2.1 — Baseline de la suite existente

Antes de escribir nada, correr la suite completa contra la base descartable (`npm test` y `npm run test:e2e`) y registrar fallos e intermitencias preexistentes (config: `retries: 1` local / `2` CI, `workers: 1`). Estos fallos se documentan como "baseline" en el informe para no atribuirlos a los tests nuevos ni a cambios del período de auditoría.

### 2.2 — Ejecución por capas con checkpoint

- Implementar y correr los tests aprobados **capa por capa** (1 → 4), reportando un checkpoint al terminar cada una antes de seguir.
- **Si aparece un hallazgo crítico, detenerse y avisar de inmediato.** La marca `test.fail()` recién se aplica después de que yo decida qué hacer con el hallazgo — no usarla para enmascararlo y seguir corriendo.
- Un test que expone un bug real se marca con `test.fail(true, 'hallazgo QA-YYYY-MM-DD-NN: descripción corta')` referenciando el hallazgo del informe, para que el spec quede verde-esperado y no rompa `ci.yml` (el job E2E corre toda la suite). Si el bug se corrige, el "unexpected pass" obliga a quitar la marca. Cuidado: los retries pueden ocultar el resultado de un `test.fail()` intermitente; al medir estabilidad usar `--retries=0`. **No corregir el código sin mi autorización.**
- Regresión: correr también los specs existentes del área tocada; documentar salidas.

### 2.3 — Concurrencia por invariantes, no por ganador

- No asertar qué request "gana" (resultado no determinista); asertar invariantes del dominio tras la carrera. Verificar contra la semántica real del código, como mínimo:
  - `products.stock >= 0` (los caminos de escritura rechazan negativo; la *disponibilidad calculada* sí puede serlo).
  - Reservas coherentes: las filas de `order_stock_reservations` corresponden a pedidos `pending`/`in_process` de la misma `branchId` y la disponibilidad resultante (`stock − reservado`) nunca permite confirmar más de lo disponible.
  - `sales.total` = Σ `sale_payments` por venta; reintegro de stock exactamente una vez por cancelación.
- Crear un helper en `tests/e2e/helpers.ts` que verifique las invariantes por SQL (vía `db` de `src/db`) y llamarlo al final de cada test de concurrencia.
- Correr cada test de concurrencia con `--repeat-each=5 --retries=0` y reportar la tasa de éxito por repetición. Los retries esconden la intermitencia (un fallo que pasa al reintentar se reporta como "flaky", no como fallo), así que la medición de estabilidad debe hacerse sin ellos.

### 2.4 — Capturas y medición visual

- Capturas en `tmp/auditoria-qa-YYYY-MM-DD/` (carpeta gitignored): anchos 360, 390, 768 y 1280 px; zoom 200 %; recorrido solo con teclado; throttling de red lenta/CPU para el perfil mobile.
- Medición de performance/visual contra el build de producción según los criterios de la Capa 4.

### 2.5 — Evidencia y no-probado

Todo hallazgo confirmado con reproducción real; si un escenario no se puede automatizar o probar, anotarlo para el informe con la razón.

## Etapa 3 — Informe

Entregar `.devin/informes/auditoria-qa-YYYY-MM-DD.md` con:

- Encabezado: fecha, baseline (`git rev-parse HEAD`), alcance aprobado y comandos ejecutados con resultado.
- Resumen ejecutivo con conteos (tests nuevos, corridos, hallazgos por severidad).
- Hallazgos ordenados por severidad (crítico/mayor/menor/informativo); cada uno con: descripción, pasos para reproducir, evidencia (ruta de captura, salida de test, `<ref_file .../>`), impacto y sugerencia de corrección.
- Apartado "Riesgos a futuro": escalabilidad, deuda técnica, dependencias, configuración de producción — sin repetir lo ya documentado en `auditoria-escalabilidad-2026-09-19.md` (referenciarlo).
- Apartado visual/UX con observaciones por perfil de usuario y capturas asociadas.
- Cobertura lograda vs. lo que quedó sin probar (con motivos).
- Recomendación de qué automatizar en CI (integrarse a `.github/workflows/ci.yml`, suite de accesibilidad existente, sharding E2E si aplica).

Cierre documental: si se crean prompts o informes nuevos, actualizar en el mismo cambio `.devin/prompts/README.md`, `.devin/informes/README.md` (si aplica) y el bloque **Estructura** de `.devin/README.md`.

## Preguntas de referencia antes de la Etapa 2

Confirmar conmigo, como mínimo:

1. ¿`.env.e2e` está configurado y la base descartable disponible ahora?
2. ¿Autorizás el baseline completo (`npm test` + `npm run test:e2e` enteros, tarda) o solo los specs del área?
3. ¿El alcance incluye tests unitarios nuevos además de E2E, o solo E2E/visual?
4. ¿Autorizás agregar `data-testid` a componentes si falta un selector robusto?
5. ¿Autorizás crear un script gemelo de `scripts/dev-e2e.ts` en modo `start` para medir contra build de producción, e instalar WebKit (`npx playwright install webkit`) para `/pedido`?
6. ¿Querés corrida de Lighthouse (`npx lighthouse`, no instalado) o se reporta como no probado?

## Verificaciones antes de declarar terminada la tarea

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run knip` | Código muerto (si se agregaron archivos) |
| 5 | `npx playwright test <specs nuevos>` | Tests E2E nuevos (base descartable) |
| 6 | `npx playwright test <specs de concurrencia> --repeat-each=5 --retries=0` | Estabilidad de invariantes sin enmascarar intermitencia |
| 7 | `npm run test:accessibility` | Regresión de accesibilidad |

## Criterio de aceptación

- El plan de Etapa 1 fue aprobado antes de cualquier ejecución.
- El baseline de fallos preexistentes quedó registrado y diferenciado de los hallazgos nuevos.
- La ejecución fue por capas con checkpoint; los hallazgos críticos se reportaron al detectarse.
- Los bugs reales quedaron cubiertos por tests con `test.fail()` referenciando el hallazgo (suite en verde-esperado, `ci.yml` intacto).
- Los tests nuevos pasan de forma determinista (sin depender de datos previos ni de la hora real; usar helpers y fake timers según `lecciones-aprendidas.md`); los de concurrencia aserten invariantes por SQL y pasan 5/5 repeticiones con `--retries=0`.
- Cada hallazgo tiene reproducción y evidencia; los escenarios no ejecutables están listados con motivo; el apartado visual separa defectos objetivos de observaciones subjetivas.
- El informe sigue la estructura de Etapa 3 y los índices de `.devin` quedan sincronizados.
- Ningún archivo de producción fue modificado sin autorización.
