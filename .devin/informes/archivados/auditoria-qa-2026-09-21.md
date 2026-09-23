# Auditoría QA integral — 2026-09-21

> **Estado: implementada por completo** — hallazgos QA-01/02/03/05 corregidos y mergeados en `main` (PR #4, `35b54a1`); QA-04 queda documentado como pendiente en `reporte-estado.md`. Archivada el 2026-09-23.
>
> **Etapa 3** del prompt `.devin/prompts/auditoria-qa-integral.md`.
> Plan aprobado: `plan-auditoria-qa-2026-09-21.md`. Ejecución por capas con
> checkpoints, sin modificar lógica productiva (solo tests, helpers E2E,
> config de proyectos Playwright y documentación).

## 1. Resumen ejecutivo

Se auditaron los flujos críticos del sistema con ejecución real (E2E contra
base descartable Neon `neondb_e2e`, `next dev` + Turbopack, 1 worker):
pedidos públicos, seguimiento, cancelación con token, paginación de
catálogo, reservas y descuentos de stock, conversión a venta, caja,
multi-sucursal, chat, uploads, autenticación/autorización, concurrencia,
idempotencia, rate limiting, expiración de pedidos, accesibilidad WCAG 2.2
y UX responsive.

**Resultado:** 3 hallazgos reales en la ronda inicial (QA-01, QA-02,
QA-03), todos reproducidos con tests y **corregidos en la rama
`fix/qa-2026-09-21`** (sin commit a la espera de aprobación). La ronda de
revisión posterior agregó dos hallazgos más: QA-05 (corregido en la misma
rama, era parte del fix de QA-01) y QA-04 (documentado, queda para una
rama posterior). El resto de la superficie auditada respondió según lo
esperado.

| ID | Hallazgo | Severidad | Estado |
| --- | --- | --- | --- |
| QA-2026-09-21-01 | `pending` vencido sigue recibible y confirmable por POST directo | 🟡 Mayor | **Corregido en rama** |
| QA-2026-09-21-02 | `idempotencyKey` nueva en cada intento (4 submits) | 🟡 Mayor | **Corregido en rama** |
| QA-2026-09-21-03 | Uploads con body no-multipart responden 500 (4 rutas) | 🟢 Menor | **Corregido en rama** |
| QA-2026-09-21-04 | Misma clave + payload distinto devuelve el recurso original sin aviso | 🟢 Menor | Documentado — pendiente (rama posterior) |
| QA-2026-09-21-05 | Handlers asíncronos del listado de pedidos sin `catch` (rechazo silencioso) | 🟢 Menor | **Corregido en rama** |

## 2. Baseline y entorno

- **HEAD auditado:** `70ea1fc` (`main`).
- **Baseline unitario:** 173 suites / 1859 tests — todos verdes (≈26 s).
- **Baseline E2E:** 127/127 tests verdes (≈22.6 min, 1 worker), sin
  fallos ni intermitencias previas.
- **Entorno E2E verificado** (sin exponer valores): `.env.e2e` completo,
  base `neondb_e2e` descartable (nombre cumple el patrón del guard),
  distinta de `.env.local`, `DATA_CACHE_REVALIDATE_S=0`, secreto auth
  ≥ 32 bytes, credenciales admin presentes, rate limit habilitado.
- **Limpieza previa:** se eliminó el archivo espurio `nul` (residuo de
  redirect de Windows, no pertenecía al repo).

## 3. Cobertura ejecutada

### Tests nuevos agregados por la auditoría

| Spec / archivo | Contenido | Resultado |
| --- | --- | --- |
| `tests/e2e/pedido-seguimiento.spec.ts` | F1.4/E1/S3.5: búsqueda pública por número+nombre/teléfono, estado y progreso, link al chat, datos incorrectos, cancelación con token, token inválido, aislamiento por sucursal | 5/5 ✓ |
| `tests/e2e/pedido-catalogo-paginacion.spec.ts` | F1.5: >200 productos `service`, paginación y "Cargar más" | 1/1 ✓ |
| `tests/e2e/pedido-expiracion.spec.ts` | C2.1: `recibir` y `confirmar` sobre `pending` vencido | 2 tests → hallazgo QA-01 (`test.fail`) |
| `src/components/pedido/pedido-client.test.tsx` | C2.7: reintento de checkout tras error 500 compara las `idempotencyKey` enviadas | 1 test → hallazgo QA-02 (`test.failing`) |
| `tests/e2e/concurrencia-stock.spec.ts` | C2.5: invariantes SQL post-carrera (movimientos exactos, sin reservas huérfanas, stock ≥ 0) | 3 tests, 15/15 repeticiones ✓ |
| `tests/e2e/concurrencia-pedidos.spec.ts` | C2.2, C2.3, C2.6, C2.7, C2.8: último insumo, doble submit misma clave, reintento misma clave, doble mensaje chat, rate limit | 5/5 ✓ |
| `tests/e2e/concurrencia-pagos.spec.ts` | C2.4, C2.9: doble submit venta/confirmación, invariantes `sale_payments`, pagos mixtos/negativos/cero | 3/3 ✓ |
| `tests/e2e/api-seguridad.spec.ts` | S3.1–S3.3, S3.6, E2–E3, datos extremos, QA-03 | 11 tests (10 ✓ + 1 `test.fail`) |
| `tests/e2e/accessibility.spec.ts` | V4.1: se agregó corrida WCAG 2.2 AA sobre las páginas públicas | 0 violaciones |
| `tests/e2e/ux-perfiles.spec.ts` | V4.2–V4.5: 360/390/768/1280 px, reflow 320 px (WCAG 1.4.10), seguimiento 360 px, teclado completo, Fast 3G + CPU 4× | 7/7 ✓ |
| `tests/e2e/helpers.ts` | `waitForHydratedInput`, invariantes SQL (`countStockMovements`, `countOrderReservations`, `getProductStockFromDb`), `expireOrderById`, helpers de sucursal/caja | — |
| `playwright.config.ts` | Proyecto `webkit` opt-in (`E2E_WEBKIT=1`), no altera la suite normal | — |

### Resultados por capa

- **Capa 1 (flujos):** seguimiento público completo ✓, cancelación con
  token ✓, paginación >200 ítems ✓. 6/6 nuevos.
- **Capa 2 (borde/concurrencia):** carreras resueltas con locks y `409`;
  25/25 en `--repeat-each=5`; idempotencia servidor OK con misma clave;
  rate limit `429`; pagos extremos rechazados. 2 hallazgos (QA-01, QA-02).
- **Capa 3 (seguridad):** IDOR 404, escalada operator→admin 403, tokens
  cruzados 404/401, adjuntos con traversal rechazados, magic bytes y
  oversize 400, crons sin secreto 401, payloads extremos 400. 10/10 ✓
  más el hallazgo QA-03.
- **Capa 4 (a11y/UX/prod):** axe WCAG 2.1 AA y 2.2 AA con **0 violaciones**
  en páginas públicas, panel y chat; sin overflow horizontal a
  360/390/768/1280 px ni reflow a 320 px; checkout completo solo con
  teclado; WebKit 5/5; build de producción limpio (44 estáticas + rutas
  dinámicas, TypeScript OK); CSP prod con nonce y sin `unsafe-eval`.

## 4. Hallazgos

### QA-2026-09-21-01 — `pending` vencido sigue recibible y confirmable

- **Severidad:** 🟡 Mayor (efecto financiero real vía endpoint
  autenticado; la ventana es "vencido pero todavía no barrido").
- **Estado:** **corregido en rama** — ver §12.
- **Dónde:** `src/application/services/orderService.ts`
  (`receiveOrder`, `convertOrderToSale`) vs `expireStalePendingOrders`.
- **Reproducción** (`tests/e2e/pedido-expiracion.spec.ts`, `test.fail`):
  1. Crear pedido público `pending` y retroceder su `createdAt` por debajo
     de `ORDER_EXPIRATION_MS` (`expireOrderById`).
  2. `POST /api/pedidos/{id}/recibir` → **200**, pasa a `in_process` y
     **reserva stock**.
  3. `POST /api/pedidos/{id}/confirmar` → **201**, crea **venta con
     movimientos de caja/stock** y pasa a `paid`.
- **Causa:** la expiración lazy (`expireStalePendingOrders`) corre solo en
  lecturas (`getOrders`, `getPendingOrders`, `trackOrder`). Las mutaciones
  validan el `status` almacenado pero no `createdAt + ORDER_EXPIRATION_MS`,
  así que entre el vencimiento real y el próximo barrido el pedido vencido
  es operable.
- **Impacto:** se crea una venta real (movimientos de caja y descuento de
  stock) a partir de un pedido que el dominio ya considera vencido y que
  el cliente pudo haber visto cancelado en el seguimiento. Peor aún: si
  el barrido lazy corrió entre el vencimiento y el click, las reservas ya
  fueron liberadas — la conversión descuenta stock sin reserva previa,
  con doble compromiso potencial sobre el mismo stock. La reproducción
  realista lo confirma desde la UI: con la lista `/pedidos` abierta y el
  pedido vencido por detrás sin nuevo barrido, el botón "Confirmar pago"
  sigue visible y el click convertía el pedido en venta.
- **Recomendación:** en `receiveOrder` y `convertOrderToSale`, dentro de la
  transacción y con el lock de fila ya existente, comprobar
  `createdAt + ORDER_EXPIRATION_MS` (o invocar `cancelExpiredOrder` cuando
  corresponda) y rechazar con 409/410 si está vencido. Al corregirse, los
  `test.fail` pasan a verde sin tocar el spec.

### QA-2026-09-21-02 — `idempotencyKey` regenerada en cada intento

- **Severidad:** 🟡 Mayor (duplicados reales de pedidos/ventas ante
  reintentos o doble click — el vector más común de duplicación elude la
  deduplicación del servidor; el patrón se repite en los 4 submits del
  cliente).
- **Estado:** **corregido en rama** — ver §12.
- **Dónde:** `src/components/pedido/usePedidoClient.ts`
  (`idempotencyKey: nanoid()` dentro de `handleSubmitCheckout`); mismo
  patrón en terminal de ventas y confirmación del panel.
- **Reproducción** (`pedido-client.test.tsx`, `test.failing`): mock de
  `fetch` que falla con 500 en el primer submit; al reintentar, la clave
  enviada **difiere** de la primera — el backend no puede deduplicar el
  reintento.
- **Causa:** la clave se genera por llamada en vez de una vez por sesión
  de checkout.
- **Impacto:** el vector principal de duplicados (error de red/5xx → el
  usuario reintenta; doble click antes del disable) elude la deduplicación
  del servidor, que sí funciona cuando la clave se reutiliza (verificado
  en C2.3/C2.7).
- **Recomendación:** generar la clave una vez por carrito/sesión de
  checkout y rotarla solo tras el éxito (o al vaciar el carrito).

### QA-2026-09-21-03 — Uploads con body no-multipart → 500

- **Severidad:** 🟢 Menor (robustez/observabilidad; sin impacto de
  seguridad ni datos — la request falla antes de cualquier efecto).
- **Estado:** **corregido en rama** — ver §12.
- **Dónde:** `src/app/api/public/pedido/[id]/chat/upload/route.ts` y la
  variante autenticada `src/app/api/pedidos/[id]/chat/upload/route.ts`.
  El barrido posterior de `request.formData()` encontró el mismo patrón
  en otras dos rutas: `src/app/api/productos/imagen/upload/route.ts` y
  `src/app/api/videos/upload/route.ts` (4 rutas en total).
- **Reproducción** (`api-seguridad.spec.ts`): `POST` a cada endpoint de
  upload con body JSON (Content-Type no multipart) → `request.formData()`
  lanza `TypeError` que `withApiErrorHandling` no mapea → **500 "Error
  interno del servidor"** en vez de 400.
- **Recomendación (aplicada):** capturar únicamente el `TypeError` del
  parseo y mapearlo a 400; cualquier otro error se re-lanza para no
  esconder fallos de almacenamiento o lógica.

### QA-2026-09-21-04 — Misma `idempotencyKey` + payload distinto devuelve el original sin aviso

- **Severidad:** 🟢 Menor.
- **Estado:** **documentado, no implementado** — va a una rama posterior
  (decisión del usuario para mantener esta revisión manejable).
- **Dónde:** `orderRepository.findExistingByIdempotencyKey` /
  deduplicación en `createOrder`, `convertOrderToSale` y `createSale`:
  la deduplicación compara solo `(branchId, idempotencyKey)` — si la
  clave coincide, se devuelve el recurso original **sin comparar el
  payload** y (pre-fix) sin marca alguna.
- **Reproducción** (`checkout-idempotencia.spec.ts`): POST con clave K y
  carrito A → 201; POST con clave K y carrito B (producto distinto) →
  **201 con el pedido A**, el payload B se ignora.
- **Impacto:** con el fix de QA-02 el cliente rota la clave al cambiar el
  carrito, así que el vector queda mitigado del lado del cliente. El
  hueco residual es del lado del servidor: cualquier cliente que reutilice
  una clave con datos distintos recibe un recurso que no refleja lo que
  pidió. Con el flag `deduplicated` de esta rama la UI ya puede avisar,
  pero el servidor sigue sin detectar la divergencia de payload.
- **Propuesta (estimación de costo):**
  1. Serialización canónica del payload relevante (orden estable de
     campos/claves) — bajo costo, pero hay que definir qué campos entran
     (ítems+opciones+entrega sí; ¿pagos? — hoy se excluyen
     deliberadamente de la firma del cliente).
  2. Hash criptográfico (SHA-256) de esa serialización — trivial.
  3. Persistencia: columna nueva en las tablas que guardan la clave
     (`orders`, `sales`) → **requiere migración de esquema** y decisión
     para filas existentes (huella nula = aceptar sin comparar).
  4. Comparación en el servidor: misma clave + misma huella → dedup
     (devolver original + `deduplicated`); misma clave + huella distinta
     → **409** con mensaje explícito.
  - Estimación: cambio acotado en código (~1 día de trabajo incluyendo
    migración y tests), pero es **incompatible hacia atrás** para
    clientes que reutilicen claves con payloads distintos (hoy reciben
    201; pasarían a recibir 409) — por eso se posterga.

### QA-2026-09-21-05 — Handlers asíncronos del listado de pedidos sin `catch`

- **Severidad:** 🟢 Menor (el error existía pero era invisible; se
  vuelve crítico en presencia del nuevo 409 de QA-01).
- **Estado:** **corregido en rama** — ver §12.
- **Dónde:** `pedidos-list.handleConfirm`/`handleFinish`/`handleCancel`
  llamaban `throwApiError` sin `catch`: cualquier error (incluido el 409
  de pedido vencido) era una promesa rechazada sin handler — rechazo
  silencioso, sin feedback al operador y con la fila stale en pantalla.
- **Corrección:** estado `actionError` + `catch` que muestra el mensaje
  (`pedidos-action-error`) y refresca el listado para limpiar filas
  stale; en `usePedidoDetail` los catches ya existían y ahora además
  recargan el detalle (`loadOrder`) tras el error.
- **Escaneo de otros handlers async de UI** (grep `async`+`await` sin
  `try`/`catch` en `src/components` y `src/app`): los candidatos
  restantes (`caja-panel`, `caja-status`, `cash-register-actions`,
  `product-trash-actions`, `cast-button`, `video-list`) delegan en hooks
  o padres que ya capturan el error internamente (`useCashRegister`,
  diálogos de confirmación con `onConfirm` controlado) o en server
  actions que devuelven `{ error }` y se muestran en la UI. Sin otros
  rechazos silenciosos encontrados.

## 5. Observaciones (no defectos)

- **Doble envío de chat (R9):** dos POST paralelos con el mismo contenido
  crean dos mensajes — `order_messages` no tiene clave de idempotencia.
  Comportamiento esperado del diseño actual; queda documentado por si se
  decide deduplicar en el futuro.
- **Pérdida de input pre-hidratación (WebKit):** en `/pedido/seguimiento`,
  un `fill` previo a que React enganche `onChange` se pierde cuando
  `useSyncExternalStore` (localStorage) dispara la primera re-render. En
  Chromium la ventana es imperceptible; en WebKit/dispositivos lentos un
  usuario muy rápido podría perder lo tipeado. Característica React
  habitual de inputs controlados; se documenta como observación UX menor.
  Los tests esperan la hidratación con `waitForHydratedInput`.
- **Fast 3G + CPU 4× (gama baja):** primer producto del catálogo visible a
  los **5 272 ms** contra `next dev` (bundles sin minificar). Sirve como
  cota superior; no es representativo del build de producción (ver
  limitaciones).
- **Rate limit público:** tras 2 pedidos/min por IP → `429` ✓. Los tests
  inyectan `x-forwarded-for` distintos por request porque `page.request`
  no hereda los headers extra de `page`.
- **Botón `disabled` durante `isCheckingAvailability` (UX, observado en
  la corrida `ux-perfiles` ×10):** el botón "Confirmar pedido" queda
  `disabled` mientras corre el chequeo de disponibilidad, sin comunicar
  nada al usuario. Con HTML `disabled` el botón **puede perder el foco**
  (el navegador lo mueve al `body`) y un `Enter` durante esa ventana se
  traga sin efecto ni feedback — con red lenta la ventana crece y el
  usuario que navega por teclado no entiende por qué "no pasa nada".
  Propuesta **sin implementar** en esta rama: usar `aria-disabled="true"`
  en lugar de `disabled` (conserva el foco y permite interceptar el
  click para explicar el bloqueo), texto de estado visible tipo
  "Verificando disponibilidad…" junto al botón, `aria-busy` en el
  contenedor del submit para tecnologías asistivas, y mantener el guard
  lógico en `handleSubmitCheckout` (ya existe) para impedir el envío
  real mientras se verifica.

## 6. Áreas verificadas sin hallazgo

- **Stock y concurrencia:** locks serializan recepciones (1 ganador `200`,
  perdedores `409`); sin oversell ni reservas duplicadas/huérfanas;
  ventas concurrentes sin stock negativo; `sales.total = Σ sale_payments`
  post-carrera.
- **Multi-sucursal:** 404 consistente al operar ids ajenos (pedidos,
  recibir, cancelar, chat); seguimiento con `branchId` ajeno no resuelve.
- **Autorización:** operador → endpoints admin 403; rutas públicas con
  token ajeno 401/404; adjuntos exigen token del pedido correcto; crons
  exigen `Bearer` válido.
- **Uploads:** MIME declarado falso detectado por magic bytes → 400;
  oversize → 400; traversal de `key` rechazado.
- **Accesibilidad:** axe-core WCAG 2.1 AA **y** 2.2 AA, 0 violaciones en
  3 públicas + 10 de panel + chat.
- **Responsive:** sin overflow horizontal a 360/390/768/1280 px; reflow
  WCAG 1.4.10 a 320 px sin elementos desbordados; controles de seguimiento
  alcanzables a 360 px; checkout completo operable solo con teclado.
- **CSP:** `script-src` con nonce por request, sin `unsafe-inline`; en
  producción sin `unsafe-eval` y con `upgrade-insecure-requests`;
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`. Build de producción compila limpio.
- **WebKit:** flujo público de seguimiento 5/5 tras corrección de timing
  del test (proyecto opt-in `E2E_WEBKIT=1`).

## 7. Limitaciones

1. Los E2E corren contra `next dev` (Turbopack, sin minificar): los
   tiempos de carga bajo throttling son una cota superior, no representan
   producción. El build prod se verificó compilando, pero no se midieron
   TTFB/LCP contra `next start` (el plan contemplaba un script gemelo que
   no se construyó: `npm run build` + CSP por código fueron suficientes
   para el objetivo de riesgo R8).
2. WebKit se probó con un smoke de 5 tests (flujo público), no la suite
   completa.
3. La resolución de IP en producción detrás de proxy real no se ejercitó
   (diseño verificado por código: `TRUSTED_PROXY_IP_HEADER` /
   `x-vercel-forwarded-for` / `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS`).
4. El aislamiento multi-sucursal se ejercitó con 2 sucursales y datos
   sintéticos, no con la cardinalidad real de producción.

## 8. Recomendaciones

1. **QA-04 (rama posterior, ya fusionada esta):** huella del payload en
   la deduplicación por `idempotencyKey` + respuesta 409 ante divergencia
   — cierra el hueco del lado del servidor que hoy solo se mitiga desde
   el cliente. Estimación en §4.
2. **Observación UX del botón `disabled`:** reemplazar por
   `aria-disabled` + texto de estado + `aria-busy` (§5) — el submit ya
   está protegido por el guard lógico.
3. Considerar deduplicación de `order_messages` (clave por cliente+pedido
   +contenido/ventana) si el doble envío de chat resulta molesto en
   operación real.
4. Opcional: inputs de formularios públicos `disabled` hasta hidratación
   (o `defaultValue` no controlado) para la observación pre-hidratación.
5. **Post-deploy:** observar los 409 de `recibir`/`confirmar` en los logs
   — un volumen alto indicaría pantallas stale frecuentes o barrido lazy
   insuficiente.
6. **Proceso:** commits separados por hallazgo (QA-01, QA-02, QA-03) más
   uno de tests/documentación; PR con suite completa en CI antes de
   fusionar.
7. **Agenda ronda 2:**
   - **E4 — sesión con `activeBranchId`/`branchId` huérfano tras
     `deleteBranch` (candidata a P0, reconocida sin tests):** el cascade
     es hard delete físico (sucursal + usuarios + datos) y el JWT no
     revalida contra DB, así que un operador de la sucursal eliminada
     sigue autenticado con `session.user.branchId` muerto. Ningún
     servicio valida que el `branchId` exista antes de escribir: la
     mayoría de los flujos fallan limpio (caja/producto/pedido borrados
     → 400/404), pero los inserts directos (`openCashRegister`,
     `createProduct`, `videoRepository.create`, `userRepository.insert`)
     llegan a la FK de `branches` → **500 por violación de FK**. No hay
     escritura con FK inconsistente (la constraint lo impide); el daño
     es el 500 + sesión fantasma hasta expirar el JWT. Mitigación
     propuesta: validar existencia del `branchId` efectivo en
     `getCurrentBranchId` (lectura ya cacheada) → 403 — cubre todos los
     endpoints de golpe.
   - V4.6: CSP y medición contra `next start` (script gemelo de
     `dev-e2e.ts`, quedó sin autorización en Etapa 1).
   - S3.8: confianza en `X-Forwarded-For` detrás de proxy real.
   - Turnos/medianoche, revisión visual cualitativa (daltonismo) y
     mutation testing.
   - Confirmado cubierto (no re-agendar): E3 (adjunto con token válido
     de otro pedido → 401, `api-seguridad.spec.ts`) y C2.8 (rate limit
     429 + N pendings → 1 recepción, `concurrencia-pedidos.spec.ts`).

## 9. Archivos de la auditoría

- Prompt: `.devin/prompts/auditoria-qa-integral.md`
- Plan: `.devin/informes/archivados/plan-auditoria-qa-2026-09-21.md`
- Evidencia visual: `tmp/auditoria-qa-2026-09-21/` (capturas 360/390/768/
  1280/320 px, seguimiento 360 px, catálogo Fast 3G)
- Specs y helpers nuevos/modificados: listados en §3.

## 10. Verificaciones finales

| Verificación | Resultado |
| --- | --- |
| `npm run lint` | ✓ sin errores ni warnings |
| `npx tsc --noEmit` | ✓ limpio |
| `npm test` | ✓ 173 suites / 1860 tests (+1 por el `test.failing` de QA-02) |
| `npm run knip` | ✓ limpio |
| `npm run build` | ✓ 44 páginas estáticas + rutas dinámicas, TypeScript OK |
| `npm run test:e2e` (regresión completa, 163 tests) | 155 ✓ + 4 fail + 4 flaky — todos los fallos trazados a contaminación de datos del spec nuevo de paginación (ver §11) |
| Re-verificación dirigida post-fix (5 specs, 35 tests) | ✓ 35/35 |
| `npm run test:accessibility` | ✓ 4/4 (WCAG 2.1 AA + 2.2 AA, 0 violaciones) |
| WebKit (`E2E_WEBKIT=1`, smoke) | ✓ 5/5 |

## 11. Lección de higiene de la suite (incidente de tests, no de producto)

La primera regresión completa expuso un problema en el spec nuevo
`pedido-catalogo-paginacion.spec.ts`: los 205 servicios insertados para
superar el page-size quedaban en la base compartida y contaminaban a los
specs posteriores (`productos-y-recetas`, `tour`, `responsive`,
`ux-perfiles` → 4 fallidos + 4 flaky, siempre por timeouts o filas
desplazadas en `/productos`).

Corrección aplicada: `try/finally` que borra los productos creados por
prefijo de nombre (`ZZZ Paginación {stamp} %`) al terminar el test, y
timeout de la aserción de éxito del checkout por teclado subido a 30 s.
Re-verificación dirigida de los 5 specs afectados: **35/35 verdes** — la
causa era la contaminación, no el producto.

Regla derivada para futuros specs de esta suite: cualquier inserción bulk
en la base compartida debe limpiarse en `finally`; la numeración `ZZZ`
del prefijo se eligió justamente para dejar los datos al final del orden
alfabético y facilitar la limpieza.

## 12. Correcciones aplicadas (rama `fix/qa-2026-09-21`)

Los tres hallazgos originales se corrigieron tras reproducciones
adicionales pedidas por el usuario; la revisión posterior agregó la
corrección de QA-05 y dejó QA-04 documentado para otra rama. Los
`test.fail`/`test.failing` se convirtieron en tests normales que pasan
en verde.

### QA-01 — política adoptada: 409 + cancelación, detectado bajo el lock

- `receiveOrder` y `convertOrderToSale` verifican
  `isExpiredPending(locked)` **después** de `findByIdForUpdate`, dentro
  de la transacción — la decisión de rechazo depende del estado
  bloqueado, no de la lectura previa sin lock (la carrera con el barrido
  lazy queda serializada por el `FOR UPDATE`).
- Detalle de implementación que el enunciado no contemplaba: un `throw`
  dentro de la transacción revierte **todo** — incluida cualquier
  cancelación escrita adentro. Por eso el check lanza una sentinela
  (`ExpiredPendingOrderError extends ConflictError`) y el `catch`
  externo confirma la cancelación con `cancelExpiredOrder` en una
  transacción propia con su propio lock, antes de propagar el 409.
  Resultado: el pedido queda `cancelled` de inmediato (no queda el limbo
  "vencido pero `pending`" hasta el próximo barrido) y la API responde
  `409`.
- `ConflictError` es una clase nueva de `domain/errors` mapeada a 409 en
  `api-handler` (antes el único 409 era `InsufficientStockError`).
- En `convertOrderToSale` la deduplicación por `idempotencyKey` corre
  **antes** del check de expiración: un reintento de una venta ya creada
  devuelve la venta existente aunque el pedido haya vencido después —
  es el orden correcto.
- **Reloj:** la expiración se decide **con el reloj de la aplicación** en
  los tres puntos: `createdAt` se escribe con `nowUTC()`, las
  comparaciones usan `Date.now()` y el umbral sale de
  `getOrderExpirationMs()`. El barrido (`expireStalePendingOrders`) usa
  exactamente la misma base (`Date.now() - getOrderExpirationMs()`), así
  que check y barrido son consistentes. No interviene el reloj de
  PostgreSQL.
- **Texto que ve el operador:** `El pedido expiró por inactividad y fue
  cancelado.` — viaja en el body del 409 y `throwApiError` lo propaga al
  `actionError` visible.
- **Caso realista verificado:** lista `/pedidos` abierta, el pedido vence
  por detrás sin nuevo barrido → el botón **"Confirmar pago" sigue
  visible** (fila stale); el click recibe 409, el operador ve el error
  (`pedidos-action-error`) y el listado se refresca — la fila desaparece.
- **El detalle del pedido también maneja el 409:** `usePedidoDetail`
  muestra el mismo mensaje en su `actionError` y, tras el fix, recarga el
  detalle (`loadOrder` + `router.refresh`) para reflejar el `cancelled`
  real en vez de quedar con botones habilitados sobre un estado viejo.
- **Tests de regresión agregados** (`pedido-expiracion.spec.ts`):
  1. Pedido `in_process` con `createdAt` más viejo que
     `ORDER_EXPIRATION_MS` → **se puede confirmar** (la expiración solo
     aplica a `pending`).
  2. Carrera `recibir` + `confirmar` + barrido sobre un pedido vencido:
     todas las combinaciones terminan rechazadas o en `cancelled`, las
     reservas se liberan **una sola vez** (un único movimiento
     `reserve_release` por pedido) y no quedan movimientos de stock
     huérfanos ni venta creada.

### QA-02 — hook compartido `useSubmitIdempotencyKey`

- Nuevo `src/hooks/use-submit-idempotency-key.ts`: `resolve(signature)`
  conserva la clave mientras la firma no cambie, `reset()` la descarta
  tras el éxito.
- Aplicado a los **cuatro** submits reales (no tres): checkout público
  (`usePedidoClient`), terminal de ventas (`sales-terminal`),
  confirmación desde el detalle (`usePedidoDetail`) y confirmación desde
  el listado (`pedidos-list`).
- **Firma del checkout:** `checkoutSignature(items, deliveryType,
  address)` = `cartSignature` (producto+cantidad+`selectedRecipeItemIds`
  por ítem, orden estable) **+ tipo de entrega** (`pickup`/`delivery`)
  **+ dirección** (solo en `delivery`, normalizada). Cambiar una opción
  de receta, el tipo de entrega o el destino rota la clave — el servidor
  devolvería el pedido original si se reutilizara. Nombre, teléfono,
  notas y **pagos** quedan fuera: son metadatos del mismo intento;
  corregirlos y reintentar debe deduplicar (y en ventas, no cobrar dos
  veces si la respuesta se perdió).
- **Persistencia de la clave — criterio elegido:** la clave vive en un
  `useRef`, es decir **solo en memoria** de la instancia del componente.
  Se conserva entre reintentos y remounts internos, se rota si cambia la
  firma y se descarta tras el éxito. **Si el usuario recarga la página
  después de perder la respuesta, la clave se pierde** y el próximo
  intento puede crear un duplicado. Se eligió memoria y no
  `sessionStorage` porque: (a) el vector real del hallazgo es el
  reintento inmediato (doble click, error de red, respuesta cortada), que
  memoria cubre; (b) persistir en `sessionStorage` extiende el alcance a
  claves que sobreviven recargas — útil, pero introduce decisiones
  adicionales (serializar la firma, invalidar al cambiar de sucursal o
  cerrar sesión, higiene de tabs) que exceden el fix pedido. Queda como
  mejora posible si se quiere cubrir también la recarga.
- **Respuesta ante deduplicación (ítem pedido):** el servidor ahora marca
  el recurso deduplicado con `deduplicated: true` en
  `POST /api/public/pedido` (devuelve el pedido existente) y
  `POST /api/pedidos/[id]/confirmar` (devuelve la venta existente).
  - Checkout público: el diálogo de éxito muestra el pedido devuelto por
    el servidor más el aviso `order-dedup-notice` ("Este pedido ya estaba
    registrado: se recuperó el pedido original, no se creó uno nuevo").
  - Panel (detalle y listado): la venta devuelta se usa para refrescar la
    vista y se muestra el aviso "El pedido ya estaba confirmado como
    venta; se recuperó la venta registrada originalmente y los cambios de
    pago del reintento no se aplicaron." — explícito sobre el caso de
    pagos editados entre intentos.
  - `POST /api/ventas` ya devolvía **400 "La venta ya fue procesada."**
    ante deduplicación (aviso explícito existente; no se tocó).
  - E2E que lo prueba: retry con respuesta cortada → mismo recurso +
    aviso visible; segundo `confirmar` con pagos modificados → 201 con la
    venta original y `deduplicated: true` (los pagos nuevos no se
    aplican).
- E2E base (`checkout-idempotencia.spec.ts`): `route.fetch()` +
  `route.abort()` deja que la request llegue al servidor y corta la
  respuesta → el reintento envía la **misma** clave → la base tiene **1**
  pedido (pre-fix enviaba otra clave y quedaban 2).

### QA-03 — las cuatro rutas con `request.formData()`

- Barrido completo: los únicos `request.formData()` de la app están en
  `/api/public/pedido/[id]/chat/upload`, `/api/pedidos/[id]/chat/upload`,
  `/api/productos/imagen/upload` y `/api/videos/upload`. Las **cuatro**
  repetían el patrón y las cuatro se corrigieron.
- Patrón aplicado: `try/catch` que **solo** traduce el `TypeError` del
  parseo a `ValidationError` ("El cuerpo debe ser multipart/form-data.")
  → 400; cualquier otro error se re-lanza (`if (!(error instanceof
  TypeError)) throw error`) para no esconder fallos de almacenamiento o
  lógica. El comportamiento con multipart válido no cambia.
- E2E: los cuatro endpoints responden 400 ante body no-multipart
  (4/4 en `api-seguridad.spec.ts`).

### QA-05 — `catch` agregados en `pedidos-list` + recarga en `usePedidoDetail`

- Detallado en §4: `actionError` visible, `catch` en los tres handlers
  del listado con `refresh()` para limpiar filas stale, y recarga del
  detalle tras errores de acción en `usePedidoDetail`. Escaneo del resto
  de la UI sin otros rechazos silenciosos.

### Verificaciones post-corrección

| Verificación | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✓ limpio |
| `npm run lint` | ✓ sin errores ni warnings |
| `npm test` | ✓ 174 suites / 1865+ tests (hook nuevo + reconvertidos + asserts de `deduplicated`) |
| `npm run knip` | ✓ limpio |
| `npm run build` | ✓ completo |
| E2E dirigidos (expiración 5 + idempotencia 3) | ✓ 8/8 |
| E2E dirigidos seguridad (uploads no-multipart ×4) | ✓ 4/4 → 400 |
| `ux-perfiles` teclado `--repeat-each=10 --retries=0` | ✓ **10/10 (100%)** |
| Suite completa anterior (167 tests) | 166 ✓ + 1 fallido: race del test de teclado (Enter durante `isCheckingAvailability` con botón `disabled`) — corregida con `toBeEnabled()`; no era regresión del producto |
| **Corrida completa final** (`npm run test:e2e`, 172 tests, sin cambios posteriores) | ✓ **172/172 — 0 fallos, 0 intermitencias** (≈31.8 min) |
| `test.fail` / `test.failing` restantes | **0** en los hallazgos corregidos (los matches restantes son menciones documentales en este informe) |
| Migraciones / cambios de esquema | **Ninguno** (`git status`: sin tocar `drizzle/` ni `src/db/schema.ts`) |

Sin commit; rama `fix/qa-2026-09-21` con los cambios de producción más
los tests/documentación.
