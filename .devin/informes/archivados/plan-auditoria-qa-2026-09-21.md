# Plan de auditoría QA integral — 2026-09-21

> **Estado: ejecutado y archivado** (2026-09-23). Resultados en
> `auditoria-qa-2026-09-21.md`.
>
> **Etapa 1** del prompt `.devin/prompts/auditoria-qa-integral.md`. Solo lectura +
> este plan. **Ejecutado:** resultados en `auditoria-qa-2026-09-21.md`.

## 0. Baseline y entorno

- **HEAD:** `70ea1fcd49c1b8c0776e88e1ad92eb60c7e40bc8` (`main`, `fix: pipeline CI verde`).
- **Working tree:** cambios documentales preexistentes no atribuibles a esta auditoría:
  `.devin/README.md` y `.devin/prompts/README.md` modificados (indexan el propio prompt),
  `prompts/auditoria-qa-integral.md` sin trackear y un archivo espurio `nul` (residuo de
  redirect de Windows; candidato a borrar, no es del repo).
- **Inventario:** 55 rutas API (`src/app/api/**/route.ts`), 28 páginas, 14 servicios,
  12 repositorios, ~60 libs, **173 suites Jest (~1859 tests)** y **37 specs E2E (~127 tests)**.
- **Estado documentado previo:** `auditoria-proyecto-2026-09-20.md` (sin hallazgos
  críticos/altos; 100% de servicios/repos/rutas con test unitario) y
  `auditoria-escalabilidad-2026-09-19.md` (pendiente estructural: multi-tenant T14).
  Esta auditoría **no repite** ese análisis estático: se centra en ejecución real.

### Verificación del guard de E2E (ya ejecutada, solo metadatos)

`global-setup.ts` exige: `NODE_ENV=test`, `DATABASE_URL` presente, base local con nombre
seguro **o** nombre remoto terminado en `test|e2e|testing|qa|staging` (también acepta
sufijo en el host), `LOCAL_STORAGE_PATH` dentro del proyecto bajo `tmp/` o con `e2e|test`
en la ruta, secreto auth ≥ 32 chars, `ADMIN_USERNAME`/`ADMIN_PASSWORD` y
`AUTH_URL`/`NEXTAUTH_URL`. Trunca 14 tablas con `RESTART IDENTITY CASCADE`, corre el seed,
crea la segunda sucursal de prueba y precalienta el dev server.

| Chequeo sobre `.env.e2e` (sin exponer valores) | Resultado |
| --- | --- |
| `.env.e2e` existe | ✅ |
| Nombre de la `DATABASE_URL` e2e | `neondb_e2e` — ✅ cumple el patrón descartable (host remoto Neon, permitido por el sufijo del nombre; `E2E_ALLOW_REMOTE_DB` no definido ni necesario) |
| `DATABASE_URL` e2e = la de `.env.local` | ❌ difieren (son bases distintas) ✅ |
| `DATA_CACHE_REVALIDATE_S` | `0` ✅ |
| `AUTH_SECRET`/`NEXTAUTH_SECRET` ≥ 32 bytes | ✅ (66) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | ✅ definidas |
| `AUTH_URL` / `NEXTAUTH_URL` | `http://localhost:3000` ✅ |
| `LOCAL_STORAGE_PATH` | `tmp/e2e` ✅ (guard lo acepta: dentro del cwd, contiene `e2e`) |
| `E2E_ENABLE_RATE_LIMIT` / `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` | `true` / `true` ✅ |

## 1. Matriz de riesgos (impacto × probabilidad)

| # | Riesgo | Impacto | Probabilidad | Prioridad | Dónde se prueba |
| --- | --- | --- | --- | --- | --- |
| R1 | `pending` **vencido pagable/recibible** por POST directo: `convertOrderToSale` y `receiveOrder` validan estado pero no `createdAt + ORDER_EXPIRATION_MS`; la expiración lazy solo corre en lecturas (`getOrderById`, listados, `trackOrder`) | Crítico (venta de pedido expirado, stock reservado/descontado fuera de plazo) | Media (el panel siempre lee antes → la lazy suele disparar; el bypass es por API directa o timing fino) | **P0** | Capa 2, escenario C2.1 (candidato a hallazgo real) |
| R2 | Oversell/reservas inconsistentes bajo carreras reales entre clientes y operador (último insumo: N `pending` creados, solo 1 `receive` debe pasar; doble submit de pedido/venta/pago en paralelo) | Crítico | Media — protección por locks/`ON CONFLICT` existe pero solo parcialmente ejercitada | P0 | Capa 2 (C2.2–C2.5) + invariantes SQL |
| R3 | IDOR/aislamiento multi-sucursal por API (operador de A opera pedidos/ventas/caja/chat de B; escalada operator→endpoints admin) | Crítico | Baja-Media (convención `withAuth`+`branchId` consistente; falta prueba E2E exhaustiva) | P1 | Capa 3 (S3.1–S3.3) |
| R4 | Payloads manipulados en endpoints públicos (precios/totales extra, `productId` inactivo o de otra sucursal, `branchId` ajeno en seguimiento) | Mayor | Baja (Zod no acepta precios; `validateProductsForOperation` filtra por sucursal — falta prueba request-level) | P1 | Capa 3 (S3.4–S3.5) |
| R5 | Uploads maliciosos (MIME falso, magic bytes, oversize, traversal de `key` en `attachment/[key]`) | Mayor | Baja (validaciones existen en `chat-storage.ts`; sin prueba E2E real) | P1 | Capa 3 (S3.6) |
| R6 | Violaciones WCAG 2.2 AA no medidas (el spec actual usa solo `wcag21aa` = 3 reglas: no mide contraste, labels, target-size) | Mayor | Alta (es una brecha de medición casi segura) | P1 | Capa 4 (V4.1) |
| R7 | Regresión visual/UX por perfil (mobile lento, tablet, zoom 200 %, teclado, color-only info) | Mayor | Media | P2 | Capa 4 (V4.2–V4.5) |
| R8 | CSP de producción roto (`unsafe-eval` solo se quita en prod; un bug solo se vería ahí) | Mayor | Baja | P2 | Capa 4 (V4.6, requiere build prod) |
| R9 | Doble envío de mensaje de chat (sin clave de idempotencia en `order_messages`) | Menor | Alta (doble clic/red retry → mensaje duplicado) | P2 | Capa 2 (C2.6) — documentar comportamiento real |
| R10 | Paginación "Cargar más" del catálogo nunca ejercitada (`NEXT_PUBLIC_CATALOG_PAGE_SIZE=200` en e2e cubre todo en una página) | Menor | Media | P2 | Capa 1 (F1.5) |
| R11 | Dinero: pago mixto que no suma el total, vuelto negativo, redondeos a nivel API | Menor | Baja (unit cubierto; E2E ausente) | P3 | Capa 2 (C2.9) |
| R12 | Spoofing de `X-Forwarded-For` / resolución de IP en prod | Menor | Baja (diseño correcto; verificación limitada a dev) | P3 | Capa 3 (S3.8, mayormente "verificado por código") |
| R13 | Flujo público de seguimiento (`/pedido/seguimiento` + cancelación con token) sin E2E funcional | Menor | Media | P2 | Capa 1 (F1.4) |

## 2. Escenarios por capa — cobertura

Marcas: `[cubierto: spec → test('…')]`, `[parcial: qué falta]`, `[brecha nueva]`.

### Capa 1 — Flujos críticos de negocio

| Escenario | Cobertura |
| --- | --- |
| Pedido completo: catálogo → carrito → checkout → chat → `pending→in_process→paid→finished` | `[cubierto: pedido.spec.ts → 'muestra el catálogo, permite armar el carrito y abrir el chat del pedido']` + `pedido-reserva-flujo.spec.ts → 'recibe, confirma pago y finaliza un pedido sin doble descuento'` + `pedido-cancelacion-panel.spec.ts` (2 tests) |
| Carrito multi-línea/personalizaciones | `[cubierto: pedido.spec.ts → 'agrega dos variantes…', 'edita la personalización…', 'mantiene líneas separadas…']` |
| Seguimiento público `/pedido/seguimiento` + cancelación con `cancellationToken` | `[brecha nueva]` — solo aparece en `accessibility.spec.ts` (axe, no funcional). Unit: `trackOrder` cubierto en `orderService.test.ts`. **F1.4** |
| Catálogo "Cargar más" / paginación pública | `[brecha nueva]` — `NEXT_PUBLIC_CATALOG_PAGE_SIZE=200` en e2e (ver `.env.e2e.example`): ningún test ejercita el botón. **F1.5** |
| Ventas: terminal, pago mixto, anulación, precios históricos | `[cubierto: ventas-disponibilidad.spec.ts` (5), `ventas-pago-mixto.spec.ts`, `ventas-historial.spec.ts`, `paso4.spec.ts → 'anula una venta y verifica reintegro de stock']` |
| Caja: apertura/cierre/resumen/cierre diario/papelera/avisos | `[cubierto: caja-*` (3 specs), `cierres-diarios.spec.ts`, `validaciones-y-papelera.spec.ts` (7 tests), `sucursal-contactos-y-turnos.spec.ts` (avisos)]` |
| Stock: ajustes, movimientos, insumos compartidos | `[cubierto: stock-y-movimientos.spec.ts`, `ventas-stock-compartido.spec.ts`]` |

### Capa 2 — Borde y concurrencia

| Escenario | Cobertura |
| --- | --- |
| Oversell ventas paralelas (8 intentos vs stock 4) | `[cubierto: concurrencia-stock.spec.ts → 'no permite oversell']` |
| `recibir` duplicado en paralelo | `[cubierto: → 'recibir duplicado en paralelo reserva una sola vez']` |
| Carrera `recibir`/`cancelar` | `[cubierto: → 'carrera recibir/cancelar deja el pedido en estado terminal consistente']` |
| **C2.1** `pending` vencido no pagable/recebible por POST directo (`/confirmar`, `/recibir`) — expiración lazy no cubre escrituras | `[brecha nueva]` — candidato a **hallazgo real** (R1). Unit cubre solo la expiración lazy en lecturas |
| **C2.2** Dos clientes públicos por el último insumo (N `pending` con stock 1; carrera al recibir/convertir) | `[brecha nueva]` — reinterpretación: `pending` **no** reserva (lecciones §7); la contienda real es en `receiveOrder`/`convertOrderToSale` |
| **C2.3** Doble submit `POST /api/public/pedido` misma `idempotencyKey` en paralelo | `[parcial]` — unit secuencial cubierto (`orderService.test.ts → 'evita duplicados…'`); paralelo E2E ausente |
| **C2.4** Doble submit `POST /api/ventas` y `POST /confirmar` en paralelo | `[parcial]` — `validaciones-y-papelera → 'idempotencia: reenviar la misma venta devuelve error'` es secuencial |
| **C2.5** Invariantes post-carrera por SQL (`stock>=0`, reservas coherentes, `sales.total=Σ sale_payments`, reintegro único) | `[brecha nueva]` — el prompt exige helper `assertDbInvariants` en `helpers.ts` |
| **C2.6** Doble envío de mensaje de chat (mismo contenido, paralelo) | `[brecha nueva]` — `order_messages` no tiene clave de idempotencia; medir y documentar comportamiento real (R9) |
| **C2.7** Corte de red durante checkout con reintento (`setOffline`/`route.abort`) | `[brecha nueva]` — el reintento con misma key no debe duplicar pedido |
| **C2.8** Abuso de creación: muchos `pending` desde varias IPs | `[parcial]` — reinterpretado (pending no inmoviliza stock); medir rate limit como mitigación + que N pending con stock 1 solo permita 1 recepción |
| Zonas horarias / turnos overnight / pedido cerca de medianoche | `[parcial]` — unit + badges E2E cubiertos; ejercitar con `setBranchOpeningHours` turno `22:00–02:00` + `setOrderCreatedAt` |
| Redondeos/dinero: pago mixto ≠ total, vuelto negativo | `[parcial]` — unit (`money.test.ts`, `validatePaymentParts`) cubierto; falta request-level E2E |
| Datos extremos: emoji/especiales, `CHAT_MAX_TEXT_LENGTH`, adjunto grande/inválido, cantidades/precios límite | `[brecha nueva]` |

### Capa 3 — Seguridad y aislamiento

| Escenario | Cobertura |
| --- | --- |
| **S3.1** IDOR pedidos: operador sucursal A → `GET/POST /api/pedidos/{id de B}` (recibir/confirmar/cancelar/chat) | `[parcial]` — unit cubierto (`'rechaza el pedido de un producto de otra sucursal'` etc.); request-level E2E ausente |
| **S3.2** IDOR ventas/caja/stock cross-branch | `[parcial]` — `caja-aislamiento-y-trazabilidad → 'un operador no puede acceder a la caja de otra sucursal'` cubre caja vía UI; falta barrido por API |
| **S3.3** Escalada operator→admin (mutations de sucursales, usuarios, papelera, videos) + rutas panel sin sesión | `[parcial]` — `roles-y-sucursales` cubre páginas + `POST /api/productos`/`/api/recetas`; falta barrido de endpoints admin-only y verificación 401/redirect sin sesión |
| **S3.4** Payload manipulado en `POST /api/public/pedido`: campos extra (precio/total), `productId` inactivo/de otra sucursal, `quantity` límite | `[parcial]` — diseño correcto (Zod sin precios; servicio revalida contra DB); fuzz request-level ausente |
| **S3.5** Seguimiento con `branchId` ajeno (`orderNumber` único por sucursal) | `[brecha nueva]` — acotado por requerir datos del cliente; documentar comportamiento |
| **S3.6** Uploads: MIME falso, magic bytes inválidos, oversize, `key` con `../` en `GET /api/chat/attachment/[key]` | `[parcial]` — `chat-storage.ts` valida todo esto (unit); request-level E2E ausente |
| **S3.7** `CRON_SECRET` en los 3 crons (sin header, header inválido) | `[cubierto unit: route.test.ts de cada cron]` — re-verificación E2E liviana opcional |
| **S3.8** `X-Forwarded-For` spoofing vs `TRUSTED_PROXY_IP_HEADER` | `[parcial]` — los tests **usan** XFF confiado; falta probar que un header distinto se ignora. Resolución en prod sin proxy → `DomainError` (verificar por código/config, reportar como "no probado en prod") |
| **S3.9** Headers de seguridad + CSP (nonce, sin `unsafe-eval` en prod, `frame-src` mapas) | `[brecha nueva]` — solo verificable contra build de producción |

### Capa 4 — Visual y accesibilidad por perfil

| Perfil/escenario | Cobertura |
| --- | --- |
| **V4.1** axe WCAG 2.2 AA con tags completas (`wcag2a/2aa/21a/21aa/22aa`, ~70 reglas en axe 4.13) | `[brecha nueva]` — `accessibility.spec.ts` usa solo `wcag21aa` (3 reglas): hoy no mide contraste, labels ni roles. Se crea spec **nuevo** sin degradar el existente |
| **V4.2** Mobile gama baja: 360/390 px + throttling CPU/red en `/pedido`, `/seguimiento`, `/chat` | `[parcial]` — `responsive.spec.ts` cubre layout 375 px; falta throttling y estados de carga |
| **V4.3** Tablet cajero: 768 px en `/ventas`, `/caja`, `/pedidos` (objetivos táctiles, diálogos) | `[brecha nueva]` |
| **V4.4** Baja visión: zoom 200 % en flujo `/pedido` completo | `[brecha nueva]` |
| **V4.5** Teclado/lector: login + `/pedido` + `/ventas` solo Tab/Enter/Escape; foco visible; daltonismo (info no solo por color en badges de estado) | `[brecha nueva]` |
| **V4.6** Medición contra **build de producción** (script gemelo de `dev-e2e.ts` con `build`+`start`) + CSP prod | `[brecha nueva]` — requiere autorización para el script y reconstrucción del `.next` al terminar |
| **V4.7** WebKit en `/pedido` | `[brecha nueva]` — requiere `npx playwright install webkit` + proyecto ad-hoc; si no es posible → "no probado" con motivo |

### Escenarios detectados por el reconocimiento (no listados en el prompt)

- **E1** `POST /api/public/pedido/[id]/cancelar` (cancelación pública con token): sin E2E dedicado — se prueba dentro de F1.4/S3.5.
- **E2** `GET /api/public/pedido/[id]/estado` y `chat/stream` con token de otro pedido / token inválido: `[parcial: chat-stream.spec.ts → 'el stream público rechaza un token inválido']`; falta fuzz de `estado`/`leido`.
- **E3** `GET /api/chat/attachment/[key]` con `key` ajena (adjunto de otro pedido con token válido de otro): `[brecha]` — validar scope del token.
- **E4** Sesión admin con sucursal activa = sucursal eliminada (cookie `activeBranchId` huérfana): `[brecha]` — derivado de `sucursal-eliminacion`.
- **E5** Archivo espurio `nul` en la raíz del repo (residuo Windows): informativo, no de producto.

## 3. Correcciones a las premisas del prompt (reconocimiento)

1. **"`pending` reserva stock"** → falso: la reserva se crea en `receiveOrder` (`in_process`);
   `pending` no inmoviliza (`orderService.ts`, lecciones §7). El "abuso de reservas" se
   reinterpreta como abuso de creación + contienda en recepción.
2. **`findByOrderNumberAndCustomer` sin scope (H9 de la auditoría de escalabilidad)** →
   ya corregido: filtra por `branchId` (`orderRepository.ts:471+`). Se mantiene el test
   S3.5 como regresión de comportamiento público, no como bug esperado.
3. **Rate limit por poll en DB (H2)** → ya implementado `createPollRateLimiter`
   (memoria) en GETs de chat/estado y `isChatPollRateLimited`; los POST conservan store DB.
4. **`/api/public/disponibilidad` sin rate limit** → ya resuelto con veto en memoria
   (`auditoria-proyecto-2026-09-20.md` §6).

## 4. Herramienta por escenario y "listo"

| Escenario | Herramienta | Criterio de listo |
| --- | --- | --- |
| C2.1–C2.5, C2.8 | `page.request` + `Promise.all` + helper SQL `assertDbInvariants` (nuevo en `helpers.ts`, usa `db` de `src/db`) | Invariantes verdes en 5/5 repeticiones con `--repeat-each=5 --retries=0`; si C2.1 expone bug → `test.fail(true, 'hallazgo QA-2026-09-21-NN…')` |
| C2.6, C2.7 | `page.request` paralelo; `context.setOffline`/`page.route` abort + retry | Comportamiento real medido y documentado; sin 5xx |
| C2.9, datos extremos | `page.request` (payloads) + UI mínima | 400/409 esperados, mensajes saneados, sin stock corrupto (invariantes) |
| F1.4, F1.5, E1 | Playwright UI + `page.request` | Flujo seguimiento end-to-end (crear → buscar → ver estado → cancelar con token); "Cargar más" carga la página 2 |
| S3.1–S3.6, E2–E4 | `page.request` con sesiones `loginAsOperator` de ambas sucursales + requests sin sesión | 401/403/404 esperados por endpoint; cero 5xx; tabla de resultados en el informe |
| S3.8 | `page.request` con headers alternativos | XFF ignorado cuando `TRUSTED_PROXY_IP_HEADER` apunta a otro header |
| S3.9, V4.6 | Build prod (script gemelo) + `page.request`/curl de headers + axe/visual | CSP sin `unsafe-eval`, nonce presente, headers completos; TTFB/LCP anotados como referencia (no como gate) |
| V4.1 | `AxeBuilder` tags `['wcag2a','wcag2aa','wcag1aa'→'wcag21a','wcag21aa','wcag22aa']` | Violaciones catalogadas como hallazgos (objetivos) con evidencia |
| V4.2–V4.5 | Viewports 360/390/768/1280, `page.emulateMedia`, zoom 200 % vía `viewport`+CSS, navegación Tab/Enter/Escape, `cdp` throttling | Capturas en `tmp/auditoria-qa-2026-09-21/`; defectos objetivos vs observaciones subjetivas separados |
| V4.7 | Proyecto WebKit ad-hoc | `/pedido` carga, carrito funciona, sin errores de consola; o "no probado" con motivo |

## 5. Archivos nuevos estimados

| Archivo | Contenido |
| --- | --- |
| `tests/e2e/pedido-seguimiento.spec.ts` | F1.4 + E1 + S3.5 |
| `tests/e2e/pedido-expiracion-escrituras.spec.ts` | C2.1 (recibir/confirmar sobre vencido) |
| `tests/e2e/concurrencia-pedidos.spec.ts` | C2.2, C2.3, C2.8 + invariantes |
| `tests/e2e/concurrencia-pagos.spec.ts` | C2.4 + invariantes de `sale_payments` |
| `tests/e2e/checkout-resiliencia.spec.ts` | C2.6, C2.7 (puede fusionarse con concurrencia-pedidos) |
| `tests/e2e/api-seguridad.spec.ts` | S3.1–S3.6, E2–E4, C2.9, datos extremos, S3.8 |
| `tests/e2e/accesibilidad-wcag22.spec.ts` | V4.1 (spec nuevo; el existente queda intacto) |
| `tests/e2e/ux-perfiles.spec.ts` | V4.2–V4.5 + capturas |
| `tests/e2e/pedido-catalogo-paginacion.spec.ts` | F1.5 (puede ir dentro de seguimiento) |
| `tests/e2e/webkit-pedido.spec.ts` + config ad-hoc | V4.7 |
| `tests/e2e/helpers.ts` | +`assertDbInvariants`, +`createPublicOrderViaApi`, +`getOrderStatusViaApi` (extraídos de `concurrencia-stock.spec.ts` para reuso) |
| `scripts/e2e-prod-server.ts` (o similar) | V4.6 — **requiere autorización** (punto 5) |

Specs existentes a **no tocar**: `accessibility.spec.ts` (se mantiene como piso) y
`concurrencia-stock.spec.ts` (sus helpers locales se promueven a `helpers.ts` solo si
se reutilizan; de lo contrario quedan).

## 6. Supuestos

1. La base `neondb_e2e` está disponible ahora (misma que usa CI; remota pero descartable por nombre — el guard lo permite sin `E2E_ALLOW_REMOTE_DB`).
2. El servidor E2E corre con `next dev` (`npm run dev:e2e`) salvo la medición V4.6.
3. `STORAGE_PROVIDER=local` + `LOCAL_STORAGE_PATH=tmp/e2e` → uploads de prueba van a disco local gitignored.
4. La única escritura en código de producción autorizable es `data-testid` (aviso previo) y —solo si se aprueba— el script gemelo de servidor, que vive en `scripts/` y no altera runtime.
5. Los hallazgos se numeran `QA-2026-09-21-NN`; los tests que los prueban usan `test.fail()` con esa referencia.

## 7. Dudas / lo que necesito de vos (preguntas de referencia)

1. **Baseline completo**: ¿autorizás `npm test` + `npm run test:e2e` enteros antes de escribir tests (registra fallos preexistentes; la suite E2E tarda varios minutos) o solo los specs del área tocada por capa? *(Mi recomendación: completo una sola vez, es la referencia del informe.)*
2. **Tests unitarios nuevos**: la cobertura unitaria ya es ~100 % de servicios/repos/rutas. ¿Limito la auditoría a E2E/visual y solo agrego unitarios si un hallazgo lo amerita (p. ej. acompañar un `test.fail` de C2.1)?
3. **`data-testid`**: ¿autorizás agregarlos donde falte un selector robusto (p. ej. página de seguimiento, estados de carga)?
4. **Script gemelo prod** (`scripts/` que cargue `.env.e2e` y corra `next build` + `next start`) e **instalar WebKit** (`npx playwright install webkit`) para V4.6/V4.7: ¿autorizás ambos? Sin el script, CSP de prod y la medición real quedan como "no probado". El `.next` contaminado con env e2e se reconstruye con `npm run build` normal al terminar.
5. **Lighthouse**: `npx lighthouse` no está instalado. ¿Lo omito (medición con throttling de Playwright alcanza) o autorizás la instalación global/npx?
6. **`nul`**: ¿lo borro? (residuo de redirect de Windows, no pertenece al repo).

## 8. Secuencia de ejecución propuesta (Etapa 2)

1. **2.0** Guard verificado ✅ (este documento). Borrar `nul` si se aprueba.
2. **2.1** Baseline: `npm test` + `npm run test:e2e` completos → registrar resultado.
3. **Capa 1** (F1.4, F1.5) → checkpoint.
4. **Capa 2** (C2.1 primero — posible hallazgo crítico → **detenerme y avisar si confirma bug**; luego C2.2–C2.9) → checkpoint.
5. **Capa 3** (S3.1–S3.8, E2–E4) → checkpoint.
6. **Capa 4** (V4.1 → V4.7, con build prod si se aprueba) → checkpoint.
7. Regresión de specs del área + verificaciones finales (lint, tsc, jest, knip, accesibilidad).
8. **Etapa 3**: informe `auditoria-qa-2026-09-21.md` + actualización de índices `.devin`.
