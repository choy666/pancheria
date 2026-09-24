# Plan de pruebas manuales pre-producción — Panchería

**Estado:** abierto
**Fecha:** 2026-09-24
**Alcance:** relevamiento de código (solo lectura) + plan completo de pruebas manuales para ejecutar antes de exponer la app a producción.
**Stack auditado:** Next.js 16 (App Router) + Drizzle/PostgreSQL (Neon) + NextAuth v5 (JWT, Credentials) + SSE para chat + Vercel.

---

## 1. Resumen ejecutivo — riesgos principales del relevamiento

Hallazgos derivados de leer el código (no son defectos confirmados; son puntos que las pruebas deben verificar o decisiones a validar con el dueño):

1. **Eliminar/deshabilitar un usuario NO revoca su sesión en caliente.** `requireAuth` (`src/lib/auth.ts`) valida sesión JWT + existencia de la **sucursal**, pero nunca reconsulta la tabla `users`. Con estrategia `jwt` y sin `maxAge` configurado (default de NextAuth ≈ 30 días), un operador eliminado sigue operando hasta que expire su token. Mismo efecto al **reasignar un usuario a otra sucursal**: su JWT conserva el `branchId` viejo hasta re-login. → Casos PM-USU-5/6/7. Si el negocio exige revocación inmediata, hay que agregar revalidación de usuario o bajar el `maxAge` de sesión.

2. **La cancelación pública con token puede anular un pedido `paid`.** `cancelOrder` con `cancellationToken` válido acepta `pending`, `in_process` y `paid`; en `paid` anula la venta (`cancelSale`) y reintegra stock. Es un camino de dinero alcanzable sin autenticación, solo con el token de la URL del chat. → PM-CAT-10/11. Confirmar que sea la decisión de negocio (un cliente que ya pagó y cancela dispara una anulación real de venta y descuento de caja).

3. **Los pagos deben cuadrar EXACTOS.** `validatePaymentParts` rechaza suma menor **y mayor** al total — no existe concepto de vuelto. En mostrador, "me paga con $10.000 un pedido de $8.500" no se puede registrar tal cual; el operador debe cargar el monto exacto recibido. → PM-VEN-4/5/6. Verificar que la UI lo comunique claramente.

4. **El pedido público exige caja abierta, no horario.** `createOrder` solo valida `getOpenCashRegister`; **no** evalúa `openingHours`. Consecuencias en ambos sentidos:
   - Sucursal dentro de su horario pero **sin caja abierta** → el pedido se rechaza ("no podemos recibir pedidos"). La apertura de caja es la llave real del canal público.
   - Caja olvidada abierta **fuera de horario** (p. ej. turno overnight terminó a las 02:00 y son las 09:00) → el endpoint `/api/public/sucursal/estado` dice "cerrada" pero `POST /api/public/pedido` **acepta el pedido igual**. → PM-CAT-6.

5. **El auto-cierre de caja dispara en lecturas.** `getOpenCashRegister` cierra la caja si `openedAt + CAJA_AUTO_CLOSE_HOURS <= now`. Cualquier request que lo consulte (resumen, crear pedido, vender) puede cerrarla debajo del operador; una venta en tránsito aborta con "La caja fue cerrada mientras se procesaba la venta". → PM-CAJA-9 y PM-COMB-6.

6. **Rate limiting depende de la IP confiable.** En producción sin Vercel ni `TRUSTED_PROXY_IP_HEADER`/`PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS`, `getClientIp` falla cerrado → **500** en los endpoints públicos de escritura. En desarrollo el limiter está **bypasseado** por defecto: para probar el 429 hay que usar entorno tipo prod o `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`. → PM-CAT-8.

7. **`STORAGE_PROVIDER=local` en producción es efímero** (filesystem de Vercel se pierde entre deploys/instancias). El código solo loguea un warning. Antes de salir a producción confirmar `vercel-blob`/`s3`/`r2` o aceptar la pérdida de imágenes/adjuntos/videos. → PM-VID-8, PM-CHAT-9.

8. **Borrado permanente de caja reintegra stock de sus ventas activas** (por diseño: la caja y sus ventas desaparecen, el stock vuelve). Es correcto pero anti-intuitivo: eliminar historial **mueve el stock actual**. → PM-CAJA-13/14.

9. **Crons protegidos por `CRON_SECRET`** con comparación timing-safe; `expire-orders` corre por GitHub Actions cada 5 min y Vercel Cron cubre los cleanups diarios. Si el workflow está pausado, la expiración lazy en lectura cubre el caso, pero hay que verificar ambos caminos. → PM-CAT-13.

10. **Idempotencia por `idempotencyKey` + hash SHA-256** en ventas y pedidos: misma clave + mismo payload → `deduplicated`; misma clave + payload distinto → `409`. El doble-submit está cubierto en servidor, pero hay que verificar que la UI rote la clave cuando cambia el carrito. → PM-VEN-8, PM-CAT-9.

---

## 2. Mapa del sistema relevado

### Roles

| Rol | Acceso |
| --- | --- |
| `admin` | Todo + productos, recetas, usuarios, sucursales, videos, papeleras, cierre forzado de cajas ajenas, selector de sucursal activa (cookie `activeBranchId`). |
| `operator` | Ventas, ajustes de stock, caja propia (abrir/cerrar), pedidos (recibir/confirmar/finalizar/cancelar), chat operador, perfil. **No** puede: crear/editar productos, recetas, usuarios, sucursales, videos, ni tocar papeleras (APIs con `{ admin: true }`). |

Notas de auth:
- No hay `middleware.ts` clásico: `src/proxy.ts` (NextAuth) aplica CSP con nonce y redirecciones de sesión en páginas; las APIs se protegen con `withAuth`/`requireAuth`/`requireAdmin` por ruta.
- `POST /api/productos`, `PUT/DELETE /api/productos/[id]`, `GET/POST /api/recetas`, uploads de imagen/video, papeleras (`/api/caja/eliminadas`, `/api/productos/eliminadas`, `DELETE /api/caja/historial`), `DELETE /api/caja/[id]`, `restaurar` y `permanente` son **admin-only**. `GET /api/caja/[id]` (incluye eliminadas), ventas, stock, pedidos y caja abrir/cerrar son de cualquier usuario autenticado.
- `GET /api/pedidos?branchId=X`: operator que pide otra sucursal → 403; admin puede consultar cualquier sucursal explícita aunque su cookie diga otra.

### Estados y transiciones

**Caja (`cash_registers`):** `open` → `closed` (manual owner/admin-forzado, o automático en lectura). `closed` → papelera (`deletedAt`, solo admin) → restaurar o borrado permanente (admin). Una caja abierta no puede eliminarse. Índice único parcial: máx. 1 caja `open` por sucursal.

**Pedido (`orders`):** `pending` → `in_process` (recibir + reserva stock) → `paid` (confirmar pago: libera reserva, descuenta stock, crea venta) → `finished` (entregado). Cancelable desde `pending`/`in_process`/`paid` → `cancelled`. `pending` expira a los `ORDER_EXPIRATION_MS` (default 1 h): cancelación lazy al leer + cron `expire-orders`. Transiciones inválidas: recibir/confirmar/finalizar fuera de estado, cancelar `finished`, operar sobre pedido `cancelled`.

**Venta (`sales`):** `active` → `cancelled` (anular; solo si su caja sigue `open`). Requiere caja abierta para crearse. Pagos (`sale_payments`): ≥1 parte, métodos `cash`/`transfer` sin repetir, cada monto > 0, suma **exacta** al total.

**Producto (`products`):** `isActive` on/off; `deletedAt` (papelera admin) → restaurar / borrado permanente (bloqueado si tiene ventas/pedidos/movimientos). Tipos: `critical_supply` (bread/sausage/beverage), `compound`, `manual_supply` (precio 0, sin descuento automático), `service` (sin stock). Vendibles al público: `compound`, `service`, `critical_supply` tipo `beverage`.

**Mensaje de chat (`order_messages`):** `deliveredAt` al listar del lado contrario, `readAt` al marcar leído. No se puede enviar en pedido `finished`/`cancelled` ni en `pending` expirado.

**Usuario (`users`):** solo se crean `operator`; el admin inicial no se edita ni elimina. Borrado físico (sin `deletedAt`).

**Sucursal (`branches`):** `openingHours` JSONB con turnos overnight (`close < open`); borrado físico en cascada con confirmación por nombre tipeado.

### Lockout y rate limits

| Control | Alcance | Default |
| --- | --- | --- |
| Login | `login_attempts` por username | 5 intentos / 15 min |
| `POST /api/public/pedido` | IP (store DB en prod) | 10 req / 60 s |
| `POST /api/public/pedido/[id]/cancelar` | IP (scope `order-cancellation`) | 10 / 60 s |
| `POST /api/public/pedido/seguimiento` | IP (scope `order-tracking`) | 10 / 60 s |
| `POST /api/public/pedido/[id]/chat` + upload | IP (scope `chat`) | 60 / 60 s |
| Polls públicos (chat GET/stream, estado, disponibilidad) | IP en memoria | 240 / 60 s |
| `POST /api/pedidos/[id]/chat/ubicacion` | branchId | 5 / 60 s |

### Crons

- `GET /api/cron/expire-orders` — GitHub Actions `*/5 * * * *`; cancela `pending` vencidos; `Authorization: Bearer ${CRON_SECRET}`.
- `GET /api/cron/chat-attachments-cleanup` — Vercel `0 0 * * *`; borra adjuntos/imágenes/videos huérfanos + purga opt-in de mensajes (`ORDER_MESSAGES_RETENTION_DAYS`).
- `GET /api/cron/rate-limit-cleanup` — Vercel `0 0 * * *`; limpia `public_order_rate_limits` y `login_attempts` viejos.
- Sin `Authorization` válido → 401 en los tres.

---

## 3. Entorno de pruebas y convenciones

**Precondiciones globales (válidas para todos los casos):**
- Entorno descartable (staging o local con base `*_test`/`*_e2e`), seed ejecutado (`npx tsx src/db/seeds.ts`): sucursal por defecto + admin, y segunda sucursal con su operador (`NEW_BRANCH_*`).
- Dos navegadores/perfiles: uno admin, uno operador; y una ventana de incógnito para flujos públicos.
- Acceso a la base para verificación (Neon console o `psql`). Queries útiles por caso se indican como "Verificar en DB".
- DevTools para: modo offline, throttling, viewport móvil (360×800) y emulación de teclado.
- Variables a alternar según el caso: `CAJA_AUTO_CLOSE_HOURS`, `ORDER_EXPIRATION_MS` (bajar a `120000` para pruebas de expiración), `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true` + `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` (para 429 rápido), `NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`, `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS`, `STORAGE_PROVIDER`.
- La moneda se ingresa en formato es-AR (`.` miles, `,` decimales; pagos en pesos enteros).
- Datos de prueba sugeridos: insumos `Pan` (bread), `Salchicha` (sausage), `Gaseosa` (beverage), `Papa` (manual_supply, precio 0), promo `Pancho completo` (compound con 1 pan + 1 salchicha + papa opcional), servicio `Envoltorio premium` (service).

**Códigos de estado esperados:** 400 validación/Zod, 401 sin sesión, 403 sin permiso/rol o sucursal ajena, 404 inexistente/ajeno, 409 conflicto (stock insuficiente, pedido expirado, idempotencia divergente), 429 rate limit, 503 DB caída, 500 genérico sin filtrar internals.

**Prioridades:** P0 = bloquea producción (dinero, stock, pedidos, auth); P1 = importante; P2 = secundario/UX.

---

## 4. Matriz de cobertura

| Módulo | Flujo feliz | Validaciones | Permisos/IDOR | Transiciones | Datos límite | Falla backend | Resp./A11y |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Auth | AUTH-1 | AUTH-2/3 | AUTH-4/5/6 | AUTH-7 | — | AUTH-8 | AUTH-9 |
| Panel/Resumen | PANEL-1 | — | PANEL-2/3 | PANEL-4 | PANEL-5 | PANEL-6 | PANEL-7 |
| Caja | CAJA-1 | CAJA-2/3 | CAJA-5/6/7 | CAJA-4/8 | CAJA-15 | CAJA-16 | CAJA-17 |
| Ventas | VEN-1 | VEN-3/4/5/6/7 | VEN-10/11 | VEN-8/9 | VEN-12 | VEN-13 | VEN-14 |
| Pedidos (panel) | PED-1 | PED-4 | PED-6/7 | PED-2/3/5 | PED-8 | PED-9 | PED-10 |
| Catálogo + Pedido público | CAT-1 | CAT-2/3/4/5 | CAT-14/15 | CAT-6/9/11/12 | CAT-7/16 | CAT-17 | CAT-18 |
| Seguimiento | SEG-1 | SEG-2/3 | SEG-4 | SEG-5 | — | SEG-6 | SEG-7 |
| Chat | CHAT-1 | CHAT-2/3 | CHAT-5/6 | CHAT-7/8 | CHAT-4 | CHAT-10 | CHAT-11 |
| Productos | PROD-1 | PROD-2/3/4 | PROD-7/8 | PROD-5/6 | PROD-9 | PROD-10 | PROD-11 |
| Recetas | REC-1 | REC-2/3/4 | REC-6 | REC-5 | — | REC-7 | — |
| Stock | STK-1 | STK-2/3/4 | STK-6/7 | — | STK-5 | STK-8 | STK-9 |
| Sucursales | SUC-1 | SUC-2/3 | SUC-5/6 | SUC-7 | SUC-4 | SUC-8 | — |
| Usuarios | USU-1 | USU-2/3 | USU-4/5/6/7 | USU-8 | — | USU-9 | — |
| Videos | VID-1 | VID-2/3 | VID-5/6 | VID-4 | VID-7 | VID-8 | VID-9 |
| Combinados | — | — | — | COMB-1..10 | — | — | — |

---

## 5. Casos por módulo

### 5.1 Auth

**PM-AUTH-1 — Login admin y operador (P0)**
- Precondiciones: seed con `ADMIN_USERNAME`/`ADMIN_PASSWORD` y un operador de sucursal 2.
- Pasos: 1) Ir a `/login`. 2) Ingresar admin + password válidos → submit. 3) Cerrar sesión desde el header. 4) Repetir con operador.
- Esperado (UI): admin entra a `/` con selector de sucursal visible; operador entra a `/` sin selector, con su sucursal fija; logout vuelve a `/login`.
- Esperado (DB): `login_attempts` del usuario queda limpio tras login exitoso (`count` reseteado/fila eliminada).

**PM-AUTH-2 — Credenciales inválidas (P0)**
- Pasos: 1) Login con usuario inexistente. 2) Usuario válido + password incorrecta. 3) Campos vacíos.
- Esperado (UI): mensaje genérico "Usuario o contraseña incorrectos" en los 3 casos (sin distinguir usuario inexistente vs password).
- Esperado (DB): `login_attempts.count` crece por cada fallo del mismo username.

**PM-AUTH-3 — Lockout por intentos repetidos (P0)**
- Datos: `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5`, ventana 15 min (defaults).
- Pasos: 1) Fallar login 5 veces seguidas con el mismo username. 2) Intentar una 6.ª con password **correcta**. 3) Verificar que un usuario **distinto** desde la misma IP sí puede entrar.
- Esperado (UI): a partir del 5.º intento el login **no** entra aunque las credenciales sean correctas; el bloqueo se muestra como error (el `ValidationError` "Demasiados intentos fallidos. Probá más tarde." se lanza dentro de `authorize` de NextAuth: verificar cómo llega a la UI — mensaje inline o `?error=` en la URL — y que nunca sea un 500 crudo ni un stack). Otro usuario no queda bloqueado (el lockout es por username, no por IP).
- Esperado (DB): `login_attempts` muestra `count >= 5` y `last_attempt` reciente; el bloqueo expira pasada la ventana (o al borrar la fila para re-test).

**PM-AUTH-4 — Rutas protegidas sin sesión (P0)**
- Pasos: en incógnito, GET directo a `/`, `/ventas`, `/cierre`, `/productos`, `/usuarios`, `/api/ventas` (POST con JSON válido), `/api/caja/resumen`.
- Esperado (UI): páginas redirigen a `/login`; APIs responden 401 JSON, sin HTML de login.
- Esperado (DB): ninguna escritura.

**PM-AUTH-5 — `/` sin sesión va al catálogo público (P1)**
- Pasos: incógnito → `GET /`.
- Esperado: redirect a `/pedido` (el catálogo es la home pública), no a `/login`.

**PM-AUTH-6 — Sesión expirada en medio de una acción (P0)**
- Pasos: 1) Login operador, abrir `/ventas`. 2) Invalidar la cookie (borrarla en DevTools, o esperar expiración configurando `maxAge` corto). 3) Confirmar una venta.
- Esperado (UI): la acción devuelve 401 y la UI muestra error/lleva a login; no queda spinner infinito ni venta fantasma.
- Esperado (DB): no se creó `sales` ni `stock_movements`.

**PM-AUTH-7 — Sucursal eliminada → `sesion-finalizada` (P0)**
- Precondiciones: operador logueado en sucursal B; admin elimina sucursal B desde otra sesión.
- Pasos: 1) Con la sesión del operador viva, navegar a `/`. 2) Observar `/sesion-finalizada`. 3) La página debe cerrar la sesión y terminar en `/login?error=branch_removed`. 4) Intentar `POST /api/ventas` con la cookie vieja → 403 con `code` de sucursal removida.
- Esperado (UI): no hay loop login→panel→login; el usuario termina deslogueado.
- Esperado (DB): la sucursal y sus datos ya no existen; ninguna escritura con `branchId` huérfano.

**PM-AUTH-8 — Backend caído en login (P1)**
- Pasos: simular DB caída (pausar Neon / cortar red) → intentar login.
- Esperado (UI): error genérico sin stack ni internals; el intento no queda registrado inconsistentemente.

**PM-AUTH-9 — Accesibilidad del login (P2)**
- Pasos: completar y enviar el formulario solo con teclado (Tab/Enter); provocar error y verificar foco/lectura del mensaje (lector o `aria-live`); verificar labels asociados a inputs.
- Esperado: todo alcanzable por teclado, error anunciado.

### 5.2 Panel / Resumen

**PM-PANEL-1 — Dashboard refleja estado real (P1)**
- Pasos: 1) Con caja cerrada: abrir `/` → caja "cerrada", contadores de pedidos, alertas de stock. 2) Abrir caja y vender → esperar refresco (30 s default) o recargar → totales actualizados. 3) Dejar stock bajo (`stock <= minStock`) → la alerta lo refleja.
- Esperado (DB): `/api/panel/resumen` devuelve `cashRegister`, `lowStockCount`, `orderCounts` consistentes con las tablas.

**PM-PANEL-2 — Operador no ve opciones de admin (P0)**
- Pasos: como operador, recorrer `/` y el header: no deben aparecer Productos/Usuarios/Sucursales/Videos ni el selector de sucursal; intentar GET directo a `/usuarios`, `/sucursales`, `/productos`, `/videos` → redirect a `/`.
- Esperado (UI): sin accesos ni páginas admin para operador.

**PM-PANEL-3 — Selector de sucursal del admin (P0)**
- Pasos: admin → cambiar sucursal activa → verificar que `/api/panel/resumen`, `/ventas`, `/pedidos` operan sobre la sucursal elegida; recargar → persiste (cookie `activeBranchId`); elegir sucursal inexistente vía acción directa → error controlado.
- Esperado (DB): cookie `activeBranchId` con el id elegido; lecturas/escrituras caen en esa sucursal.

**PM-PANEL-4 — Caja cerrada por otro lado se refleja (P1)**
- Pasos: dos pestañas admin; en una cerrar la caja desde `/cierre`; en la otra esperar refresco del panel → debe pasar a "cerrada" sin acciones inconsistentes.

**PM-PANEL-5 — Listas vacías y muchos datos (P2)**
- Pasos: sucursal nueva sin productos/pedidos/ventas → panel muestra ceros sin errores ni NaN; con muchos pedidos → contadores correctos.

**PM-PANEL-6 — Resumen con DB caída (P1)**
- Pasos: cortar DB → recargar `/` → la página degrada con error visible (no pantalla blanca); restaurar → vuelve a funcionar.

**PM-PANEL-7 — Responsive y teclado (P2)**
- Pasos: viewport 360×800 → header, tarjetas y navegación usables; navegación por teclado del menú y tour.

### 5.3 Caja

**PM-CAJA-1 — Abrir caja feliz (P0)**
- Pasos: 1) `/cierre` → "Abrir caja" con monto inicial `1500`. 2) Verificar resumen en `/api/caja/resumen` y panel.
- Esperado (UI): caja `open`, `initialAmount` 1500, `cashInDrawer` = 1500, totales en 0.
- Esperado (DB): `cash_registers` fila `open`, `opened_by` = username, única `open` de la sucursal.

**PM-CAJA-2 — Abrir con otra caja ya abierta (P0)**
- Pasos: con caja abierta → intentar abrir de nuevo (UI y `POST /api/caja/abrir` directo).
- Esperado (UI): error "Ya existe una caja abierta." Sin segunda fila `open`.
- Esperado (DB): sigue habiendo exactamente 1 `open` por sucursal (el índice único parcial lo garantiza).

**PM-CAJA-3 — Monto inicial inválido (P1)**
- Pasos: abrir con `initialAmount` negativo / texto / vacío.
- Esperado: 400 o validación en UI; nunca crea caja con monto negativo.

**PM-CAJA-4 — Doble apertura concurrente (P0)**
- Pasos: dos pestañas (o dos usuarios de la misma sucursal) → "Abrir caja" casi simultáneo.
- Esperado: una gana (201), la otra recibe "Ya existe una caja abierta" (400); DB con 1 sola `open`.

**PM-CAJA-5 — Cierre por el dueño (P0)**
- Precondiciones: caja abierta por `op1` con 2 ventas (1 cash, 1 mixed).
- Pasos: `/cierre` → "Cerrar caja" → ingresar efectivo contado exacto + notas.
- Esperado (UI): caja `closed`, `closingDifference = 0`, resumen persistido.
- Esperado (DB): `closed_at`, `closed_by = op1`, totales congelados; `products_summary`/`critical_supplies_summary`/`recipe_supplies_summary` poblados.

**PM-CAJA-6 — Cierre por NO dueño (P0)**
- Pasos: caja de `op1`; `op2` (operador distinto, misma sucursal) intenta cerrarla → debe fallar con "Solo el usuario que abrió la caja o un administrador pueden cerrarla" (403). Luego `admin` la cierra → éxito, marcada `forced_closed` y `forced_close_reason` si se cargó.
- Esperado (DB): solo el cierre admin queda persistido con flag `forced_closed = true`.

**PM-CAJA-7 — Cierre con diferencias de conteo (P0)**
- Pasos: cerrar caja declarando efectivo contado menor y luego (otra caja) mayor al esperado; también con `closingTransferCount`.
- Esperado (DB): `closing_difference`/`closing_transfer_difference` con signo correcto; UI los muestra con signo explícito (+/−), no solo color.

**PM-CAJA-8 — Doble cierre / cerrar ya cerrada (P0)**
- Pasos: cerrar dos veces la misma caja (doble click rápido + request repetido).
- Esperado: segundo intento → "La caja ya está cerrada." Totales no se recalculan ni duplican.

**PM-CAJA-9 — Auto-cierre por horas (P0)**
- Datos: `CAJA_AUTO_CLOSE_HOURS=1` (o mínimo viable), reiniciar server.
- Pasos: abrir caja, esperar > 1 h (o mover `opened_at` en DB), luego cualquier lectura (`GET /api/caja/resumen`, `/api/panel/resumen`, o intentar vender).
- Esperado (UI): la caja aparece `closed`, `auto_closed = true`, `closed_by` = `Sistema` (o `CAJA_AUTO_CLOSED_BY`); intentar vender muestra "No hay una caja abierta".
- Esperado (DB): la fila quedó cerrada con resumen calculado.

**PM-CAJA-10 — Avisos por turnos: `fuera_de_horario` y `cierre_recomendado` (P0)**
- Datos: sucursal con horarios Lun–Vie `20:00–02:00` (overnight).
- Pasos: 1) Abrir caja 21:00 → `en_turno`, sin aviso. 2) Consultar a las 03:00 (mover `opened_at`/reloj) → `fuera_de_horario` (info) con `proximoTurno`. 3) Consultar al día siguiente 20:30 → `cierre_recomendado` (warning). 4) Repetir con apertura **en hueco** (p. ej. 15:00) → al llegar el primer turno posterior el aviso es `cierre_recomendado`.
- Esperado (UI): badges/banners correctos en `/cierre`, `/ventas` y panel; ninguno bloquea operar.
- Esperado (DB): payload de `/api/caja/resumen` con `estadoTurno`/`alertaCaja` calculados en servidor.

**PM-CAJA-11 — Avisos sin horarios configurados (P1)**
- Datos: sucursal sin `opening_hours`.
- Pasos: caja abierta hace > `CAJA_OVERDUE_HOURS` (12 h default) → aviso `excedida`; `opened_at` de un día anterior → aviso `dia_anterior` con `diasAbierta`.
- Esperado: fallback legacy funciona; `estadoTurno = sin_horarios`.

**PM-CAJA-12 — Venta con caja cerrada (P0)**
- Pasos: sin caja abierta → `POST /api/ventas` y checkout del terminal.
- Esperado (UI): "No hay una caja abierta. Abrí la caja para comenzar a vender." Sin venta ni movimientos.

**PM-CAJA-13 — Papelera: eliminar caja cerrada y restaurar (P1)**
- Pasos: admin → historial `/ventas/historial` → eliminar caja `closed` → va a `/ventas/historial/eliminadas` → restaurar.
- Esperado (DB): `deleted_at` se setea y se limpia al restaurar; la caja vuelve al historial.
- Caso borde: intentar eliminar caja `open` → "No se puede eliminar una caja abierta."

**PM-CAJA-14 — Borrado permanente reintegra stock (P0)**
- Precondiciones: caja cerrada con ventas activas que descontaron insumos (promo consumió pan+salchicha); stock actual anotado. Caja en papelera.
- Pasos: papelera → "Eliminar permanentemente" (o `DELETE /api/caja/eliminadas` para vaciar).
- Esperado (DB): la caja y sus `sales` desaparecen; `stock_movements` con `cancellation` "Eliminación de caja #N" por cada venta activa; `products.stock` aumentó en lo consumido. Ventas ya anuladas NO duplican reintegro.
- Riesgo a confirmar: es anti-intuitivo (borrar historial modifica stock actual) — verificar que el negocio lo acepta.

**PM-CAJA-15 — Historial: rangos, paginación y estado (P1)**
- Pasos: `GET /api/caja/historial` con `start`/`end`/`status=open|closed`, `page`/`limit`; más de `limit` cajas → paginar; rango sin resultados → lista vacía; `start` inválido → comportamiento controlado (default 30 días).
- Esperado: filtrado por `opened_at` en rango; conteos consistentes.

**PM-CAJA-16 — Falla de DB en medio del cierre (P1)**
- Pasos: cortar conexión a DB justo al confirmar cierre (throttling/offline) → reintentar.
- Esperado: error visible, caja queda `open` (rollback completo) o `closed` consistente — nunca mitad (status cerrado sin resumen, o viceversa).

**PM-CAJA-17 — Responsive caja/cierre (P2)**
- Pasos: flujo abrir/cerrar en 360×800; diálogo de conteo usable con teclado; banner de aviso legible.

### 5.4 Ventas

**PM-VEN-1 — Venta feliz de promo + bebida (P0)**
- Datos: promo `Pancho completo` (1 pan, 1 salchicha, papa opcional), `Gaseosa` beverage, stock suficiente; caja abierta.
- Pasos: `/ventas` → agregar promo (elegir opcionales en `PromoOptionsDialog`) + 2 gaseosas → pago `cash` exacto → confirmar.
- Esperado (UI): total correcto, confirmación, stock visible baja.
- Esperado (DB): `sales` + `sale_items` + `sale_payments` + `sale_item_recipes` (snapshot con `selected`); `products.stock` bajó en pan/salchicha/gaseosa, NO en `Papa` (manual no descuenta); `stock_movements` tipo `sale`; `cash_registers.total/cashTotal/totalSales` incrementados.

**PM-VEN-2 — Venta de servicio sin stock (P1)**
- Pasos: vender `Envoltorio premium` (service) solo.
- Esperado: venta OK, disponibilidad infinita, ningún movimiento de stock.

**PM-VEN-3 — Campos del carrito inválidos (P0)**
- Pasos: cantidad 0 / negativa / no entera; productId inexistente o de otra sucursal (forzar request); producto inactivo o `manual_supply` en el carrito.
- Esperado: 400/404 con mensaje; el servidor rechaza `manual_supply` y pan/salchicha sueltos (no vendibles); sin escrituras.

**PM-VEN-4 — Pagos mixtos exactos (P0)**
- Pasos: venta de $10.000 → pagos `cash 6000` + `transfer 4000`.
- Esperado (DB): dos `sale_payments`; `cashTotal +6000`, `transferTotal +4000`, `paymentMethod` de la venta = primero cargado.

**PM-VEN-5 — Pago insuficiente (P0)**
- Pasos: total $10.000 → `cash 9000` → confirmar.
- Esperado (UI): "La suma de los pagos ($9.000) no coincide con el total ($10.000)"; sin venta.

**PM-VEN-6 — Pago excedente / vuelto (P0)**
- Pasos: total $8.500 → `cash 10000`.
- Esperado: **rechazado** (la suma debe ser exacta). Confirmar con negocio: el terminal no calcula vuelto; el operador debe cargar el monto exacto a registrar.

**PM-VEN-7 — Pagos inválidos varios (P1)**
- Pasos: dos partes con el mismo método (`cash`+`cash`); monto 0 o negativo; array vacío; método inexistente.
- Esperado: 400 con mensajes claros ("No puede haber más de una parte por medio de pago", "Cada monto debe ser mayor a 0", "Debe haber al menos un medio de pago").

**PM-VEN-8 — Doble submit / idempotencia (P0)**
- Pasos: confirmar venta con doble click rápido; reintentar el **mismo** request con la misma `idempotencyKey`; reintentar misma clave con carrito **distinto**.
- Esperado: una sola venta (`deduplicated: true` en el reintento); misma clave + payload distinto → 409. Verificar que la UI rota la clave al cambiar el carrito.

**PM-VEN-9 — Stock insuficiente al confirmar (P0)**
- Datos: stock Pan=1; carrito pide 2 promos (cada una 1 pan).
- Pasos: confirmar → 409 "stock insuficiente" con el insumo faltante; verificar que no quedó venta parcial ni stock negativo.
- Esperado (DB): `products.stock` intacto, sin `sales`, sin `stock_movements`.

**PM-VEN-10 — Anular venta devuelve stock y descuenta caja (P0)**
- Pasos: historial/detalle de venta → anular con motivo → verificar `/ventas`, stock y resumen de caja.
- Esperado (DB): `sales.status=cancelled`, `cancellation_reason`; `stock_movements` tipo `cancellation` (+cantidad); `cash_registers` resta total/medios/totalSales; stock de insumos restaurado según snapshot.
- Casos: anular venta ya anulada → idempotente (devuelve la venta, no duplica reintegro); motivo < 3 chars → 400.

**PM-VEN-11 — Anular venta con caja cerrada (P0)**
- Pasos: vender, cerrar la caja, intentar anular la venta.
- Esperado: 400 "No se puede anular una venta de una caja cerrada o eliminada."; stock y caja intactos.

**PM-VEN-12 — Datos límite (P1)**
- Pasos: carrito con cantidad grande (p. ej. 500 unidades si stock lo permite, o rechazo si no); precio con decimales es-AR (`1.234,56`); muchas líneas de productos distintos; venta con catálogo vacío (sin productos vendibles → terminal lo indica).

**PM-VEN-13 — Backend caído durante checkout (P1)**
- Pasos: offline al confirmar → la UI muestra error, el carrito no se pierde, al reintentar con la misma clave no hay duplicados.

**PM-VEN-14 — Responsive terminal (P1)**
- Pasos: operar `/ventas` en móvil: catálogo, carrito, `PromoOptionsDialog`, selector de pago — todo usable táctil y por teclado.

### 5.5 Pedidos (panel)

**PM-PED-1 — Ciclo completo pending → in_process → paid → finished (P0)**
- Precondiciones: pedido público creado (CAT-1), caja abierta.
- Pasos: `/pedidos` → abrir pedido → "Recibir y reservar" → "Confirmar pago" (cash exacto) → "Finalizar".
- Esperado (DB): tras recibir: `status=in_process`, `order_stock_reservations` con insumos de la promo + bebidas, `stock_movements` `reserve` (−qty). Tras confirmar: `status=paid`, `converted_sale_id` apunta a `sales` nueva, reservas borradas + movimientos `reserve_release` (+qty) y `sale` (−qty), stock descontado **una sola vez**. Tras finalizar: `status=finished`, sin más movimientos.

**PM-PED-2 — Recibir con stock insuficiente por reserva ajena (P0)**
- Datos: Pan stock=2; pedido A recibido (reservó 2 panes); pedido B pide 1 pan.
- Pasos: recibir B → 409 con shortage; B sigue `pending`, sin reservas propias.

**PM-PED-3 — Recibir dos veces / ya no pending (P0)**
- Pasos: recibir pedido `in_process` → idempotente (devuelve el pedido). Recibir pedido `paid`/`cancelled`/`finished` → 400.

**PM-PED-4 — Confirmar pedido sin caja abierta (P0)**
- Pasos: pedido `in_process` + caja cerrada → confirmar → "En este momento no podemos confirmar el pedido. Horario de atención: …". El pedido queda `in_process` con su reserva intacta.

**PM-PED-5 — Cancelar desde el panel en cada estado (P0)**
- Pasos: cancelar pedido `pending` (sin stock tocado), `in_process` (libera reservas: `reserve_release`), `paid` (anula la venta → `cancellation` + reintegro de stock), `finished` → 400 "ya fue finalizado".
- Esperado (DB): `status=cancelled`, `cancelled_at`, `cancellation_reason` ≥ 3 chars (motivo requerido en panel).

**PM-PED-6 — IDOR: operador de otra sucursal (P0)**
- Pasos: operador sucursal B → `GET /api/pedidos/[id-de-A]`, `POST .../recibir|confirmar|finalizar|cancelar`, `GET /api/pedidos?branchId=A`.
- Esperado: 404 (pedido ajeno se resuelve scoped por `branchId` de sesión) y 403 en el listado con `branchId` ajeno. Sin lectura ni escritura cross-sucursal.

**PM-PED-7 — Pedidos sin sesión (P0)**
- Pasos: incógnito → `GET /api/pedidos`, `POST /api/pedidos/1/recibir` → 401.

**PM-PED-8 — Listado: filtros, búsqueda, paginación, unreadCount (P1)**
- Pasos: `/api/pedidos?status=` cada estado + `all`; `search` por nombre/teléfono/número; `page`/`limit` con >1 página; badge de no leídos tras mensaje del cliente.
- Esperado: filtro por sucursal de sesión; `unreadCount` correcto; paginación estable.

**PM-PED-9 — Pedido expira mientras el operador lo mira (P0)**
- Datos: `ORDER_EXPIRATION_MS` corto (2 min).
- Pasos: pedido `pending` vence → abrir detalle/listado → debe aparecer `cancelled` (expiración lazy). Intentar "Recibir" sobre uno vencido aún no barrido → 409 "El pedido expiró por inactividad y fue cancelado." y queda `cancelled`.
- Esperado (DB): `cancelled_at` + razón "Expiración automática por inactividad".

**PM-PED-10 — Responsive detalle de pedido (P2)**
- Pasos: detalle en móvil: items con snapshot de receta, acciones, chat embebido; navegable por teclado.

### 5.6 Catálogo y pedido público

**PM-CAT-1 — Pedido público feliz, pickup (P0)**
- Precondiciones: caja abierta de la sucursal default.
- Pasos: incógnito → `/pedido` → (redirect a `?branchId=`) → agregar promo con opcionales + gaseosa → nombre, teléfono `+54911...`, `pickup` → confirmar.
- Esperado (UI): resumen del pedido con insumos incluidos/quitados, link al chat con token, mensaje "Sistema" con detalle de preparación; `expiresAt` ~1 h.
- Esperado (DB): `orders` `pending` con `cancellation_token` único e `idempotency_key = "branchId:key"`; `order_items` + `order_item_recipes`; `order_messages` con el snapshot; **sin** `stock_movements` ni reservas; carrito localStorage limpiado.

**PM-CAT-2 — Validaciones del checkout (P0)**
- Pasos: enviar con nombre vacío; teléfono inválido (`abc`, 3 dígitos, 20 dígitos); `delivery` sin dirección; notas > 1000 chars; `items` vacío; `idempotencyKey` vacía.
- Esperado: 400 con mensajes claros; `delivery` exige `address`; pedido no se crea.

**PM-CAT-3 — Delivery requiere dirección (P0)**
- Pasos: `deliveryType=delivery` sin `address` vs `pickup` sin `address`.
- Esperado: delivery → 400 "La dirección es obligatoria para envío a domicilio."; pickup → OK.

**PM-CAT-4 — Sucursal cerrada (sin caja) rechaza pedidos (P0)**
- Pasos: sin caja abierta → confirmar pedido → "En este momento no podemos recibir pedidos. Horario de atención: …" (400). El carrito permanece editable.
- Con horario configurado y caja cerrada: mismo rechazo aunque la hora esté dentro del turno.

**PM-CAT-5 — Producto sin stock / deshabilitado a mitad de compra (P0)**
- Pasos: 1) Armar carrito con promo que necesita el último pan; en otra sesión agotar el pan. 2) Confirmar → 409 `INSUFFICIENT_STOCK` con mensaje amigable (sin exponer stock exacto ni nombre de insumo). 3) Deshabilitar (`isActive=false`) el producto en el panel y confirmar → 400 "no está disponible para el pedido". 4) Recargar catálogo → el producto ya no figura/muestra sin disponibilidad.
- Esperado (DB): sin `orders`; stock intacto.

**PM-CAT-6 — Pedido fuera de horario con caja abierta (P1)**
- Datos: sucursal con horario `20:00–02:00`; caja olvidada abierta; son las 10:00.
- Pasos: `GET /api/public/sucursal/estado` → `isOpen=false`; `POST /api/public/pedido` → **el pedido se crea igual** (createOrder solo exige caja).
- Esperado: documentar comportamiento — si el negocio quiere rechazar fuera de horario, hay un gap. Si es intencional (operador decide al dejar caja abierta), verificar que la UI pública avisa la sucursal cerrada antes de pagar/pedir.

**PM-CAT-7 — Rate limit de pedidos (429) (P0)**
- Datos: `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` (o probar en deploy real).
- Pasos: 3+ `POST /api/public/pedido` desde la misma IP en < 60 s → 429 "Demasiados pedidos. Intentalo más tarde." El pedido válido dentro del límite se crea; tras la ventana vuelve a aceptar.
- Esperado (DB): `public_order_rate_limits` fila por `(scope='order', ip)` con `count` creciente; store `db` en producción.

**PM-CAT-8 — Sin IP confiable en producción (P1)**
- Datos: entorno prod-like sin `x-vercel-forwarded-for` ni `TRUSTED_PROXY_IP_HEADER` ni opt-in.
- Pasos: `POST /api/public/pedido` → 500 genérico (fail-closed); el error detallado solo en logs. Confirmar que en Vercel real funciona con `x-vercel-forwarded-for`.

**PM-CAT-9 — Idempotencia y doble submit del cliente (P0)**
- Pasos: confirmar pedido con doble click; reintentar mismo `idempotencyKey`+payload → `deduplicated: true`, mismo pedido; misma clave con datos distintos → 409.
- Esperado (DB): una sola `orders` por clave; `idempotency_hash` guardado y no expuesto en la respuesta.

**PM-CAT-10 — Cancelación pública de `pending` (P0)**
- Pasos: desde el diálogo del pedido/seguimiento, cancelar con token → `cancelled`; el token inválido → 400 "El token de cancelación no es válido."; sin token → 400.
- Esperado (DB): `cancelled_at` + razón; como era `pending`, sin movimientos de stock.

**PM-CAT-11 — Cancelación pública de `in_process` y `paid` (P0)**
- Pasos: pedido `in_process` (con reserva) → cancelar con token → reservas liberadas (`reserve_release`). Pedido `paid` → cancelar con token → venta anulada, stock reintegrado, caja descontada.
- Esperado: confirmar decisión de negocio (cliente puede anular venta ya cobrada solo con el link). `finished` → 400.

**PM-CAT-12 — Pedido expira por cron y por lazy (P0)**
- Datos: `ORDER_EXPIRATION_MS=120000`.
- Pasos: crear pedido, esperar > 2 min sin tocar nada → `GET /api/cron/expire-orders` con bearer → `expired >= 1` y pedido `cancelled`. Caso lazy: crear otro, esperar, luego consultar seguimiento/detalle → se cancela en la lectura.
- Esperado (DB): razón "Expiración automática por inactividad"; `in_process` NO expira.

**PM-CAT-13 — Cron sin autorización (P1)**
- Pasos: `GET /api/cron/expire-orders` sin header / con token malo → 401; con `CRON_SECRET` válido → `{ ok: true, expired: n }`. Ídem `rate-limit-cleanup` y `chat-attachments-cleanup`.

**PM-CAT-14 — Catálogo por sucursal y cambio de sucursal (P1)**
- Pasos: `/pedido?branchId=B` → catálogo de B con sus precios/stock; cambiar de sucursal en el selector → carrito se limpia (`localStorage` queda asociado por branch); `branchId` inexistente → error controlado; `/pedido` sin param → redirect a sucursal default.

**PM-CAT-15 — Catálogo no expone datos privados (P1)**
- Pasos: inspeccionar payload de `/api/public/catalogo` → solo productos vendibles activos, sin `deletedAt`, sin stock interno de insumos (la `availability` calculada está bien; no debe venir `stock` crudo de pan/salchicha ni datos de otras sucursales).

**PM-CAT-16 — Catálogo límite (P1)**
- Pasos: sucursal sin productos vendibles → mensaje de vacío; > `NEXT_PUBLIC_CATALOG_PAGE_SIZE` (48) → "Cargar más" pagina sin duplicados; producto sin imagen → placeholder; texto larguísimo en nombre → layout no se rompe.
- Cache: headers `s-maxage`/`swr` presentes; un producto recién deshabilitado puede seguir visible ~10 s — verificar que el checkout igual lo rechaza.

**PM-CAT-17 — Falla backend en checkout público (P1)**
- Pasos: offline al confirmar → error visible, carrito persistido en `localStorage`; reintento no duplica.

**PM-CAT-18 — Responsive/a11y catálogo (P0)**
- Pasos: flujo completo de pedido en 360×800 real o emulado: selector de sucursal, `PromoOptionsDialog` (checkboxes con teclado), formulario, resumen; contraste de estados ("Cerrado ahora · Abre…"); navegación por teclado completa.
- Esperado: todo operable sin mouse; el estado abierto/cerrado no depende solo del color.

### 5.7 Seguimiento

**PM-SEG-1 — Seguimiento feliz (P0)**
- Pasos: `/pedido/seguimiento` → número de pedido + nombre (o teléfono) del cliente → estado actual.
- Esperado (UI): muestra estado, total, sucursal; si `pending`, incluye `expiresAt` y permite cancelar (usa el `cancellationToken` que devuelve solo en `pending`).
- Esperado (DB): lookup por `(branchId, orderNumber)` — el número no es globalmente único.

**PM-SEG-2 — Búsqueda inválida (P0)**
- Pasos: número inexistente; número sin nombre ni teléfono; nombre que no coincide; teléfono con formato inválido.
- Esperado: 404 "No se encontró el pedido" sin distinguir qué campo falló (anti-enumeración); 400 si faltan ambos datos de contacto.

**PM-SEG-3 — Pedido de otra sucursal (P0)**
- Pasos: buscar `orderNumber` de sucursal B pasando `branchId=A` (y sin `branchId` estando default A) → no debe encontrarlo.
- Esperado: 404; el scope por sucursal evita enumerar pedidos ajenos con el mismo número.

**PM-SEG-4 — Rate limit de seguimiento (P1)**
- Pasos: >10 consultas/min por IP → 429.

**PM-SEG-5 — Seguimiento de pedido expirado (P1)**
- Pasos: consultar un `pending` ya vencido → se cancela lazy y se muestra `cancelled`, sin `cancellationToken` ni `expiresAt`.

**PM-SEG-6 — Backend caído (P2)**
- Pasos: DB caída → error controlado, sin stack en pantalla.

**PM-SEG-7 — Responsive (P2)**
- Pasos: formulario + resultado en móvil; verificar que no quedó estática rota en build (`force-dynamic`, lección QA ronda 2: probar en `next start`/producción real, no solo dev).

### 5.8 Chat

**PM-CHAT-1 — Conversación feliz en ambos sentidos (P0)**
- Precondiciones: pedido `pending`/`in_process` con link `?token=`; operador en `/pedidos/[id]`.
- Pasos: cliente envía texto → operador lo ve (poll ~5 s o SSE) y responde → cliente lo recibe; verificar `delivered_at`/`read_at` al marcar leído.
- Esperado (DB): `order_messages` con `sender_type` correcto, `sender_name` = nombre del operador / null en cliente; `deliveredAt` al listar del otro lado; `readAt` tras `POST .../chat/leido`.

**PM-CHAT-2 — Mensaje vacío y límite de texto (P1)**
- Pasos: enviar vacío → 400 "El mensaje no puede estar vacío."; texto > `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` (1000 default) → UI corta/valida; por API, se trunca al máximo (verificar que no explota ni corta a mitad de emoji).

**PM-CHAT-3 — Adjuntos: imagen válida, grande y formato inválido (P0)**
- Pasos: 1) PNG/JPEG/WEBP ≤ 5 MB → se envía y muestra. 2) > 5 MB → "El archivo excede el tamaño máximo permitido." 3) `.pdf`/`.exe`/`.svg` con MIME distinto → "El tipo de archivo no está permitido." 4) Adjunto + texto juntos → ambos se guardan. 5) Upload que falla al crear el mensaje (pedido cancelado en el medio) → el archivo huérfano se borra (lado público hace `deleteChatAttachment` en el catch).
- Esperado (DB): `attachment_url/key/mime/size/name` poblados; archivo servido por `/api/chat/attachment/[key]` con `Cache-Control: private, no-store`.

**PM-CHAT-4 — Paginación del historial (P2)**
- Pasos: > `NEXT_PUBLIC_CHAT_PAGE_SIZE` (50) mensajes → cargar anteriores con `before`; `before`+`after` juntos → 400.

**PM-CHAT-5 — Token inválido / IDOR público (P0)**
- Pasos: `GET/POST /api/public/pedido/[id]/chat?token=mal` → 404; token de otro pedido → 404; pedido de otra sucursal con token correcto → funciona solo con su token (el token es la llave); adjunto ajeno sin token → 401; con sesión de operador de otra sucursal → 401.
- Esperado: sin fugas de mensajes ni adjuntos.

**PM-CHAT-6 — Chat operador cross-sucursal (P0)**
- Pasos: operador B → `GET/POST /api/pedidos/[id-de-A]/chat` → 404; upload idem.

**PM-CHAT-7 — Chatear en pedido cancelado/finalizado/expirado (P0)**
- Pasos: enviar mensaje (cliente y operador) en pedido `cancelled`, `finished`, o `pending` expirado → "El pedido está finalizado o cancelado..." / "...expiró..." (400). Listar mensajes sigue funcionando (solo lectura).

**PM-CHAT-8 — SSE: reconexión y fallback (P1)**
- Datos: `NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`.
- Pasos: 1) Abrir chat → `EventSource` a `.../chat/stream`; verificar `heartbeat` cada ~15 s y cierre al `budget` (~55 s) con reconexión automática por `Last-Event-ID` sin perder mensajes. 2) Cortar red → el cliente vuelve a polling o reconecta; al volver, mensajes no duplicados ni perdidos. 3) Pedido borrado/inaccesible a mitad del stream → la conexión se cierra.
- Esperado: mensajes nuevos llegan por stream o por polling de respaldo; sin espiral de reconexiones ni errores en consola.

**PM-CHAT-9 — Rate limit de chat y de adjuntos (P1)**
- Pasos: >60 POST/min públicos → 429; polls GET frecuentes → veto 429 del limiter en memoria. Operador spammeando `ubicacion` → >5/min por sucursal → 429.

**PM-CHAT-10 — Ubicación: cliente delivery y operador pickup (P1)**
- Pasos: 1) Pedido `delivery`: cliente comparte ubicación (geolocation) → mensaje con link de mapas válido. 2) Pedido `pickup`: operador "enviar ubicación de sucursal" → mensaje con `branch.location`; en pedido `delivery` el botón operador → 400 "solo puede compartirse en pedidos de retiro"; sucursal sin `location` → 400.
- Esperado: validación de URL/coords (`isValidLocationUrl`); rate limit por sucursal.

**PM-CHAT-11 — Responsive chat (P1)**
- Pasos: chat completo en móvil (cliente real): input, adjuntos, scroll, badges; teclado en panel.

### 5.9 Productos

**PM-PROD-1 — CRUD feliz de cada tipo (P0)**
- Pasos: admin crea `critical_supply` (con tipo), `compound`, `manual_supply` (precio 0), `service` → aparecen en `/productos` agrupados por tipo; editar precio/nombre; desactivar (`isActive`); reactivar.
- Esperado (DB): `stock` siempre nace en 0; `compound`/`service` tienen `minStock=0`; el stock solo cambia por movimientos/ajustes, no por el formulario.

**PM-PROD-2 — Validaciones de formulario (P0)**
- Pasos: nombre vacío/>255; precio negativo; `critical_supply` sin `criticalSupplyType`; `criticalSupplyType` en un no-crítico; `manual_supply` con precio > 0; `unit` vacía; imagen URL no-https o dominio no permitido.
- Esperado: errores de campo claros (Zod → 400 en API / mensaje en form); sin creación.

**PM-PROD-3 — Cambio de tipo bloqueado por receta (P1)**
- Pasos: insumo que es parte de una promo activa → intentar cambiar su `type` → "No se puede cambiar el tipo porque el producto está usado en una receta." Cambiar tipo de `compound` con receta → se borra su receta (`recipes` cascade) — verificar que la UI avisa.

**PM-PROD-4 — Imagen de producto (P1)**
- Pasos: subir PNG ≤ 5 MB vía `imagen/preparar` + `upload` (local) o flujo remoto; tipo inválido (`.gif`, `.pdf`) → rechazo; > `NEXT_PUBLIC_PRODUCT_IMAGE_MAX_SIZE_MB` → rechazo; URL externa https de dominio permitido → acepta; dominio no listado → rechazo.
- Esperado (DB): `image_key/mime/size` guardados; imagen servida por `/api/productos/imagen/[key]?branchId=` solo si el producto es vendible público — producto dado de baja → su imagen 404 en el endpoint público.

**PM-PROD-5 — Soft delete y papelera (P0)**
- Pasos: eliminar producto sin referencias → `deletedAt`; en `/productos/eliminados` restaurar → vuelve activo. Eliminar insumo usado en promo activa → "No se puede eliminar ... porque forma parte de la promo activa ...". Eliminar permanente un producto con ventas/pedidos/movimientos → "tiene ventas, pedidos o movimientos asociados"; sin referencias → se borra y su imagen también.
- Esperado (DB): `deleted_at` set/unset; hard delete solo sin referencias.

**PM-PROD-6 — Producto eliminado/inactivo no vendible (P0)**
- Pasos: con producto inactivo o en papelera → intentar vender/pedir por API → 400 "no está activo" / "no está disponible"; no aparece en `/api/public/catalogo` ni en el terminal.

**PM-PROD-7 — Operador no puede gestionar productos (P0)**
- Pasos: operador → `POST /api/productos`, `PUT/DELETE /api/productos/[id]`, uploads de imagen, `GET /api/productos/eliminadas`, `GET /api/productos/[id]` → todos 403. Página `/productos` → redirect.
- Esperado: solo lectura de catálogo de venta para operador (vía disponibilidad/terminal), nunca CRUD.

**PM-PROD-8 — IDOR producto ajeno (P0)**
- Pasos: admin con sucursal activa A → `PUT/DELETE /api/productos/[id-de-B]` → 404 (scoped por branch); `GET` igual.

**PM-PROD-9 — Límite: muchos productos y nombres largos (P2)**
- Pasos: >200 productos → paginación `?page&limit` en API/listado; nombre de 255 chars → layout; caracteres especiales/emoji en nombre → se guardan y muestran sanitizados.

**PM-PROD-10 — Falla backend (P2)**
- Pasos: DB caída al crear → error controlado; storage caído al subir imagen → error sin dejar registro inconsistente (verificar que `image_key` no queda apuntando a archivo inexistente).

**PM-PROD-11 — Responsive formulario (P2)**
- Pasos: alta/edición en móvil; validación por teclado de todos los campos y el selector de tipo.

### 5.10 Recetas

**PM-REC-1 — Guardar receta feliz (P0)**
- Pasos: admin edita promo → receta: Pan×1 (autoDiscount, obligatorio), Salchicha×1 (autoDiscount), Papa×1 (opcional, selectedByDefault), Envoltorio (service, opcional no-default) → guardar.
- Esperado (DB): `recipes` por `compound_product_id`; disponibilidad de la promo = min(stock pan/1, stock salchicha/1).

**PM-REC-2 — Invariantes de insumos (P0)**
- Pasos: receta sin insumo crítico con `autoDiscount` → 400; duplicar el mismo insumo → 400; incluir al propio compuesto → 400; `manual_supply`/`service` con `autoDiscount=true` → 400; crítico con `isOptional=true` o `selectedByDefault=true` → 400; opcional con `selectedByDefault` pero `isOptional=false` → 400.
- Esperado: cada regla de `recipeSchema` rechaza con mensaje claro.

**PM-REC-3 — Cantidades inválidas (P1)**
- Pasos: `quantity` 0 / negativa / decimal / texto → 400.

**PM-REC-4 — Editar receta cambia disponibilidad y snapshot futuro (P1)**
- Pasos: promo vendida → cambiar receta (otra cantidad de salchicha) → nueva venta → el snapshot `sale_item_recipes` refleja la receta nueva; la venta vieja conserva su snapshot histórico.

**PM-REC-5 — Receta de producto no-compound (P1)**
- Pasos: `POST /api/recetas` con `compoundProductId` de un `service`/`critical_supply` → comportamiento (acepta y no afecta ventas, o rechaza — documentar el elegido; hoy el servicio guarda si el schema pasa, verificar qué hace `saveRecipe`).

**PM-REC-6 — Operador no puede tocar recetas (P0)**
- Pasos: operador → `GET/POST /api/recetas` → 403.

**PM-REC-7 — Falla backend (P2)**
- Pasos: DB caída al guardar → error; la receta anterior no queda a medias (el save borra e inserta: verificar transaccionalidad — si falla a mitad, no debe quedar receta vacía).

### 5.11 Stock

**PM-STK-1 — Ajuste y reposición felices (P0)**
- Pasos: `/stock` → ajuste `restock` +50 con motivo → ajuste `manual_adjustment` −10 con motivo.
- Esperado (DB): `products.stock` actualizado; `stock_movements` con tipo, cantidad con signo, `reason`, `branchId`.

**PM-STK-2 — Ajuste negativo mayor al disponible (P0)**
- Pasos: stock=5 → ajuste −10 → "El ajuste dejaría el stock de X en negativo."; stock queda en 5. Ajuste que deja exactamente 0 → OK (el check es `>= 0`).

**PM-STK-3 — Validaciones (P1)**
- Pasos: motivo < 3 chars / > 500 → 400; `quantity=0` → "no puede ser cero"; `type` inválido (p. ej. `sale` manual) → 400; producto inexistente/ajeno → 404.

**PM-STK-4 — Reserva vs venta directa compitiendo (P0)**
- Datos: Pan stock=2.
- Pasos: 1) Pedido A `in_process` reserva 2 panes. 2) En terminal, intentar vender promo que consume 1 pan → debe rechazar por disponibilidad (la reserva descuenta del disponible lógico). 3) Cancelar el pedido → disponibilidad vuelve.
- Esperado (DB): `order_stock_reservations` + `stock_movements reserve/reserve_release`; `products.stock` físico solo cambia al confirmar venta.

**PM-STK-5 — Movimientos: historial y paginación (P1)**
- Pasos: `GET /api/stock/movimientos?productId=` con >1 página → orden y `hasMore`; `productId` inválido/ajeno → 400/404; producto sin movimientos → vacío.

**PM-STK-6 — Alertas de stock bajo (P1)**
- Pasos: `stock <= minStock` (con `minStock>0`) → aparece en `/api/stock` y cuenta en panel; `manual_supply` también alerta aunque no se descuente automático; `compound`/`service` no aparecen.

**PM-STK-7 — Permisos (P1)**
- Pasos: sin sesión → 401 en `GET /api/stock` y `POST /ajustar`. Operador sí puede ajustar (es su función). Operador B ajustando producto de A por API → 404.

**PM-STK-8 — Concurrencia de ajustes (P1)**
- Pasos: dos operadores ajustan el mismo producto casi a la vez → ambos movimientos se registran y el stock final es consistente (lock por fila); ajuste que en carrera dejaría negativo → uno falla.

**PM-STK-9 — Responsive (P2)**
- Pasos: lista + formulario de ajuste en móvil; input numérico usable.

### 5.12 Sucursales

**PM-SUC-1 — CRUD feliz (P0)**
- Pasos: admin crea sucursal con nombre, dirección, teléfonos, redes (instagram/whatsapp), `location` (coords `lat,lng` o URL embed), horarios `20:00–02:00` → aparece en `/sucursales`, selector del admin, `/api/public/sucursal/estado` la expone.

**PM-SUC-2 — Validaciones de horarios (P0)**
- Pasos: `dayOfWeek` fuera de 0-6; `open`/`close` mal formateados; `open == close`; dos franjas del mismo día solapadas; overnight que se cruza con la franja del día siguiente; duplicado exacto.
- Esperado: 400 con mensaje por regla; overnight válido se acepta.

**PM-SUC-3 — Nombre duplicado y location inválida (P1)**
- Pasos: crear/editar con nombre existente (mismo y distinto case) → 400; `location` con texto libre que no es URL ni coordenadas → 400; short link `maps.app.goo.gl` → se acepta como link pero no embede (verificar comportamiento documentado).

**PM-SUC-4 — Contactos y redes (P1)**
- Pasos: `phones` con etiqueta+número; `social_links` con handle vs URL vs número de whatsapp; red inválida; JSON malformado.
- Esperado: normalización a URL donde corresponde; inválidos rechazados/omitidos controladamente; se ven en `/pedido` (tarjeta de sucursal) y encabezado del chat.

**PM-SUC-5 — Solo admin (P0)**
- Pasos: operador → `/sucursales` redirect; server actions `createBranch/updateBranchAction/deleteBranchAction` → 403.

**PM-SUC-6 — Eliminar sucursal con confirmación tipeada (P0)**
- Pasos: 1) Eliminar escribiendo nombre incorrecto → error. 2) Correcto → resumen de impacto (productos, ventas, pedidos, usuarios…) y borrado.
- Esperado (DB): cascada completa (ver §2); imágenes/adjuntos/videos eliminados del storage o reintentados por el cron. Irreversible: confirmar que el resumen lo comunica.

**PM-SUC-7 — Timezone y estado público (P0)**
- Datos: `NEXT_PUBLIC_BRANCH_TIMEZONE=America/Argentina/Buenos_Aires` y alternativamente otra tz.
- Pasos: turno `20:00–02:00`: consultar `/api/public/sucursal/estado` a las 21:00 (caja abierta) → `isOpen=true` con `currentOpening`; a las 03:00 → `isOpen=false` con `nextOpening`; sin caja abierta aunque en horario → `isOpen=false`. Sin horarios + caja abierta → `isOpen=true`.
- Esperado: cálculo en la tz de sucursal, no la del server; headers de cache presentes pero sin servir estado viejo mucho tiempo.

**PM-SUC-8 — Eliminar sucursal con datos calientes (P0)**
- Pasos: sucursal con caja abierta, pedidos `in_process` y operador logueado → eliminarla.
- Esperado (DB): todo en cascada; operador de esa sucursal → `sesion-finalizada` en su próxima navegación (PM-AUTH-7); pedidos públicos de esa sucursal dejan de resolver (404 en seguimiento/chat con token).

### 5.13 Usuarios

**PM-USU-1 — Crear operador feliz (P0)**
- Pasos: admin → `/usuarios` → crear `op2` con password ≥6 y sucursal → login con ese usuario → entra a su sucursal.
- Esperado (DB): `users` con `password_hash` bcrypt (nunca plano), `role=operator`, `branch_id` correcto.

**PM-USU-2 — No se puede crear otro admin (P0)**
- Pasos: intentar `createUser` con `role=admin` (vía request forzado, el form no lo expone) → "Solo se permiten usuarios operador." Confirmar que el único admin es el del seed.

**PM-USU-3 — Validaciones (P1)**
- Pasos: username vacío/duplicado; password < 6; sin sucursal / sucursal inexistente.
- Esperado: errores por campo; duplicado → "Ya existe un usuario con ese nombre."

**PM-USU-4 — Editar operador (P1)**
- Pasos: cambiar username (único), reasignar sucursal, cambiar password → login con password vieja falla, nueva funciona. Editar al admin inicial → "No se puede editar el administrador inicial."

**PM-USU-5 — Eliminar usuario NO revoca su sesión (P0 — riesgo)**
- Pasos: operador `op2` logueado y usando la app; admin lo elimina en otra sesión; `op2` sigue navegando y **vende** (`POST /api/ventas`).
- Esperado (según código): la sesión JWT sigue válida hasta expirar (≈30 días default) porque `requireAuth` no reconsulta `users`; solo la sucursal se revalida. → **Verificar y decidir**: si es inaceptable, marcar como defecto P0 (agregar revalidación de usuario o `maxAge` corto). Verificar también que `login_attempts` del usuario eliminado se limpió.

**PM-USU-6 — Reasignar sucursal no se aplica en caliente (P0 — riesgo)**
- Pasos: `op2` logueado en B; admin lo mueve a C; `op2` sigue operando en B (JWT tiene `branchId` viejo) hasta re-login.
- Esperado (según código): opera en B hasta que su sesión expire o reingrese. → Decidir si es aceptable; si no, mismo tratamiento que USU-5.

**PM-USU-7 — Perfil: cambiar propia contraseña (P1)**
- Pasos: `/perfil` → password actual incorrecta → error; nueva < 6 → error; confirmación distinta → error; feliz → success y login posterior con la nueva.
- Esperado (DB): hash actualizado; sesión actual sigue (JWT no lleva password).

**PM-USU-8 — Permisos y IDOR (P0)**
- Pasos: operador → `/usuarios` redirect y server actions 403; `deleteUser`/`updateUser` sobre el admin → 400; eliminar usuario inexistente → 404.

**PM-USU-9 — Backend caído (P2)**
- Pasos: DB caída al crear/editar → error controlado sin filas a medias.

### 5.14 Videos

**PM-VID-1 — Subir y listar feliz (P1)**
- Datos: `STORAGE_PROVIDER` según entorno (local → `POST /api/videos/upload` con `key`+file; remoto → `prepareUploadAction` + subida al proveedor).
- Pasos: admin → `/videos/nuevo` → mp4/webm ≤ 100 MB → `createVideoAction` → aparece en `/videos`, `isActive` toggleable, detalle `/videos/[id]` con stream.
- Esperado (DB): `videos` con `file_url`, `mime_type`, `size`, `branch_id`.

**PM-VID-2 — Validaciones de metadata (P1)**
- Pasos: título vacío/>255; `fileUrl` no-URL; `mimeType` vacío; `size` negativo; descripción > 1000.
- Esperado: 400 por campo.

**PM-VID-3 — Upload: tipo y tamaño (P1)**
- Pasos: `video/mp4`, `video/webm`, `video/ogg` → OK; `.mov`/`image/*`/`.exe` → "tipo de archivo no está permitido"; > `NEXT_PUBLIC_VIDEO_MAX_SIZE_MB` → rechazo; `key` malformada en modo local → 400.

**PM-VID-4 — Papelera de videos (P1)**
- Pasos: desactivar → no se lista en reproducción; eliminar → `deletedAt` y va a `/videos/eliminados`; restaurar → vuelve; eliminar permanente → borra archivo del storage (`deleteVideoFileByUrl`).

**PM-VID-5 — Solo admin (P0)**
- Pasos: operador → `/videos` redirect; `upload`, actions y `GET /api/videos/[id]/stream` → 403.

**PM-VID-6 — Stream con Range (P2)**
- Pasos: `GET /api/videos/[id]/stream` sin `Range` → 200 completo con `Accept-Ranges`; `Range: bytes=0-1023` → 206 con `Content-Range`; rango inválido/fuera de tamaño → 416; video inexistente → 404. En proveedor remoto → redirect a URL pública.

**PM-VID-7 — Límite (P2)**
- Pasos: lista con >1 página; video con título larguísimo; reproducción de un archivo grande (throttling) → streaming progresivo sin cargar todo en memoria.

**PM-VID-8 — Storage local en producción (P1 — riesgo)**
- Pasos: verificar `STORAGE_PROVIDER` del entorno productivo ≠ `local`; si es `local`, los archivos desaparecen entre deploys — decidir provider remoto antes de producción o aceptar la pérdida.

**PM-VID-9 — Responsive (P2)**
- Pasos: lista y player en móvil; controles del `<video>` accesibles.

---

## 6. Checklist ejecutable ordenado por dependencias

Orden sugerido de ejecución (cada bloque habilita al siguiente). Marcar `[ ]` por caso.

**Fase 0 — Setup**
1. Seed + entorno: base descartable, `ADMIN_*`, operador de 2.ª sucursal, `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`, `NEXT_PUBLIC_CHAT_STREAM_ENABLED=true`, `ORDER_EXPIRATION_MS` corto para las pruebas de expiración.
2. PM-AUTH-1/2/4/5 (login, protección básica).

**Fase 1 — Datos maestros (admin)**
3. PM-SUC-1/2/3/7 (sucursal con horarios incl. overnight).
4. PM-PROD-1/2 (crear insumos y promo) + PM-REC-1/2 (receta de la promo).
5. PM-STK-1/2/6 (cargar stock, alertas).
6. PM-USU-1/2/3 (crear operadores).

**Fase 2 — Caja y ventas**
7. PM-CAJA-1/2/3/4 (apertura).
8. PM-VEN-1..9 (ventas, pagos, stock insuficiente).
9. PM-VEN-10/11 (anulación) → PM-CAJA-5/6/7/8 (cierres).
10. PM-CAJA-9/10/11 (auto-cierre y avisos, con env/reloj).

**Fase 3 — Pedidos públicos y panel**
11. PM-CAT-1..5 (crear pedido, validaciones) → PM-SEG-1/2/3 (seguimiento).
12. PM-PED-1..5 (ciclo completo + cancelaciones).
13. PM-CAT-10/11 (cancelación pública) + PM-PED-9 / PM-CAT-12 (expiración).
14. PM-CAT-7/9 (rate limit, idempotencia).
15. PM-CHAT-1..11 (chat completo).

**Fase 4 — Permisos, IDOR y papelera**
16. PM-PANEL-2/3, PM-PED-6/7, PM-PROD-7/8, PM-STK-7, PM-CHAT-5/6, PM-USU-4/8.
17. PM-CAJA-13/14/15, PM-PROD-5/6, PM-VID-4 (papeleras).
18. PM-SUC-5/6/8 (borrado de sucursal — hacer al final por destructivo), PM-USU-5/6/7 (riesgos de sesión), PM-AUTH-7 (sesión-finalizada).

**Fase 5 — Robustez y UX**
19. Fallas backend por módulo (offline/DB caída).
20. Responsive móvil completo del flujo: `/pedido` → chat → seguimiento, y panel en móvil.
21. Casos combinados §7.
22. Crons y producción-like: PM-CAT-8/13, PM-VID-8, CSP/redirects en `next start` o staging.

---

## 7. Escenarios combinados de alto riesgo

**PM-COMB-1 — Cierre de caja mientras entra un pedido público con el último stock (P0)**
- Setup: Pan stock=1, promo requiere 1 pan, caja abierta.
- Pasos: cliente confirma pedido (queda `pending`) ~al mismo tiempo que el operador cierra la caja.
- Esperado: el pedido se crea solo si la caja seguía abierta al momento del POST; si el cierre ganó la carrera → 400 "no podemos recibir pedidos". Luego, "Recibir" el pedido exige stock disponible pero **no** caja; "Confirmar pago" exige caja abierta → con caja cerrada falla y el pedido queda `in_process` con reserva. Sin estados intermedios corruptos.

**PM-COMB-2 — Venta directa vs reserva de pedido por el mismo stock (P0)**
- Setup: Pan stock=1. Pedido A pide promo (1 pan).
- Pasos: A) recibir pedido (reserva el pan) → intentar vender la promo en terminal → rechazo por disponibilidad. B) al revés: vender la promo primero → recibir el pedido → 409 por shortage.
- Esperado: quien toma el stock primero gana; el perdedor recibe error claro sin escrituras parciales.

**PM-COMB-3 — Confirmar pedido mientras se cierra la caja (P0)**
- Pasos: operador confirma pago de pedido `in_process` en el instante en que otro usuario cierra la caja.
- Esperado: una de dos: la venta entra antes del cierre (caja la incluye en su resumen) o el confirm falla con "La caja fue cerrada mientras se procesaba la venta" y el pedido queda `in_process` con su reserva intacta (rollback completo, sin venta huérfana ni stock descontado a medias).

**PM-COMB-4 — Pedido expira mientras el operador lo recibe/confirma (P0)**
- Setup: `ORDER_EXPIRATION_MS` corto; pedido `pending` a punto de vencer.
- Pasos: operador clickea "Recibir" cuando ya venció pero el cron aún no barrió → 409 "expiró por inactividad"; el pedido queda `cancelled`. Ídem "Confirmar" sobre `pending` vencido.
- Esperado: ninguna acción resucita un pedido vencido; la cancelación lazy se confirma fuera de la transacción abortada.

**PM-COMB-5 — Cliente cancela mientras el operador procesa (P0)**
- Pasos: pedido `in_process`; cliente cancela con token en el instante en que el operador confirma pago.
- Esperado: el lock por fila define un ganador: o el pedido queda `cancelled` (reserva liberada, sin venta) o queda `paid` (venta creada) — nunca `paid` sin venta ni `cancelled` con venta activa. Re-verificar stock y resumen de caja en ambos resultados.

**PM-COMB-6 — Auto-cierre dispara en medio de una venta (P0)**
- Setup: `CAJA_AUTO_CLOSE_HOURS` chico; caja a minutos del umbral.
- Pasos: operador arma venta; entre el `GET /api/caja/resumen` (que auto-cierra) y el `POST /api/ventas` la caja queda cerrada → 400/venta rechazada con mensaje "No hay una caja abierta" o "fue cerrada mientras se procesaba"; el carrito no se pierde; se puede abrir caja nueva y reintentar.
- Esperado: ninguna venta queda asociada a una caja cerrada.

**PM-COMB-7 — Dos pestañas del mismo operador (P0)**
- Pasos: en pestaña 1 y 2, simultáneamente: abrir caja (1 gana), confirmar la misma venta con la misma `idempotencyKey` (deduplicada), recibir el mismo pedido (una reserva), anular la misma venta (un solo reintegro).
- Esperado: todas las operaciones de doble ejecución son seguras — sin ventas/ventas-anuladas/reservas duplicadas en DB.

**PM-COMB-8 — Admin cambia de sucursal con formularios abiertos (P1)**
- Pasos: admin con `/ventas` cargado en sucursal A cambia el selector a B; confirma una venta desde la UI vieja.
- Esperado: la venta se graba en la sucursal **vigente al momento del POST** (cookie B); la UI refresca productos/stock de B; no se mezclan productos de A con caja de B (los productos de A darían 404/400 al validar branch ownership).

**PM-COMB-9 — Eliminar sucursal con pedidos y caja calientes (P0)**
- Pasos: sucursal con caja abierta, pedido `in_process` con reserva y cliente en el chat → admin la elimina.
- Esperado: cascada borra reservas/pedidos/mensajes; el cliente pierde seguimiento/chat (404); el operador termina en `sesion-finalizada`; los archivos quedan limpios o el cron los barre. Sin filas huérfanas (`SELECT` de verificación por `branch_id`).

**PM-COMB-10 — Vaciar papelera de cajas vs stock actual (P1)**
- Setup: papelera con varias cajas cuyas ventas descontaron insumos; entre medio se repuso stock por otros caminos.
- Pasos: `DELETE /api/caja/eliminadas` con > `TRASH_RESTORE_BATCH_SIZE` (20) cajas (o cortar a la mitad simulando fallo).
- Esperado: lotes atómicos — un corte deja procesados los lotes completos, reintegro no duplicado al reintentar; al final `products.stock` aumentó exactamente lo consumido por las ventas activas eliminadas.

**PM-COMB-11 — Reintegro de stock por cancelación de pedido `paid` con producto eliminado (P1)**
- Pasos: pedido `paid` cuyo insumo fue soft-deleted → cancelar → el stock vuelve igualmente al producto (el reintegro usa `includeDeleted`); el producto sigue en papelera pero con stock restaurado (verificar que no se vende por estar eliminado).

**PM-COMB-12 — Idempotencia cross-flujo (P1)**
- Pasos: mismo `idempotencyKey` usado en `POST /api/ventas` y en `POST /api/pedidos/[id]/confirmar` → son scopes/tablas distintas, no deben chocar; misma clave + distinto payload en el mismo flujo → 409 en ambos.

---

## 8. Anexo — qué verificar en DB por operación

| Operación | Tablas a inspeccionar |
| --- | --- |
| Login | `login_attempts` (count/last_attempt) |
| Abrir/cerrar caja | `cash_registers` (status, opened/closed_by, totales, summaries, auto_closed, forced_closed, closing_*) |
| Venta | `sales`, `sale_items`, `sale_payments`, `sale_item_recipes`, `products.stock`, `stock_movements` (`sale`), `cash_registers` totales |
| Anular venta | `sales.status`, `stock_movements` (`cancellation`), `cash_registers` (resta) |
| Pedido público | `orders` (+`cancellation_token`, `idempotency_key/hash`), `order_items`, `order_item_recipes`, `order_messages` (snapshot Sistema) — sin stock |
| Recibir pedido | `orders.status`, `order_stock_reservations`, `stock_movements` (`reserve`) |
| Confirmar pedido | `orders.status=paid`, `converted_sale_id`, `sales` nueva, `reserve_release` + `sale` en movimientos |
| Cancelar pedido | `orders.status=cancelled` (+razón), reservas liberadas o venta anulada según estado previo |
| Ajuste stock | `products.stock`, `stock_movements` (tipo/motivo/signo) |
| Producto | `products` (isActive/deletedAt), `recipes` (cascade por cambio de tipo), archivos de imagen |
| Chat | `order_messages` (sender, delivered_at, read_at, attachment_*) |
| Rate limit | `public_order_rate_limits` (scope+ip, count, reset_at) |
| Sucursal | `branches` (opening_hours, phones, social_links, location); cascada completa al borrar |
| Usuario | `users` (password_hash bcrypt, role, branch_id) |
| Videos | `videos` (is_active, deleted_at) + archivo en storage |

**Regla de verificación:** cada caso P0 debe cerrar con la query correspondiente — la UI puede mentir (cachés, estados optimistas); la tabla es la verdad.
