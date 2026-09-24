# Resultados de pruebas manuales pre-producción — 2026-09-24

Ejecución del plan definido en [`pruebas-manuales-2026-09-24.md`](./pruebas-manuales-2026-09-24.md).

- **Entorno:** `npm run dev:e2e` en `http://localhost:3000`, base descartable `neondb_e2e` (Neon), `.env.e2e` con rate limit habilitado, `CAJA_AUTO_CLOSE_HOURS=1`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2`, `ORDER_EXPIRATION_MS=3600000`, `STORAGE_PROVIDER=local`, `DATA_CACHE_REVALIDATE_S=0`.
- **Método:** migraciones + truncate + seed + segunda sucursal (`Sucursal Test`, id 2, hoy eliminada) + `Sucursal Noche` (id 3, turno Lun 20:00–02:00). Verificación por UI (Playwright), API (curl con sesiones NextAuth reales) y consultas SQL directas sobre Neon.
- **Datos de prueba:** admin (b1), `e2e-operator-segunda` (b2), `op2` (b2→b1, luego eliminado). Productos/insumos del seed + creados: Pan Test (127), Promo Test (128), Sal Test (129), Envoltorio Test (130), Bebida Efimera (131).
- **Helpers temporales:** `.devin/tmp/` (env.ts, setup.ts, sql.ts, api.sh, scripts de chequeo). No tocan código productivo.

**Cobertura:** ~85 casos ejecutados end-to-end o a nivel servicio; el resto verificado por lectura de código dirigida (marcado "por código"). Casos no ejecutables en este entorno listados al final.

---

## 1. Defectos confirmados (ordenados por severidad)

### D1 — Cancelar pedido `paid` / anular venta con producto eliminado es IMPOSIBLE (P0, PM-COMB-11)

`buildProductContext` se invoca **sin `includeDeleted:true`** en `cancelSale` (`saleService.ts:582`) y `cancelOrder` (`orderService.ts:570`).

- Vendí producto 131 vía pedido → `paid` → soft-delete del producto → cancelación pública **404 "Producto no encontrado"**; cancelación desde panel idem; `POST /api/ventas/14/anular` idem.
- El pedido queda `paid` incancelable y la venta `active` inanulable **mientras el producto esté eliminado**. Workaround verificado: restaurar el producto → la anulación funciona y reintegra stock (3→5).
- La guarda de integridad solo cubre insumos de promos activas; productos vendibles directos quedan expuestos.

### D2 — Pedido público aceptado fuera de horario con caja abierta (riesgo #5 del plan, PM-CAT-6)

Con b1 en turno 05:00–06:00 (vencido) y caja abierta: `GET /api/public/sucursal/estado` → `isOpen:false` "La sucursal está cerrada", pero `POST /api/public/pedido` → **201** (pedido 3 creado). `createOrder` solo verifica caja abierta, no `isBranchOpen`. La UI oculta el formulario, pero la API lo acepta — bypass trivial.

### D3 — Usuario eliminado sigue operando con su JWT (riesgo #1, PM-USU-5)

Eliminado `op2` (id 3, count=0 en DB) → su sesión siguió respondiendo 200 en `/api/ventas` y `/api/pedidos`. `requireAuth` valida JWT + existencia de la **sucursal**, nunca la tabla `users`. Vigencia hasta expiración del token (~30 días).

### D4 — Reasignación de sucursal no se aplica en caliente (riesgo #2, PM-USU-6)

`op2` reasignado b2→b1 en DB → su JWT viejo siguió resolviendo `branchId=2` (resumen de caja "closed" de b2, no veía la caja abierta de b1). Opera contra la sucursal anterior hasta re-login.

### D5 — Cancelación pública con token anula ventas `paid` (riesgo #3, PM-CAT-11)

Con `cancellationToken` válido cancelé el pedido 1 en estado `paid`: orden → `cancelled`, venta 8 → `cancelled`, stock reintegrado (Pan 25→27, Salch 16→20). Un cliente anula dinero real sin intervención del negocio. **Decisión de negocio a confirmar** (el informe ya lo anticipaba); técnicamente funciona "como está diseñado", pero es un camino de dinero sin autenticación.

> **Resolución (2026-09-24):** la cancelación con token ahora solo cubre `pending`/`in_process`; un pedido `paid` se rechaza con "El pedido ya fue pagado. Para anularlo, comunicate con la sucursal." y solo puede anularse desde el panel.

### D6 — Lockout de login degrada a error 500 genérico (PM-AUTH-3)

Tras 5 fallos, el 6.º intento fallido → redirect `/api/auth/error?error=Configuration` → página 500 de NextAuth "There is a problem with the server configuration". El usuario nunca ve "Demasiados intentos". Además: **el lockout no bloquea preventivamente** — un intento con password correcta entra igual tras 5 fallos (el bloqueo solo dispara dentro de `recordFailedAttempt` de un intento fallido; cada intento ejecuta bcrypt completo). Por UI el usuario bloqueado ve el mismo "Usuario o contraseña incorrectos." — indistinguible.

### D7 — Alta de sucursal permite duplicados por mayúsculas (PM-SUC-3)

`Sucursal Noche` y `sucursal noche` coexistieron (ids 3 y 4). `createBranch` usa `findByName` (case-sensitive) mientras `updateBranch` usa `findByNameCaseInsensitiveExcludingId`. Duplicado exacto sí rechazado.

### D8 — Ajuste de stock acepta tipos de movimiento de sistema (PM-STK-3)

`POST /api/stock/ajustar` con `type:"sale"` → 200 y registró un `stock_movements` `type='sale'` fantasma (qty +1, sin venta). `stockAdjustmentSchema.type` expone el enum completo (`sale|cancellation|manual_adjustment|restock|reserve|reserve_release`) en vez de restringir a ajustes manuales.

### D9 — Ajuste de stock no es admin-only (PM-STK-7, decisión a confirmar)

`POST /api/stock/ajustar` no tiene `admin:true`: `op2` ajustó producto 118 de su sucursal (+5 → newStock 9). Si el negocio requiere que solo admin toque stock, falta la guarda.

> **Resolución (2026-09-24):** decidido — los operadores también pueden ajustar stock de su sucursal; no se agrega la guarda `admin:true`.

### D10 — Divergencias menores e inconsistencias

- Doble anulación de venta → **200 idempotente** (diseño deliberado: `if (sale.status==='cancelled') return sale`; el plan esperaba error).
- Mensajes Zod en inglés expuestos: "Too small: expected number to be >0", "Invalid input: expected number, received NaN" (`/api/public/sucursal/estado` sin `branchId` → 400 NaN; el catálogo/pedido sí default-an a la sucursal principal — inconsistencia entre endpoints públicos).
- `POST /api/public/pedido` y `/api/pedidos/[id]/confirmar` rechazan sin caja con mensaje "Horario de atención: …" aunque la causa es caja cerrada, no horario.
- `selectedRecipeItemIds` con IDs inexistentes se ignoran silenciosamente (sin validación).
- `paymentMethod` del sale devuelve solo el primer método en pagos mixtos (las partes sí persisten en `sale_payments`).
- `POST /api/productos` ignora el campo `stock` enviado (nace en 0; solo `/api/stock/ajustar` lo carga) — puede confundir si el formulario lo sugiere.

---

## 2. Resultados por módulo

### 5.1 Auth

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-AUTH-1 Login admin/operador | ✅ | Cookie `authjs.session-token`; admin ve selector de sucursal, operador menú reducido |
| PM-AUTH-2 Credenciales inválidas | ✅ | `role=alert` "Usuario o contraseña incorrectos."; usuario inexistente mismo mensaje (anti-enumeración) |
| PM-AUTH-3 Lockout | ❌ **D6** | 429 vía `error=Configuration` genérico; no bloquea password correcta |
| PM-AUTH-4 Rutas protegidas sin sesión | ✅ | `/ventas`, `/caja` (404 real, la ruta es `/ventas`), `/productos`, `/usuarios`, `/sucursales` → redirect `/login`; APIs → 401 JSON |
| PM-AUTH-5 `/` sin sesión | ✅ | 307 → `/pedido` (catálogo público) |
| PM-AUTH-6 Sesión corrupta en acción | ✅ | Token JWT adulterado → redirect login / 401 API |
| PM-AUTH-7 Sucursal eliminada | ✅ | API → 403 `{code:"BRANCH_REMOVED"}`; UI → 307 `/sesion-finalizada` |
| PM-AUTH-8 Backend caído en login | por código | `verifyCredentials` propaga error → `error=Configuration` (mismo problema de UX que D6) |
| PM-AUTH-9 Accesibilidad login | ✅ | Login completo por teclado; labels asociados, `role=alert` |

### 5.2 Panel / Resumen

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-PANEL-1 Dashboard real | ✅ | `/api/panel/resumen` → `orderCounts{pending:1,in_process:2,paid:0,finished:1,cancelled:8}`, `lowStockCount:6`, caja open — coincide con DB |
| PM-PANEL-2 Operador sin opciones admin | ✅ | Menú sin Productos/Sucursales/Usuarios/Videos; `/usuarios` etc. → redirect |
| PM-PANEL-3 Selector de sucursal | ✅ | Combobox "Sucursal activa"; cookie `activeBranchId` resuelve server-side por request |
| PM-PANEL-4/5/6/7 | parcial | Cierre remoto se refleja vía resumen (auto-cierre incl.); listas vacías/paginación OK; DB caída → `withApiErrorHandling` JSON 500 (código); responsive ✅ |

### 5.3 Caja

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-CAJA-1 Abrir feliz | ✅ | 201; `cash_registers` open, `initial_amount`, `opened_by` |
| PM-CAJA-2 Otra abierta | ✅ | 400 "Ya existe una caja abierta." |
| PM-CAJA-3 Monto inválido | ✅ | -50 / "abc" → 400 |
| PM-CAJA-4 Doble apertura concurrente | ✅ | 2 POST paralelos → 1×201 + 1×400; una sola caja abierta en DB |
| PM-CAJA-5 Cierre por dueño | ✅ | 200, `closed_by`, totales correctos, venta anulada excluida |
| PM-CAJA-6 Cierre por NO dueño | ✅ | Otro operador → 403 "Solo el usuario que abrió la caja o un administrador"; **admin cierra ajena → `forced_closed=true` + `forced_close_reason`** |
| PM-CAJA-7 Diferencias de conteo | ✅ | Esperado 7000, contado 6500 → `closing_difference=-500` persistido + notas |
| PM-CAJA-8 Doble cierre | ✅ | "No hay una caja abierta." / "La caja ya está cerrada." |
| PM-CAJA-9 Auto-cierre | ✅ | `opened_at`−2h → GET resumen cerró: `auto_closed`, `closed_by=Sistema` (riesgo #5: dispara en lecturas — comportamiento seguro verificado en COMB-6) |
| PM-CAJA-10 Avisos turnos | ✅ | b3 sin turno hoy → `estadoTurno.status:"fuera_de_horario"`, `alertaCaja{severity:"info"}`, `nextShiftStart` Lun 23:00Z |
| PM-CAJA-11 Avisos sin horarios | por código | `CAJA_OVERDUE_HOURS=12` (umbral) |
| PM-CAJA-12 Venta caja cerrada | ✅ | 400 "No hay una caja abierta. Abrí la caja para comenzar a vender." |
| PM-CAJA-13 Papelera | ✅ | DELETE → `deleted_at` (sin reintegro); GET `/eliminadas` lista; POST `/restaurar` → `deleted_at=null` |
| PM-CAJA-14 Borrado permanente | ✅ | `/permanente` → fila física eliminada + **stock reintegrado** (Pan 30→32, Salch 6→10) + `stock_movements`/venta eliminados en cascada. Diseño deliberado (riesgo #8 — documentado, anti-intuitivo) |
| PM-CAJA-15 Historial | ✅ | GET `/historial` con snapshot completo (totales, resúmenes de productos/insumos) |
| PM-CAJA-16 DB caída en cierre | por código | Transacción `executeInTransaction` + lock `lockCashRegisterById` |
| PM-CAJA-17 Responsive | parcial | Estructura semántica OK; sin h-scroll a 390px |

### 5.4 Ventas

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-VEN-1 Venta feliz | ✅ | Promo 1×2 $2000 cash → sale 1; Pan 32→30, Salch 10→6; `sale_items`, `sale_payments`, `sale_item_recipes` (snapshot), `stock_movements sale` |
| PM-VEN-2 Servicio sin stock | ✅ | Servicio 51 vendido sin consumir stock |
| PM-VEN-3 Campos inválidos | ✅ | qty 0 → 400; producto inexistente → 404; inactivo → 400 "no está activo"; producto de otra sucursal → 404 |
| PM-VEN-4 Pagos mixtos exactos | ✅ | cash 1200 + transfer 800 = 2000 → 201, dos filas `sale_payments` |
| PM-VEN-5 Pago insuficiente | ✅ | 1500<2000 → 400 "La suma de los pagos ($ 1.500) no coincide con el total ($ 2.000)." |
| PM-VEN-6 Pago excedente | ✅ | 2500>2000 → 400 mismo mensaje. **Sin vuelto implícito** (decisión: monto exacto) |
| PM-VEN-7 Pagos inválidos | ✅ | Dos partes mismo método → 400; método inválido → 400 |
| PM-VEN-8 Idempotencia | ✅ | Misma key → `deduplicated:true` misma venta; misma key + payload distinto → **409**; doble POST paralelo → una sola venta |
| PM-VEN-9 Stock insuficiente | ✅ | 409 "Stock insuficiente para Promo 1 (insumo: Salchichas). Disponible: 2, solicitado: 8." sin tocar stock |
| PM-VEN-10 Anular devuelve stock | ✅ | sale 2 → cancelled + `cancellation` +2/+4; Pan 28→30, Salch 2→6; excluida de totales de caja |
| PM-VEN-11 Anular con caja cerrada | ✅ | 400 "No se puede anular una venta de una caja cerrada o eliminada." |
| PM-VEN-12 Datos límite | parcial | `reason` con acentos llegó corrupta por encoding del shell de Windows (artifact del test, no de la app) |
| PM-VEN-13/14 | por código/parcial | Error handler JSON; responsive básico OK |

Nota opcionales de receta (cubre PM-REC-4): el servidor compara `selectedRecipeItemIds` contra **`supplyId`** y NO aplica `selectedByDefault` por sí solo (el cliente envía la selección resuelta). `[11]`→solo Mostaza, `[10,11]`→ambos, `[]`→ninguno. Opcionales sin `autoDiscount` no descuentan stock.

### 5.5 Pedidos (panel)

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-PED-1 Ciclo completo | ✅ | pending → `recibir` in_process → `confirmar` paid (sale creada) → `finalizar` finished |
| PM-PED-2 Recibir sin stock por reserva ajena | ✅ | 409 "Disponible: 2, solicitado: 14" — reservas descuentan del disponible |
| PM-PED-3 Recibir dos veces | ✅ | 400 "ya fue pagado, finalizado o cancelado"; finalizar no-pagado → 400 |
| PM-PED-4 Confirmar sin caja | ✅ | 400 (mensaje "horario de atención" — ver D10) |
| PM-PED-5 Cancelar desde panel | ✅ | cancelled + reservas liberadas; finished → 400 |
| PM-PED-6 IDOR operador | ✅ | op2(b2) → 404 en GET pedido/chat de b1 |
| PM-PED-7 Sin sesión | ✅ | 401 |
| PM-PED-8 Listado | ✅ | `?status=pending` filtra; paginación estándar |
| PM-PED-9 Expira mientras se mira | ✅ | created_at−2h → recibir → 409 "El pedido expiró por inactividad y fue cancelado." (lazy-expire atómico) |
| PM-PED-10 Responsive | parcial | — |

### 5.6 Catálogo y pedido público

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-CAT-1 Pedido feliz pickup | ✅ | 201, `orderNumber` con sufijo random, `cancellationToken`, `expiresAt`=+1h |
| PM-CAT-2 Validaciones checkout | ✅ | teléfono regex, nombre, items ≥1 (mensajes en español para reglas propias) |
| PM-CAT-3 Delivery sin dirección | ✅ | 400 "La dirección es obligatoria para envío a domicilio." |
| PM-CAT-4 Sucursal cerrada (sin caja) | ✅ | 400 "En este momento no podemos recibir pedidos." |
| PM-CAT-5 Sin stock a mitad de compra | ✅ | Error amigable `INSUFFICIENT_STOCK` sin revelar cantidades |
| PM-CAT-6 Fuera de horario con caja | ❌ **D2** | Pedido aceptado aunque `/estado` diga cerrada |
| PM-CAT-7 Rate limit | ✅ | `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` → 3.er POST 429 "Demasiados pedidos" |
| PM-CAT-8 Sin IP confiable | por código | prod sin proxy → `RateLimitConfigError` → 500 (fail-closed); dev → bucket `unknown` compartido |
| PM-CAT-9 Idempotencia cliente | ✅ | Mismo key → `deduplicated:true`; mismo key distinto payload → 409 |
| PM-CAT-10 Cancelar `pending` público | ✅ | token + reason ≥3 → cancelled; token malo → 400 |
| PM-CAT-11 Cancelar `in_process`/`paid` | ⚠️ **D5** | in_process → cancelled + reservas liberadas ✅; paid → **anula venta + reintegra** (decisión a confirmar) |
| PM-CAT-12 Expira cron/lazy | ✅ | Lazy en lectura verificado (seguimiento auto-cancela con razón "Expiración automática por inactividad"); cron endpoint existe con auth |
| PM-CAT-13 Cron sin auth | ✅ | 401 "No autorizado." (timing-safe); POST → 405 |
| PM-CAT-14 Catálogo por sucursal | ✅ | `?branchId=` filtra; sin param → default branch |
| PM-CAT-15 No expone privados | ✅ | Solo `availability` computado (min por receta; servicios `MAX_SAFE_INTEGER`); **sin campo `stock`** ni datos internos |
| PM-CAT-16 Límite/paginación | ✅ | `limit`/`offset` (máx 200); `includeAvailability` opcional |
| PM-CAT-17/18 | por código/parcial | Responsive ✅ (390px, sin h-scroll, alts, disabled correctos, estructura semántica) |

### 5.7 Seguimiento

| Caso | Resultado |
|---|---|
| PM-SEG-1 Feliz | ✅ orderNumber+nombre(+teléfono) → status; **devuelve `cancellationToken`** (necesario para cancelar — riesgo acotado: orderNumber no enumerable) |
| PM-SEG-2 Búsqueda inválida | ✅ nombre distinto → 404 genérico anti-enumeración |
| PM-SEG-3 Otra sucursal | ✅ orderNumber de b1 con `branchId=3` → 404 |
| PM-SEG-4 Rate limit | ✅ limiter `order-tracking` propio |
| PM-SEG-5 Pedido expirado | ✅ lazy-expire → devuelve `cancelled` |
| PM-SEG-6/7 | por código/parcial |

### 5.8 Chat

| Caso | Resultado |
|---|---|
| PM-CHAT-1 Conversación | ✅ client↔operator ambos sentidos; mensaje automático "Detalle de preparación" al crear pedido |
| PM-CHAT-2 Vacío/límite | ✅ vacío → 400 |
| PM-CHAT-3 Adjuntos | ✅ exe → 400 tipo; png → 201 `chat/4/…png`; serving: token pedido o sesión → 200 `private, no-store`; sin auth → 401; **op2 otra sucursal → 401**; traversal → 400 "Clave de adjunto inválida." |
| PM-CHAT-4 Paginación | por código (`limit`/`before`/`after` en query schema) |
| PM-CHAT-5 Token inválido | ✅ 404 "no encontrado" (anti-enumeración, no 403) |
| PM-CHAT-6 Cross-sucursal | ✅ op2 → 404 chat y pedido de b1 |
| PM-CHAT-7 Pedido cancelado | ✅ POST → 400 "finalizado o cancelado"; GET sigue legible |
| PM-CHAT-8 SSE | ✅ `text/event-stream`, `no-cache`, eventos `state`+`messages` con ids |
| PM-CHAT-9 Rate limit | por código (limiter `chat` + poll compartido) |
| PM-CHAT-10 Ubicación | no ejecutado (endpoint `/ubicacion` existe; requiere delivery con location) |
| PM-CHAT-11 Responsive | parcial |

### 5.9–5.11 Productos / Recetas / Stock

| Caso | Resultado |
|---|---|
| PM-PROD-1 CRUD por tipo | ✅ supply/compound/service creados (ids 127–130) |
| PM-PROD-2 Validaciones | ✅ editar/desactivar/reactivar OK; refine `criticalSupplyType` |
| PM-PROD-3 Cambio de tipo con receta | ✅ rechazado |
| PM-PROD-4 Imagen | no ejecutado (endpoint `/api/productos/imagen` existe) |
| PM-PROD-5/6 Papelera | ✅ guarda: insumo de promo activa no se elimina; soft→`/eliminadas`→restore (`deleted_at`→null, `is_active`→true); producto eliminado no se vende (404) |
| PM-PROD-7/8 Permisos | ✅ op2 POST productos → 403 |
| PM-REC-1/2 Receta feliz | ✅ items con qty/autoDiscount/opcional persistidos |
| PM-REC-3/5 Validaciones | ✅ qty inválida y receta en no-compound rechazadas |
| PM-REC-4 Snapshot | ✅ `sale_item_recipes` y `order_item_recipes` guardan supplyName/type/qty/flags |
| PM-REC-6 Operador | ✅ op2 POST receta → 403 |
| PM-REC-7 | por código |
| PM-STK-1 Ajuste/reposición | ✅ restock +20 aplicado |
| PM-STK-2 Negativo mayor al disponible | ✅ rechazado |
| PM-STK-3 Validaciones | ⚠️ **D8** type libre aceptado |
| PM-STK-4 Reserva vs venta | ✅ carrera serializada, sin oversell (COMB-2) |
| PM-STK-5 Movimientos | ✅ `?productId=` con paginación; tipos sale/cancellation/reserve/reserve_release correctos |
| PM-STK-6 Alerta stock bajo | ✅ `isLow` con stock=minStock |
| PM-STK-7 Permisos | ⚠️ **D9** ajuste no es admin-only |
| PM-STK-8/9 | parcial (serialización por tx verificada en carreras) |

### 5.12–5.14 Sucursales / Usuarios / Videos

| Caso | Resultado |
|---|---|
| PM-SUC-1 CRUD | ✅ alta con turno overnight 20:00–02:00 persistido |
| PM-SUC-2 Horarios | ✅ `validateOpeningHours` rechaza: dow=7, formato, open=close, duplicados, solapamiento mismo día, overnight vs día siguiente, domingo↔lunes |
| PM-SUC-3 Duplicado/location | ❌ **D7** duplicado case-variante; location inválida → 400 ✅ |
| PM-SUC-4 Contactos/redes | ✅ `normalizeSocialLinks` acepta handles/URLs/números; rechaza `javascript:`, malformadas, redes inválidas; atómico |
| PM-SUC-5 Solo admin | ✅ `requireAdmin` en actions; redirects verificados |
| PM-SUC-6 Confirmación tipeada | ✅ `confirmBranchName !== branch.name` → error (por código + UI) |
| PM-SUC-7 Timezone/estado | ✅ `isBranchOpen` overnight: abierto 20:00→01:59, cerrado 02:00; textos "Hoy de…"/"Lunes de…"; `/estado` sin horarios solo requiere caja |
| PM-SUC-8 Eliminar con datos | ✅ cascada: usuarios, 63 productos, cajas, movimientos → 0; limpieza best-effort de archivos + rate limits |
| PM-USU-1 Crear operador | ✅ bcrypt `$2b$10$` 60 chars, role operator, branch, login OK |
| PM-USU-2 No admin | ✅ `role:'operator'` hardcodeado en action + `ValidationError` en servicio |
| PM-USU-3 Validaciones | ✅ duplicado → "Ya existe un usuario con ese nombre."; password <6 → **bloqueo nativo `minLength`** (sin POST; bubble del browser); servicio valida igual |
| PM-USU-4 Editar | ✅ username/branch/password por servicio |
| PM-USU-5 Eliminar no revoca | ❌ **D3** confirmado |
| PM-USU-6 Reasignar no aplica | ❌ **D4** confirmado |
| PM-USU-7 Perfil password | ✅ por código: bcrypt actual + ≥6 + confirmación + `session.user.id` |
| PM-USU-8 Permisos | ✅ `requireAdmin` en las 3 actions |
| PM-VID-1/4/5/6 | ✅ upload local (`prepareUpload`→upload→`createVideo`); stream 200 `accept-ranges` + Range→206 `Content-Range`; soft→restore→permanente (borra archivo físico); op2 stream ajeno → 403; sin sesión → 401 |
| PM-VID-2/3 | por código (mime allowlist + max size + title requerido) |
| PM-VID-7/8/9 | riesgo #7 storage local = efímero en prod (solo warning) — **bloqueante para deploy** |

### 6. Combinados

| Caso | Resultado | Evidencia |
|---|---|---|
| PM-COMB-1 Cierre vs pedido entrante | ✅ por mecanismo | mismo path que COMB-3/6 |
| PM-COMB-2 Venta vs reserva | ✅ | paralelo: venta 201 / recibir 409 "Disponible: 0"; sin oversell |
| PM-COMB-3 Confirmar vs cierre | ✅ | cierre ganó → 400 "La caja fue cerrada mientras se procesaba la venta. Abrí una nueva caja"; pedido queda `in_process` reintentable |
| PM-COMB-4 Expira al recibir | ✅ | 409 "El pedido expiró por inactividad y fue cancelado." |
| PM-COMB-5 Cliente cancela vs operador | ✅ | cancelar ganó → confirmar 400 "El pedido fue cancelado."; sin venta fantasma (`converted_sale_id` null) |
| PM-COMB-6 Auto-cierre en venta | ✅ | venta aborta 400 limpio; caja `auto_closed`; sin venta parcial |
| PM-COMB-7 Dos pestañas | ✅ | 2 POST simultáneos misma key → una sola venta |
| PM-COMB-8 Cambio sucursal con formularios | por código | `activeBranchId` se resuelve por request → el submit opera en la sucursal activa al enviar (riesgo UX, no seguridad) |
| PM-COMB-9 Eliminar sucursal caliente | ✅ | SUC-8 + AUTH-7 |
| PM-COMB-10 Vaciar papelera vs stock | ✅ | reintegro deliberado (CAJA-14) |
| PM-COMB-11 Cancelar paid c/prod. eliminado | ❌ **D1** | 404 incancelable hasta restaurar |
| PM-COMB-12 Idempotencia cross-flujo | ✅ | misma key distinto payload → 409 en ventas y pedidos; namespaces separados por tabla |

---

## 3. Riesgos del informe original — veredicto

| # | Riesgo | Estado |
|---|---|---|
| 1 | Eliminar usuario no revoca JWT | **CONFIRMADO (D3)** |
| 2 | Reasignar sucursal no actualiza token | **CONFIRMADO (D4)** |
| 3 | Cancelación pública cancela `paid` | **CONFIRMADO (D5)** — decisión de negocio |
| 4 | Pagos exactos sin vuelto | Confirmado funcionando (VEN-5/6) — documentar en UI/capacitación |
| 5 | Pedidos con caja abierta fuera de horario | **CONFIRMADO (D2)** |
| 6 | Auto-cierre en lecturas | Confirmado — comportamiento **seguro** (aborta venta limpio, COMB-6) |
| 7 | Rate limit por IP confiable | Confirmado: `X-Forwarded-For` directo bypassa si el proxy no sanea; prod sin IP → 500 fail-closed |
| 8 | `STORAGE_PROVIDER=local` en prod | Confirmado — **bloquear deploy** hasta `vercel-blob`/`s3`/`r2` |
| 9 | Borrado permanente de caja reintegra stock | Confirmado funcionando — deliberado pero anti-intuitivo; documentar |
| 10 | Idempotencia por key+hash | Confirmado funcionando (dedup + 409) |

## 4. No ejecutados / no reproducibles en este entorno

- **Backend/DB caída** (AUTH-8, PANEL-6, VEN-13, SEG-6, CHAT parcial, USU-9, CAJA-16, CAT-17): no se puede cortar Neon por request en este setup. Por código: `withApiErrorHandling` → JSON 500 estructurado; login → `error=Configuration` (D6 cubre la UX).
- **PM-CHAT-10 ubicación de delivery**: requiere pedido `delivery` con `location` configurada en sucursal.
- **PM-PROD-4 imagen de producto**: endpoint existe; no se subió imagen real.
- **Crons end-to-end** (expire-orders, chat-attachments-cleanup, rate-limit-cleanup): autenticación verificada; ejecución real depende de GitHub Actions/Vercel Cron.
- **UI profunda de ventas/pedidos/caja en navegador**: el flujo se verificó por API+DB; las pantallas existen pero no se recorrió cada formulario visualmente. Responsive básico ✅ en login/catálogo/ventas.
- **Tests de accesibilidad axe** (`npm run test:accessibility`): no corridos; estructura semántica spot-check OK.
- **Entorno production-like** (`next start`, CSP, redirects de dominio, storage remoto, `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS`): requiere build/staging.

## 5. Recomendaciones antes de producción (prioridad)

1. **D1**: `includeDeleted:true` en `buildProductContext` de `cancelSale`/`cancelOrder` (o bloquear eliminación de productos con ventas activas).
2. **D2**: `createOrder` debe evaluar `isBranchOpen` además de caja abierta (o alinear el mensaje).
3. **D5**: decidir si la cancelación pública debe rechazar `paid` (sugerido: solo `pending`/`in_process` públicas; `paid` solo por panel).
4. **D3/D4**: revalidar usuario en `requireAuth` (o aceptar el riesgo y documentarlo) + refrescar `branchId` del token al detectar cambio.
5. **D6**: mapear el lockout a un error visible (página `/login` con mensaje) en vez de `error=Configuration`.
6. **D7**: usar `findByNameCaseInsensitive` también en `createBranch`.
7. **D8/D9**: restringir `stockAdjustmentSchema.type` a `manual_adjustment|restock` y evaluar `admin:true` en `/api/stock/ajustar`.
8. **Riesgo 7/8**: configurar proxy confiable real + `STORAGE_PROVIDER` remoto antes del deploy.
9. **D10**: i18n de mensajes Zod expuestos (o mapeo a español en el error handler) y mensaje de "horario" cuando la causa es caja.

## 6. Estado final del entorno

- Caja 10 **abierta** en b1; cajas 1–8 cerradas (1 eliminada permanentemente).
- Pedidos: 10 pending (expira), 8 in_process (con reservas 7 pan/14 salch), resto cancelled/finished.
- Sucursal Test (b2) **eliminada** en cascada; usuarios op2 y e2e-operator-segunda eliminados con ella.
- Productos de prueba persisten en b1 (127–131; 131 restaurado).
- Para re-ejecutar desde cero: `npx tsx .devin/tmp/setup.ts` (truncate + seed) — la base es descartable.
