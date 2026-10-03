# Auditoría UX y funcional — sección `/sucursales`

**Estado:** archivado — implementado completo (2026-09-26) y mergeado en `main` vía PR #10 (`9fc1266`, que también migró usuarios a rutas dedicadas) — **Tramo A** (H-M1–H-M5, H-C1 con banners de advertencia sin bloqueos — decisión del usuario —, H-m2, H-m9–H-m13 y A1–A8), **menores** (H-m1, H-m3–H-m8) y **Tramo B** (rutas dedicadas `/sucursales/nueva` y `/sucursales/[id]/editar`). Sin pendientes.
**Fecha:** 2026-09-26 — **Revisión v3** (mismo día): auditoría del propio informe contra el código post-implementación — refs de líneas corregidas, §1.3/§4 actualizados al comportamiento vigente y 4 hallazgos menores nuevos (H-m10–H-m13). Sobre **v2**: re-verificación integral de cada afirmación; correcciones de precisión, dos hallazgos nuevos y propuestas afinadas. Registro de cambios en §8.
**Alcance:** auditoría documental de la sección `/sucursales` (sin modificar código, sin seed, sin E2E, solo lectura) en dos fases: **Fase 1** — inventario completo + hallazgos clasificados; **Fase 2** — propuesta priorizada de rediseño (sin implementar).
**Motivación:** hoy la página muestra primero el formulario de alta/edición y después el inventario; la primera impresión debería ser el estado de las sucursales existentes.
**Documentación de base:** `AGENTS.md`, `lecciones-aprendidas.md`, `reporte-estado.md`, `guia-funcionamiento-pancheria.md` y las auditorías archivadas de sucursales/caja (usadas como contexto de decisiones ya tomadas; no se re-audita lo implementado).

---

## 0. Resumen ejecutivo

- La sección **funciona y está bien validada**: validación en vivo + servidor, editor de horarios multi-franja con overnight, contactos múltiples, preview de mapa, eliminación con resumen de impacto y confirmación por nombre, invalidación de caché y cobertura E2E. Lo resuelto en las auditorías archivadas se mantiene.
- **1 hallazgo crítico — mitigado con banners (A7, sin bloqueos)**: el diálogo de eliminación cuenta registros y ahora **advierte los escenarios de mayor daño** con banners específicos: borrar la sucursal por defecto (`DEFAULT_BRANCH_NAME`) deja `/pedido` sin catálogo en la URL canónica; borrar la sucursal de la propia cuenta admin produce lockout del panel; borrar una sucursal con caja abierta o con pedidos en curso elimina trabajo activo; borrar la última sucursal vacía el sistema. El mismo efecto "catálogo caído" ocurre al **renombrar** la sucursal por defecto desde la edición *(punto ya mitigado: el formulario muestra el aviso `branch-default-name-warning` — A8; el riesgo persiste si el admin lo ignora)*.
- **5 hallazgos mayores — todos resueltos (Tramo A)**: jerarquía invertida (A1: tabla primero, formulario después + CTA "Nueva sucursal" en el header), edición sin contexto visible (A3: heading `Editar: {name}` + scroll/foco al formulario), tabla sin estado operativo (A4: badge En horario/Cerrado/Sin horarios + indicadores de ubicación/teléfonos/redes), sin adaptación responsive por breakpoints (A5: columnas `hidden {bp}:table-cell` + sub-resumen móvil + `title` en celdas truncadas), y el falso "Total: 0" si fallaba la consulta del resumen (H-M5, ya resuelto en v2).
- **Propuesta recomendada en dos tramos**: (A) quick wins que invierten la jerarquía y agregan estado **sin tocar un solo `data-testid`/`data-tour` ni un solo spec E2E**; (B) migración estructural a rutas dedicadas `/sucursales/nueva` y `/sucursales/[id]/editar`, espejando la convención ya establecida en `/productos`, con plan explícito de reasignación de contratos y actualización mecánica de specs.
- **Sin cambios de esquema** propuestos.

---

## 1. Inventario — qué muestra / qué maneja

### 1.1 Árbol de renderizado y orden actual

`src/app/(panel)/sucursales/page.tsx` (solo `admin`, con revalidación de rol contra la base):

<ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" lines="14-40" />

`BranchList` monta **primero el formulario y después la tabla**:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-list.tsx" lines="36-50" />

Detalle de precisión: `data-tour="branches-table"` está en el wrapper que **encierra formulario + tabla** (no solo la tabla), y `data-tour="branch-form"` envuelve el `BranchForm`.

Nota de contexto: `/sucursales` también es el destino defensivo de un admin sin `branchId` (`getCurrentBranchIdOrRedirect` redirige ahí en `src/lib/auth.ts:157-160`): la página cumple un rol de *onboarding* de la primera sucursal, así que el CTA de creación debe quedar visible aunque se invierta la jerarquía.

### 1.2 Componente por componente

| Componente | Qué muestra | Qué maneja | Evidencia |
| --- | --- | --- | --- |
| `page.tsx` | `<h1>Sucursales</h1>` (`data-tour="branches-header"`) + lista | Guard de admin con `revalidateSessionUser` (rol fresco de la base, no del JWT); `branchService.listBranches()` completo; `maxDuration = 300` heredado por las actions | <ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/page.tsx" lines="12-31" /> |
| `branch-list.tsx` | Tabla: Nombre, Dirección, Teléfono (solo el primero), Horarios (`N días` · `M franjas` / "Sin horarios"), ID, Acciones. Estado vacío: "No hay sucursales registradas." | Estado `editingBranch` + remount por `key`; conteo de días únicos vs franjas | <ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-list.tsx" lines="62-120" /> |
| `branch-form.tsx` (819 líneas) | Nombre, dirección, teléfonos (label+número, hasta 10), ubicación con validación en vivo + preview embebible, redes sociales (select + URL, hasta 10), editor de horarios por día con multi-franja, copiar/pegar entre días | `handleSubmit` manual → `FormData` → server action; estado `BranchState`; reset tras éxito; validación en vivo con `validateOpeningHours`, `isValidPhoneNumber`, `isValidSocialTarget`, `describeLocationInput` | <ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" lines="135-170" /> |
| `branch-actions.tsx` | Botones "Editar" / "Eliminar" por fila; diálogo "Confirmar eliminación" con resumen de impacto (counts por tabla) + input de confirmación por nombre exacto; errores de submit inline (`branch-delete-error`, `role="alert"`) y error de consulta con Reintentar | `loadSummary` consulta `getBranchDeletionSummaryAction` antes de abrir (sin fabricar ceros); `useActionState` con `deleteBranchAction`; `canConfirm` exige `summary` no nulo + `confirmName === branchName` | <ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-actions.tsx" lines="80-120" /> |
| `branch-location-preview.tsx` | `<details>` "Ver preview" + iframe embebido | Monta el iframe solo al abrir (sin request al proveedor sin interacción); `sandbox`, `loading="lazy"`, `referrerPolicy` | <ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-location-preview.tsx" lines="25-53" /> |
| `actions.ts` | — | `createBranch`, `updateBranchAction`, `deleteBranchAction` (todas `requireAdmin` + `BranchState = { error } \| null`); `getBranchDeletionSummaryAction` (consulta imperativa); invalidación `branches` + `public-catalog` + `revalidatePath` | <ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/actions.ts" lines="85-123" /> |
| `branchService.ts` | — | Validación de dominio (nombre obligatorio y único **case-insensitive**, horarios, contactos, ubicación); `getBranchDeletionSummary` (counts); `deleteBranch` con cascada transaccional + limpieza de storage y rate-limit post-commit | <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" lines="145-237" /> |
| `branchRepository.ts` | — | `findAllOrderedByCreatedAt` (desc, límite opcional no usado por la página), `findByNameCaseInsensitive`, `countBranchDeletionImpact`, `deleteCascade` | <ref_snippet file="C:/developer/paginas/pancheria/src/repositories/branchRepository.ts" lines="20-27" /> |
| `branch-helpers.ts` | — | Validación/parsing de horarios (overnight, solapamientos sobre semana expandida), resolución de turnos a instantes UTC con `NEXT_PUBLIC_BRANCH_TIMEZONE`, `isBranchOpen`, `getTodayOpening`, `getNextOpening`, `getCurrentOrNextOpening`, `formatOpeningHours`, normalización de teléfonos/redes | <ref_snippet file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" lines="315-417" /> |
| `branch-resolver.ts` | — | `listPublicBranches` (cache tag `branches`, cap `MAX_LIMIT` = 100), `getDefaultBranchId` por `DEFAULT_BRANCH_NAME` (**match exacto** vía `findByName`, case-sensitive), `parseBranchId` | `src/lib/branch-resolver.ts:13-66` |

### 1.3 Flujos

**Alta** — formulario → `createBranch` → `requireAdmin` → `parseOpeningHoursForm`/`parseContactsForm` → `branchService.createBranch` (validación de dominio + unicidad case-insensitive) → `invalidateBranchesCache()` + `revalidatePath(routes.sucursales)` → `BranchState = null` → el form resetea estado local.

**Edición** — botón "Editar" en la fila → `setEditingBranch(branch)` → `BranchForm` remonta por `key={editingBranch.id}` con los datos cargados → `updateBranchAction` → mismo ciclo de invalidación. "Cancelar" vuelve a modo crear.

**Eliminación** — botón "Eliminar" → `getBranchDeletionSummaryAction(id)` (counts: productos, ventas, cajas, movimientos de stock, usuarios, recetas, pedidos, videos + total) → diálogo → input debe igualar el nombre exacto → `deleteBranchAction` → `deleteBranch`: cascada en una transacción (`recipes` → `sale_items` → `stock_movements` → `orders` (+items, `order_item_recipes`, reservas y mensajes por `ON DELETE CASCADE`) → `sales` → `cash_registers` → `videos` → `products` → `users` → `branches`), luego limpieza best-effort de imágenes/adjuntos/videos en storage y del rate-limit store, con `logger.warn` si quedan restos. Hard delete: **decisión explícita ya tomada** (guía §7.4), no se reabre.

**Si falla la consulta del resumen** *(post-corrección H-M5)*: `loadSummary` captura el error, deja `summary` en `null` y abre el diálogo mostrando "No se pudo cargar el resumen de registros asociados" con botón **Reintentar** + Cancelar; el formulario de confirmación no se renderiza hasta tener un resumen válido (`canConfirm` exige `summary` no nulo). Ya no se fabrica un resumen en cero (ver H-M5, resuelto).

**Validaciones** — cliente (en vivo, tras blur/submit: nombre obligatorio, ubicación con `describeLocationInput`, formato de teléfono/redes, horarios con `validateOpeningHours` completo incluyendo overnight y solapamientos) + servidor (mismo `validateOpeningHours`, `normalizeBranchPhones`, `normalizeSocialLinks`, `normalizeLocation`, unicidad case-insensitive). Las filas parciales llegan al servidor y producen error explícito (ya resuelto en auditoría archivada).

### 1.4 Matriz campo → efecto downstream

| Campo del formulario | Consumidores | Efecto |
| --- | --- | --- |
| `name` | `/pedido` ("Catálogo de {name}"), selector público de sucursal, header del panel, `BranchSelector` de admin, API de estado, **`getDefaultBranchId`** (lookup exacto por `DEFAULT_BRANCH_NAME`) | Público; único case-insensitive (capa de aplicación; el índice de DB es case-sensitive). Renombrar la sucursal por defecto rompe la URL canónica de `/pedido` igual que borrarla |
| `openingHours[]` | `isBranchOpen`/`getTodayOpening`/`getNextOpening`/`getCurrentOrNextOpening`; `GET /api/public/sucursal/estado`; `getCashRegisterShiftStatus`/`resolveCashRegisterAlert` → `estadoTurno`/`alertaCaja` en `/api/caja/resumen` y `/api/panel/resumen` | Estado abierto/cerrado del catálogo, horario de hoy, próxima apertura y **avisos de caja por turnos**; soporta overnight. **Sin horarios: `isBranchOpen` = false, pero el estado público la considera abierta siempre que haya caja abierta** (`open = cajaAbierta && (!tieneHorarios || isBranchOpen)`) y la caja cae al fallback por umbral |
| `address` | `BranchInfoCard` (tarjeta del catálogo), checkout pickup ("Dirección de retiro"), diálogo de éxito | Público |
| `phones[]` | `BranchInfoCard`, diálogo de éxito, `GET /api/public/sucursal/estado` | Público |
| `socialLinks[]` | `BranchInfoCard` (links con `getSocialLinkHref`, WhatsApp → wa.me), diálogo de éxito, encabezado del chat | Público |
| `location` | `BranchMap` en catálogo (embed solo de orígenes permitidos, si no link "Ver en mapa"); `POST /api/pedidos/[id]/chat/ubicacion` (el operador envía la ubicación al chat en pedidos pickup) | Público |
| `id` | `?branchId=` en `/pedido`, cookie `activeBranchId`, scoping de todo el panel | Aislamiento multi-sucursal |

### 1.5 Contratos externos que consume/impone la sección

**Tour** (`tour-context.tsx`): solo se consume `[data-tour="branches-header"]` (paso 20, navega a `/sucursales` y espera el popover "Sucursales"):

<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="426-435" />

`data-tour="branch-form"` y `data-tour="branches-table"` están definidos en `branch-list.tsx` pero **no son referenciados por el tour**. Deben preservarse igual (contrato declarado y posible uso futuro).

**E2E que dependen de la estructura actual** — varios specs asumen que el formulario está **visible inmediatamente** tras `goto('/sucursales')`, sin paso intermedio:

| Spec | Dependencias sobre `/sucursales` |
| --- | --- |
| `sucursal-form-ux.spec.ts` (6 tests) | `goto` → `getByLabel('Nombre de la sucursal')` (vía `htmlFor`+`id`, viaja con el form), `branch-location`, `branch-day-*-toggle`, `branch-slot-*`, `branch-copy/paste-day-*`, botón "Crear sucursal"; edición vía `row.getByRole('button', { name: 'Editar' })`; helper `deleteBranchViaUi` reutilizable |
| `sucursal-contactos-y-turnos.spec.ts` | `goto` → `branch-add-phone`, `branch-phone-label/number-*`, `branch-add-social`, `branch-social-*`, "Crear sucursal"; verifica `branch-phone` en la fila con `toHaveText` (lee `textContent`: no exige visibilidad) y repoblado al editar |
| `sucursal-eliminacion.spec.ts` (2 tests) | `goto` → crear por nombre; `delete-branch-${id}`, diálogo "Confirmar eliminación", placeholder `/para confirmar/`/"Escribí", botón "Eliminar definitivamente" |
| `roles-y-sucursales.spec.ts` | heading "Sucursales" en `/sucursales`; selector de sucursal del header (`branch-selector-trigger`, `branch-option`, `active-branch-name`) |
| `responsive.spec.ts` | `/sucursales` en la lista de rutas sin h-scroll (viewport fijo 375×667 + ciclo 375/430/768/1920); diálogo de eliminación sin h-scroll a 375px |
| `accessibility.spec.ts` | `/sucursales` audita axe `wcag21aa` (el panel no se audita a `wcag22aa` — solo páginas públicas) |
| `sesion-sucursal-eliminada.spec.ts` | comportamiento post-borrado (sesión terminada) — no depende de la UI del form |
| `tour.spec.ts` | paso "Sucursales" sobre `branches-header` |
| `pedido-sucursal-cerrada.spec.ts`, `pedido-sucursal-y-stock.spec.ts` | consumen sucursales del seed vía API/BD pública — **no dependen de la UI del panel** |

**Datos clave para la propuesta**:

- Ningún spec verifica el **orden** formulario↔tabla ni el texto de la celda `branch-opening-hours` — reordenar y enriquecer esa celda son cambios con contrato intacto.
- Playwright hace auto-scroll al elemento antes de `fill`/`check`/`click`: bajar el formulario por debajo del fold **no rompe ningún spec**.
- `global-setup.ts` fuerza horarios `00:00–23:59` en los 7 días de todas las sucursales del seed (24/7 práctico; queda un gap de 1 minuto a la medianoche — solo anotable si un futuro badge de estado se aserta en E2E en ese instante): si se agrega un badge de estado, en E2E todas dirán "En horario"/"Abierto" — ningún spec aserta su ausencia.

---

## 2. Hallazgos

### 2.1 Críticos

**H-C1 — El diálogo de eliminación no advierte los tres escenarios de mayor daño; el cuarto (renombrado del default, en edición) ya tiene aviso — A8.** *(resuelto 2026-09-26 con banners de advertencia — A7; sin bloqueos, decisión del usuario)*

El resumen de impacto cuenta registros (productos, ventas, cajas, usuarios…) pero no distingue:

1. **Sucursal por defecto del catálogo público**: `getDefaultBranchId()` resuelve por `DEFAULT_BRANCH_NAME` con `findByName` — igualdad **exacta y case-sensitive** (`eq`), no la unicidad case-insensitive de la capa de aplicación. Si esa sucursal se borra, `/pedido` sin `?branchId` devuelve `<PedidoError />` — el canal público de ventas queda caído en su URL canónica, sin ninguna advertencia al admin.
   <ref_snippet file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" lines="84-91" />
2. **La propia cuenta del admin**: `deleteCascade` borra `users` de la sucursal — incluido el admin que ejecuta la acción si su `session.user.branchId` (la sucursal **asignada**, tras `revalidateSessionUser`; no confundir con la sucursal activa de la cookie `activeBranchId`) pertenece a ella. Si era el único admin, el resultado es **lockout total del panel** (el JWT queda vivo pero `revalidateSessionUser` termina la sesión y las credenciales ya no existen; la recuperación exige re-seed).
   <ref_snippet file="C:/developer/paginas/pancheria/src/repositories/branchRepository.ts" lines="230-241" />
3. **Caja abierta en curso**: el resumen dice "Cajas: N" sin distinguir abierta/cerrada (`status='open'`); una sucursal con caja abierta puede tener pedidos `pending`/`in_process` y ventas activas que se borran en la misma operación.
4. **Renombrar la sucursal por defecto** (v2): no es eliminación, pero produce el mismo efecto que el punto 1 — `getDefaultBranchId` ya no encuentra `DEFAULT_BRANCH_NAME` y `/pedido` queda caído en su URL canónica. **Mitigado por A8**: el formulario de edición muestra el aviso `branch-default-name-warning` bajo el campo nombre; el riesgo persiste si el admin lo ignora, y el flag `isDefaultBranch` del diálogo de eliminación sigue pendiente en A7.

El flujo de confirmación (nombre exacto) existe y es correcto; lo que faltaba era **información de riesgo** en esa confirmación. **Resolución (A7, 2026-09-26):** `getBranchDeletionSummary` ahora devuelve `flags` (`isDefaultBranch`, `isSelfBranch`, `isLastBranch`, `hasOpenCashRegister`, `activeOrders`) calculados en consulta — `isDefaultBranch` por match exacto contra `getDefaultBranchName()`, `isSelfBranch` contra el `branchId` asignado del admin revalidado por `requireAdmin`, `hasOpenCashRegister`/`activeOrders` contando `cash_registers` `status='open'` no borradas y `orders` `pending`/`in_process` no borrados — y el diálogo muestra un banner destructivo por flag activo (`branch-delete-warning-*`). **Decisión del usuario: solo advertir, sin bloquear** la eliminación en ningún escenario.

### 2.2 Mayores

**H-M1 — Jerarquía invertida + formulario siempre montado.** *(resuelto 2026-09-26 — A1/A2)*

El inventario (la tarea principal del admin al entrar) quedaba debajo del formulario más complejo del panel: nombre, dirección, teléfonos, redes, ubicación con preview y un editor de 7 tarjetas de día con multi-franja (~800 líneas de componente, altura real de varias pantallas). En `/usuarios` existe el mismo patrón de formulario inline primero (`user-list.tsx:54-67`), pero con 4 campos simples; el costo cognitivo y de scroll no es comparable. En `/productos` — la sección más comparable por volumen de formulario — el inventario ya es lo primero y la carga vive en rutas dedicadas.

**Resolución:** `BranchList` ahora monta la tabla primero y el formulario después (mismo wrapper `data-tour="branches-table"`); el header ganó el CTA "Nueva sucursal" (`data-tour="branches-new"`, ancla nativa `<a href="#nueva-sucursal">` que funciona sin JS, con `scroll-mt-20` por el header sticky) y el estado vacío enlaza "Crear la primera sucursal" al formulario (onboarding del admin sin sucursal). El formulario sigue montado siempre — eso queda para el Tramo B.

**H-M2 — Edición sin contexto visible.** *(resuelto 2026-09-26 — A3)*

Al tocar "Editar" en una fila, el formulario cambiaba a modo edición fuera de la vista si el admin scrolleó; no había título "Editando: {nombre}" (la única señal era el texto del botón submit y la aparición de "Cancelar"), ni scroll/foco hacia el formulario. Riesgo real de confundir qué se está editando.

**Resolución:** el formulario ahora tiene heading dinámico `branch-form-heading` ("Crear sucursal" / `Editar: {name}`) y al montarse en modo edición hace `scrollIntoView({block:'start'})` + foco al campo nombre (`preventScroll` para no competir con el scroll).

**H-M3 — La tabla no muestra estado operativo.** *(resuelto 2026-09-26 — A4)*

La celda de horarios decía "N días · M franjas" / "Sin horarios" pero no respondía lo que el admin necesita de un vistazo: **¿está en horario de atención ahora? ¿cuál es el próximo turno? ¿tiene ubicación? ¿cuántos contactos/redes tiene cargados?** Toda esa información ya se calcula para el público (`isBranchOpen`, `getTodayOpening`, `getNextOpening` son helpers puros sobre `Branch` — reusables server-side sin queries extra) pero no se exponía en el panel.

**Resolución:** nuevo helper puro `getBranchOperationalStatus(branch, now)` en `branch-helpers.ts` (`state: 'in_hours'|'closed'|'no_hours'` + `detail`), calculado en `page.tsx` server-side y pasado como `statusById` a `BranchList`. La celda Horarios muestra badge `En horario`/`Cerrado` + `N días · M franjas` + detalle ("Hoy de 08:00 a 12:00" / "Abre mañana de…"), y "Sin horarios" aclara que el canal público la considera abierta si hay caja abierta. El badge lleva `title` que explicita la semántica (horario vigente al cargar, no estado público real). La celda Nombre muestra indicadores secundarios con iconos: `Mapa` (ubicación), `N tel.`, `N redes` con `title` de detalle. No se consultó `getOpenCashRegister` por fila: el badge rotula horario, no estado público — la opción queda documentada si se quisiera la señal real del canal.

**H-M4 — Sin adaptación responsive por breakpoints.** *(resuelto 2026-09-26 — A5)*

Las 6 columnas se mostraban siempre; en móvil había scroll horizontal interno (contenido por `overflow-x-auto`, no rompe el layout — `responsive.spec.ts` lo cubre a 375px) pero la columna "Acciones" (Editar/Eliminar) quedaba fuera de la vista inicial. `/productos` resuelve esto con `hidden sm:table-cell`/`hidden md:table-cell`/`hidden lg:table-cell` y un sub-resumen inline bajo el nombre. Además, el formulario ocupa `max-w-md` — en desktop queda una columna angosta con mucho espacio vacío a la derecha y un editor de horarios extremadamente alto.

<ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/productos/page.tsx" lines="80-87" />

**Resolución:** tabla con breakpoints de `/productos` — Dirección `hidden sm:table-cell`, Teléfono `hidden md:table-cell`, ID `hidden lg:table-cell` — y sub-resumen bajo el nombre solo en móvil (`sm:hidden`: dirección + primer teléfono + "+N"). El "+N" vive en el sub-resumen móvil y en el chip `N tel.` de la celda Nombre, **no** en la celda `branch-phone`: el spec `sucursal-contactos-y-turnos` aserta `toHaveText` exacto sobre esa celda. La columna Horarios (con el badge de estado de A4) queda visible en todos los breakpoints. El ancho `max-w-md` del formulario se mantiene — el espacio lo resuelve el Tramo B con rutas dedicadas.

**H-M5 — Si falla la consulta del resumen de impacto, el diálogo muestra un falso "0 registros".** *(nuevo en v2 — **resuelto**)*

`handleOpenDelete` atrapa el error de `getBranchDeletionSummaryAction` y fabrica un `summary` con todos los conteos en 0, abriendo el diálogo igual (`branch-actions.tsx`, versión previa al fix). Resultado: ante un fallo de red o de la consulta, el admin ve **"Total de registros afectados: 0" / "No hay registros asociados."** — la información más tranquilizadora posible justo antes de la operación más destructiva del panel. Además la rama `summary ? … : <p>No se pudo cargar el resumen.</p>` es **código muerto**: `summary` siempre queda seteado en ambos caminos, así que el mensaje de error nunca se muestra. Agrava H-C1: el diálogo existe precisamente para informar el daño; informarlo mal es peor que no informarlo.

**Resolución (2026-09-26):** la función se renombró `loadSummary` y ya no fabrica ceros — el diálogo solo se abre tras la consulta; si falla muestra "No se pudo cargar el resumen de registros asociados" con **Reintentar** + Cancelar, y `canConfirm` exige `summary` no nulo (submit bloqueado sin resumen válido, decisión segura ya aplicada). Regresión cubierta por `branch-actions.test.tsx`.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-actions.tsx" lines="80-101" />

### 2.3 Menores

| # | Hallazgo | Evidencia |
| --- | --- | --- |
| H-m1 | `data-testid="branch-name"` y `data-testid="branch-address"` están **duplicados en la misma página** (celda de tabla e input del form). Hoy los specs se salvan por usar lookup scopeado a `branch-row`; cualquier selector global rompería strict mode de Playwright — **resuelto 2026-09-26**: los testids del form se renombraron a `branch-form-name`/`branch-form-address` y el Tramo B separó además formulario e inventario en rutas distintas | `branch-list.tsx` y `branch-form.tsx` |
| H-m2 | Dirección y teléfono usan `truncate` sin `title` ni expansión → el dato cortado es irrecuperable sin entrar a editar. Teléfonos muestra solo el primero, sin indicador "+N más" — **resuelto 2026-09-26 (A5)**: `title` con el valor completo en ambas celdas (en teléfonos, la lista completa), "+N" en el sub-resumen móvil y chip `N tel.` bajo el nombre | `branch-list.tsx` |
| H-m3 | `deleteBranchAction` **relanza** errores no-`DomainError` (cae al error boundary, UX distinta al `{error}` del form); `createBranch`/`updateBranchAction` devuelven `error.message` crudo para errores no de dominio (puede llegar texto de PostgreSQL al admin) — **resuelto 2026-09-26**: errores inesperados devuelven mensaje genérico en español y el borrado se muestra inline en el diálogo | `actions.ts` |
| H-m4 | Tipos `BranchOpeningHours`/`BranchPhone`/`BranchSocialLink` duplicados entre `schema.ts` y `domain/types.ts` (ya señalado en la auditoría archivada §1.1); constante `DAYS` duplicada entre `branch-helpers.ts` y `branch-form.tsx` — **resuelto 2026-09-26**: el schema reusa los tipos de dominio y el form importa `DAYS` de `branch-helpers` | — |
| H-m5 | `dialog.tsx` tiene `sr-only "Close"` y footer "Close" en inglés (componente global, no exclusivo de esta sección) — **resuelto 2026-09-26**: traducido a "Cerrar"; el texto duplicado con botones propios de algunos diálogos se desambiguó con `data-testid` en el botón de footer (`order-success-close`) | `src/components/ui/dialog.tsx` |
| H-m6 | Checkbox de día nativo `h-4 w-4` (16px) — área táctil menor a lo recomendado (24px WCAG 2.2 SC 2.5.8); el `Label` asociado amplía el target, pero el control visual es pequeño. Advisory: el spec axe del panel solo audita `wcag21aa` — **resuelto 2026-09-26**: checkbox a `h-6 w-6` (24px) | `branch-form.tsx` |
| H-m7 | `listBranches()` corre **sin caché ni límite en el layout del panel para todo admin** (todas las páginas), y se repite en las páginas `/sucursales` y `/usuarios` — 2-3 queries por visita. El público usa `getCachedBranchList(MAX_LIMIT=100)` con tag `branches` ya invalidado por las mismas actions: el panel podría reutilizarla (o un `React.cache` por request). Además, si se superan 100 sucursales el selector público trunca silenciosamente — **resuelto 2026-09-26**: `listBranchesForRequest` (React.cache por request en `server-cache.ts`) deduplica la consulta en layout y páginas del panel | `layout.tsx`, `server-cache.ts` |
| H-m8 | Desmarcar un día borra sus franjas cargadas sin confirmación ni deshacer (no persiste hasta guardar → aceptable, pero se pierde trabajo del formulario) — **resuelto 2026-09-26**: al desmarcar se conservan en memoria (`disabledDaySlots`) y se restauran al remarcar; solo el borrado explícito de franja las descarta | `branch-form.tsx` |
| H-m9 | Al fallar `deleteBranchAction` se abre el **diálogo de error apilado sobre el de confirmación** (ambos `Dialog` montados a la vez: `isDialogOpen` sigue `true`). Dos modales concurrentes son UX confusa y pelea de foco/backdrop; el error debería mostrarse inline dentro del diálogo de confirmación — **resuelto 2026-09-26**: el segundo `Dialog` se eliminó y el error viaja inline con `role="alert"` (`branch-delete-error`) | `branch-actions.tsx` |
| H-m10 | El diálogo de eliminación **no resetea `confirmName` al cerrar** (`handleDialogOpenChange` solo descarta el error de submit): reabrir tras haber escrito el nombre deja "Eliminar definitivamente" ya habilitado — debilita la fricción de confirmación. `summary` sí se refetchea en cada apertura, ese lado está bien *(nuevo en v3)* — **resuelto 2026-09-26 (A7)**: `handleDialogOpenChange` ahora también hace `setConfirmName('')`; regresión cubierta por test | `branch-actions.tsx` |
| H-m11 | `deleteButtonRef` se asigna al botón Eliminar pero **nunca se lee** — código muerto (probablemente pensado para devolver el foco al cerrar el diálogo) *(nuevo en v3)* — **resuelto 2026-09-26 (A7)**: ref eliminado | `branch-actions.tsx` |
| H-m12 | El "Total de registros afectados" suma solo las 8 tablas top-level; la cascada borra además `sale_items`, `order_items`, `order_messages`, `order_stock_reservations`, `sale_payments`, `sale_item_recipes` y `order_item_recipes` → el total informado **subestima** el daño real (agrava H-C1: el resumen ya informa a la baja) *(nuevo en v3)* — **resuelto 2026-09-26 (A7)**: nuevo `countDeletionCascadeChildren` cuenta los hijos (ítems de ventas/pedidos, pagos, recetas aplicadas, mensajes y reservas), `counts.total` los incluye y el diálogo detalla la línea "Incluye N registros asociados en cascada" | `branchRepository.ts`, `branchService.ts`, `branch-actions.tsx` |
| H-m13 | `getBranchDeletionSummary` serializa el `Branch` completo al cliente cuando el diálogo no usa ningún campo (muestra `branchName` por prop) — over-fetch trivial *(nuevo en v3)* — **resuelto 2026-09-26 (A7)**: `branch` ahora viaja como `{id, name}` y el tipo del cliente se infiere de la action (`Awaited<ReturnType<...>>`) para no duplicar el contrato | `branchService.ts`, `branch-actions.tsx` |

### 2.4 Observaciones informativas (no son defectos)

- La ayuda contextual existente ya cubre bien: semántica overnight y copiar/pegar en horarios, formatos aceptados de ubicación con preview, "se muestran en el catálogo público" en teléfonos/redes. Lo que falta es el **efecto downstream** (caja, estado público, retiro pickup, sucursal por defecto), no la mecánica.
- `getBranchDeletionSummaryAction` es una server action usada como consulta imperativa (no como form action) — patrón válido pero inusual; queda registrado.
- `listBranches` ordena por `createdAt` desc: la sucursal recién creada aparece primera en la tabla — consistente con la UX de alta.
- La tabla sin paginación **no es un defecto a esta escala** (pocas sucursales esperadas); se anota como mejora condicional, no como hallazgo.
- La convención `BranchState = { error } | null` + `useActionState`/`useTransition` es la misma de usuarios — consistente.
- Existe `ConfirmDialog` genérico en `ui/`, pero no soporta el input de confirmación por nombre ni el resumen de impacto: el diálogo custom de eliminación está justificado (no migrar).
- Accesibilidad verificada en código: `Label` asociados, `aria-label`/`aria-invalid`/`aria-describedby` en todas las filas dinámicas, `role="alert"` en errores, iframe con `title`, enlaces externos con `noopener noreferrer`. La página está cubierta por el spec axe `wcag21aa` (panel) — cualquier rediseño debe seguir pasándolo.

---

## 3. Propuesta de rediseño (implementada completa)

### 3.1 Decisión estructural — alternativas evaluadas

| Alternativa | Ventajas | Contras | Veredicto |
| --- | --- | --- | --- |
| **A. Reordenar inline** (tabla primero, formulario después, mismo DOM de testids) | Cero cambios en E2E/tour (auto-scroll de Playwright + ningún spec aserta orden); esfuerzo mínimo; resuelve la primera impresión | El form sigue montado siempre; la edición sigue lejos de la fila | **Tramo 1 recomendado (quick win)** |
| **B. Colapsable / sección plegable** | Mantiene una sola página; oculta el peso visual | Sigue montando el form salvo lazy-mount; sin deep-link; E2E requieren abrir el plegable | Descartable como estado final |
| **C. Diálogo** (`Dialog` ya existe en `ui/`) | Acción explícita "Nueva sucursal"; sin rutas nuevas | El editor de 7 días + contactos + preview dentro de un modal con scroll es UX pobre para esta densidad; E2E requieren click previo | No recomendado para este formulario |
| **D. Drawer/Sheet** | Buen patrón para edición | **No existe `Sheet` en `src/components/ui/`** — agregaría dependencia contra la convención | Descartado |
| **E. Rutas dedicadas** `/sucursales/nueva` + `/sucursales/[id]/editar` | **Convención ya establecida en `/productos`** (`productosNuevo`, `productosEditar`); inventario primero de verdad; espacio para el editor a ancho completo + tarjeta de ayuda (patrón `ProductHelpCard`); deep-linkable; resuelve H-M2 de raíz | Esfuerzo mayor; reasignación de `data-tour` y actualización mecánica de specs que entran directo al form | **Tramo 2 recomendado** |

**Recomendación**: dos tramos.

- **Tramo 1 — IMPLEMENTADO (2026-09-26)**: reordenar `BranchList` (tabla primero), encabezado con acción "Nueva sucursal" con ancla/scroll al formulario, heading dinámico en el form, estado operativo y badges en la tabla, responsive por breakpoints, ayuda contextual downstream, el refuerzo del diálogo de eliminación y la corrección del resumen falso. **No cambió ningún `data-testid`/`data-tour` ni ningún spec.**
- **Tramo 2 — IMPLEMENTADO (2026-09-26)**: alta/edición migradas a rutas dedicadas espejando `/productos`, siguiendo el plan de reasignación de contratos de §3.3. Detalle en §8 ("Implementación Tramo B").

### 3.2 Quick wins (Tramo A) — detalle

> **Estado:** A1–A8 implementados el 2026-09-26. Detalle de la implementación en §8 ("Implementación Tramo A").

| # | Propuesta | Prioridad | Impacto | Esfuerzo | Archivos | Riesgo de regresión |
| --- | --- | --- | --- | --- | --- | --- |
| A1 ✅ | **Invertir el orden en `BranchList`**: tabla primero, formulario debajo. Mantener `data-tour="branches-table"` en el wrapper y `data-tour="branch-form"` en el form. Con tabla vacía, el estado "No hay sucursales registradas." debe quedar acompañado del CTA de alta (la página también es onboarding del primer admin) | Mayor | Alta — resuelve la motivación central | XS | `branch-list.tsx` | Nulo: ningún spec depende del orden y Playwright hace auto-scroll hasta el form (verificado §1.5) |
| A2 ✅ | **Header con acción "Nueva sucursal"** (patrón `/productos`): botón en el `<h1>` row; preferir ancla nativa `<Link href="#nueva-sucursal">`/`href="#…"` sobre el wrapper del form (funciona sin JS) + `id="nueva-sucursal"`/`data-tour="branches-new"` | Mayor | Alta | XS | `page.tsx`, `branch-list.tsx`, `branch-form.tsx` | Nulo — atributos aditivos |
| A3 ✅ | **Heading dinámico + scroll al editar**: título visible "Crear sucursal" / `Editar: {name}` dentro del form; al hacer click en "Editar", `scrollIntoView({block:'start'})` + foco al campo nombre | Mayor | Alta — resuelve H-M2 | S | `branch-form.tsx`, `branch-list.tsx` | Nulo — solo markup; `branch-cancel`/`branch-submit` intactos |
| A4 ✅ | **Estado operativo en la tabla**: columna "Estado" o expansión de la celda Horarios usando `isBranchOpen` + `getTodayOpening`/`getNextOpening` (helpers puros ya existentes; calcular en `page.tsx` server-side, sin queries extra). Badges: `En horario` / `Cerrado · abre {next}` / `Sin horarios`; indicadores secundarios `📍` ubicación, `N tel.`, `N redes`. **Semántica explícita**: el badge refleja *horario vigente*, no el estado público (que además exige caja abierta — ver §4). Si se quiere la señal real del canal, una query por fila con `getOpenCashRegister`. El badge se calcula en SSR: queda congelado mientras la página esté abierta (no hay polling como en `/caja`) — aceptable a esta escala, documentarlo en la ayuda o con un `title` | Mayor | Alta — resuelve H-M3 | S-M | `page.tsx`, `branch-list.tsx` (opcional: `branch-status-badge.tsx` nuevo) | Bajo: ningún spec verifica el texto de `branch-opening-hours`; el "Sin horarios" puede conservarse como variante |
| A5 ✅ | **Responsive por breakpoints**: ocultar Dirección (`hidden sm:table-cell`), Teléfono (`hidden md:table-cell`), ID (`hidden lg:table-cell`) como en `/productos`; sub-resumen inline bajo el nombre en móvil; `title`/`aria-label` con el valor completo en celdas truncadas; `+N` en teléfonos | Mayor | Media-alta en móvil — resuelve H-M4, H-m2 | S | `branch-list.tsx` | Bajo — verificado: los specs que leen `branch-phone` usan `toHaveText` (evalúa `textContent`, no exige visibilidad) scopeado a `branch-row` y corren al viewport default de 1280px (> `md`); `responsive.spec` solo mide h-scroll de página, no celdas. Único cuidado: no usar `hidden` sin breakpoint |
| A6 ✅ | **Ayuda contextual downstream**: extender los textos existentes — Horarios: "alimentan el estado abierto/cerrado del catálogo y los avisos de caja por turnos; **sin horarios, la sucursal se considera abierta en el canal público siempre que haya caja abierta**"; Dirección: "se muestra como dirección de retiro en pedidos pickup"; Nombre: "se muestra en el catálogo público y debe ser único"; Teléfonos/redes ya dicen "catálogo público" | Mayor | Media — resuelve el pedido de soporte contextual y documenta la semántica real | XS | `branch-form.tsx` | Nulo — texto solamente |
| A7 ✅ | **Reforzar el diálogo de eliminación (H-C1 + H-M5)**: enriquecer `getBranchDeletionSummary` con `isDefaultBranch` (`branch.name === getDefaultBranchName().trim()` — **match exacto**, igual que `findByName`), `hasOpenCashRegister` (count `cashRegisters` con `status='open'`), `activeOrders` (pedidos `pending`/`in_process`), `isSelfBranch` (`session.user.branchId === branch.id` — el admin ya viene revalidado por `requireAdmin`), `isLastBranch` (count total = 1); mostrar banners rojos específicos por flag. **Corrección de H-M5 — ya aplicada**: error explícito + Reintentar y submit bloqueado sin resumen válido. En la misma pasada, absorber los menores nuevos de v3: resetear `confirmName` al cerrar el diálogo (H-m10), eliminar `deleteButtonRef` (H-m11), rotular que el "Total" cuenta registros principales sin los hijos en cascada o ampliar el detalle (H-m12), y reducir el payload de `branch` a `{id, name}` (H-m13). **Decisión del usuario: solo banners, sin bloquear** | **Crítico** | Alta — evita catálogo caído, lockout y resumen engañoso | M | `branchService.ts`, `branchRepository.ts`, `branch-actions.tsx`, `actions.ts` | Bajo: el diálogo gana contenido; `sucursal-eliminacion.spec.ts` y `responsive.spec.ts` siguen pasando (mismo testid, mismo flujo); el bloqueo de submit sin resumen ya aplica (H-M5 resuelto) y el retry-path del spec carga el resumen OK |
| A8 | **Advertencia al renombrar la sucursal por defecto** (H-C1 punto 4) — **implementado 2026-09-26**: `page.tsx` pasa `defaultBranchName` (`getDefaultBranchName`, env — sin hardcodear), `branch-list.tsx` calcula `isDefaultBranch` por match exacto y `branch-form.tsx` muestra el aviso ámbar `branch-default-name-warning` bajo el campo nombre en modo edición | Mayor | Media — cierra el cuarto escenario de daño | XS | `page.tsx`, `branch-list.tsx`, `branch-form.tsx` | Nulo — prop booleana aditiva |

### 3.3 Cambio estructural (Tramo B) — rutas dedicadas

> **Estado:** implementado el 2026-09-26. Detalle en §8 ("Implementación Tramo B").

Espejando `/productos` (`/productos/nuevo` con `ProductFormTabs`, `/productos/[id]/editar` con `notFound()`):

- `src/app/(panel)/sucursales/page.tsx`: solo header (H1 + botón "Nueva sucursal" → `routes.sucursalesNueva`) + tabla inventario con estado.
- `src/app/(panel)/sucursales/nueva/page.tsx`: `BranchForm` en modo crear + `BranchHelpCard` (equivalente a `ProductHelpCard`) con la ayuda downstream de A6. Nota de precisión: en productos la tarjeta va **dentro** del form, arriba — no es lateral; en sucursales puede replicarse igual o, si se adopta un layout de dos columnas, quedar realmente lateral (el ancho liberado por `max-w-md` lo permite).
- `src/app/(panel)/sucursales/[id]/editar/page.tsx`: `BranchForm` modo editar + misma ayuda; `notFound()` si el id no existe (patrón de `productos/[id]/editar`).
- **Guard de acceso**: copiar el de `sucursales/page.tsx` actual (`revalidateSessionUser` + rol contra la base). Ojo: la convención de productos es inconsistente — `productos/nuevo` sí revalida y `productos/[id]/editar` solo chequea `session.user.role` del JWT; para sucursales usar siempre el guard completo.
- `src/config/routes.ts`: agregar `sucursalesNueva` y `sucursalesEditar(id)` (el tour usa rutas centralizadas — no hardcodear).
- `BranchForm` se muda **sin cambios internos**; `BranchList` pierde el estado `editingBranch` (la edición navega). Las actions pueden seguir llegando por props (inyección actual) o importarse directo — decisión de implementación, ambas válidas; mantener props conserva el patrón ya probado.

**Reasignación explícita de contratos**:

| Contrato | Hoy | Propuesta |
| --- | --- | --- |
| `data-tour="branches-header"` | `<h1>` | Sin cambio — el tour no se rompe |
| `data-tour="branches-table"` | wrapper form+tabla | Mover al contenedor de la tabla sola (corrección de precisión) |
| `data-tour="branch-form"` | wrapper del form | Mover al form en `/sucursales/nueva` (o al `<form>` mismo) |
| `data-tour="branches-new"` (nuevo) | — | Botón "Nueva sucursal" del header |
| `data-testid="branch-*"` del form | en la página | Se mueven con el form a `/nueva` y `/[id]/editar` |
| `data-testid="branch-row"`/`branch-name`/`branch-address`/`branch-phone`/`branch-opening-hours`/`delete-branch-${id}` | tabla | Sin cambio en la tabla; **resolver H-m1** renombrando los del form (p. ej. `branch-form-name`) |
| Botón "Editar" de fila | `setEditingBranch` | `Link`/router a `/sucursales/[id]/editar` — los specs usan `getByRole('button', {name:'Editar'})` → cambiar a link mantiene `getByRole('link')`; **los specs que editan necesitan actualización mecánica** |

**Specs a actualizar (mecánico, mismo comportamiento)**: `sucursal-form-ux.spec.ts`, `sucursal-contactos-y-turnos.spec.ts`, `sucursal-eliminacion.spec.ts` — cambiar `goto('/sucursales')` + fill por `goto('/sucursales/nueva')` + fill; edición por `goto('/sucursales/${id}/editar')` o click en Editar + `waitForURL`. El helper `deleteBranchViaUi` (goto + fila + diálogo) no cambia. `tour.spec.ts`, `responsive.spec.ts`, `accessibility.spec.ts` siguen pasando sin cambios (agregar `/sucursales/nueva` a las listas de rutas auditadas es opcional pero recomendado).

| Prioridad | Impacto | Esfuerzo | Archivos |
| --- | --- | --- | --- |
| Mayor | Alta — jerarquía definitiva, edición con contexto, deep-link | M | `page.tsx`, `branch-list.tsx`, `branch-form.tsx` (mover), `branch-actions.tsx`, `routes.ts`, 2 `page.tsx` nuevos, `branch-help-card.tsx` nuevo, ~4 specs E2E |

### 3.4 Qué NO se propone

- Soft delete ni papelera de sucursales (hard delete es decisión archivada).
- Paginación de la tabla (innecesaria a esta escala; si N crece, `/usuarios` ya tiene el patrón `parsePaginationParams` + `ServerPagination` listo para copiar).
- Cambios de esquema ni de `Branch`/`BranchInput` (no hay hallazgo que lo justifique).
- Cambios en `branch-resolver`, en la API pública ni en `BranchInfoCard`/`BranchMap`/`BranchStatusChip` (consumidores sanos; el estado para la tabla se calcula con los helpers puros existentes).
- Migrar el diálogo de eliminación a `ConfirmDialog`: el genérico no soporta input de confirmación ni resumen de impacto.

---

## 4. Riesgos y puntos de regresión

| Área | Riesgo | Mitigación |
| --- | --- | --- |
| Tour | El paso "Sucursales" solo consume `branches-header`; reordenar o migrar rutas no lo afecta | Mantener el atributo en el `<h1>`; si se agrega paso para "Nueva sucursal", usar `routes.*` centralizadas |
| E2E — Tramo A | Ninguno verificado: ningún spec aserta el orden form↔tabla; `fill`/`check`/`click` hacen auto-scroll; las lecturas de celda usan `toHaveText` (textContent, sin exigir visibilidad) scopeadas a `branch-row` al viewport default (1280px > `md`) | A5 solo con breakpoints `hidden {bp}:table-cell`; el helper `waitForHydratedInput` sigue resolviendo igual |
| E2E — Tramo B | Specs que hacen `goto('/sucursales')` y llenan el form deben navegar primero | Lista exacta en §3.3; cambio mecánico documentado |
| A11y | `accessibility.spec.ts` audita `/sucursales` con axe `wcag21aa` | Los cambios de tabla/estado usan `Badge`/`role` existentes; re-correr el spec |
| Responsive | `responsive.spec.ts` cubre `/sucursales` a 375px y el diálogo de eliminación | La tabla con columnas ocultas mejora el caso; verificar h-scroll tras A5 |
| Eliminación | `sesion-sucursal-eliminada.spec.ts`, `sucursal-eliminacion.spec.ts` | A7 solo agrega banners/flags; el flujo nombre-exacto se mantiene; cualquier bloqueo nuevo (última sucursal/propia cuenta/resumen no cargado) debe quedar tras decisión del usuario |
| Datos públicos | El badge "En horario" del admin usa solo `openingHours`; el estado público real es `cajaAbierta && (!tieneHorarios \|\| isBranchOpen)` — divergen cuando la sucursal no tiene horarios (público: abierta si hay caja; admin: "Sin horarios") | Mostrar ambos estados o rotular explícito: badge = "En horario" (no "Abierto al público"). Si se quiere el estado real del canal, consultar `getOpenCashRegister` por sucursal en `page.tsx` (una query por fila — N chico, aceptable) |
| Resumen de impacto | El falso "Total: 0" ya está resuelto (H-M5): fallo de la consulta → error + Reintentar, y el submit queda bloqueado sin resumen válido. Persiste el TOCTOU inherente: el resumen se calcula al abrir el diálogo y puede divergir al confirmar | A7 suma los banners de flags al resumen ya cargado; el "Total" ahora incluye los hijos en cascada vía `countDeletionCascadeChildren` con línea aclaratoria (H-m12 resuelto) |
| Hidratación/perf | Agregar estado por fila es cálculo puro server-side; el badge queda congelado tras el SSR (sin polling) | Sin costo adicional — helpers ya importables; documentar la semántica "al momento de cargar" |

---

## 5. Ya resuelto en auditorías archivadas (no reabrir)

- Teléfonos múltiples (`phones[]`) y redes sociales normalizadas (`socialLinks[]`) con migración `0030_branch_contacts.sql`.
- Edición de todos los campos con el mismo formulario (D3).
- Horarios multi-franja, overnight (`close < open`), validación en vivo, errores de filas parciales, copiar/pegar entre días, conteo correcto de días únicos vs franjas.
- Preview de mapa, extracción segura del `src` de iframes, coordenadas y URLs soportadas por proveedor.
- Avisos de caja por turnos (`estadoTurno`/`alertaCaja` en `/api/caja/resumen` y `/api/panel/resumen`) + badge de turno + fallback sin horarios.
- Invalidación de caché (`branches`, `public-catalog`), protección de sesiones con sucursal eliminada, hard delete en cascada con limpieza de storage y rate-limit.

## 6. Cambios de esquema

**Ninguno propuesto.** Los flags del diálogo de eliminación (A7) se calculan en consulta, sin columnas nuevas.

## 7. Verificaciones para la fase de implementación

| Comando | Propósito |
| --- | --- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Tipos |
| `npm test` | Unitarios |
| `npm run build` | Build producción |
| `npm run knip` | Código muerto (ojo si se crea `branch-help-card.tsx`: debe quedar referenciado) |
| `npm run test:e2e` | Solo base descartable (`.env.e2e`) — specs: `sucursal-*`, `roles-y-sucursales`, `tour`, `responsive`, `accessibility`, `sesion-sucursal-eliminada`, `pedido-sucursal-*` |
| `npx playwright test tests/e2e/sucursal-form-ux.spec.ts tests/e2e/sucursal-contactos-y-turnos.spec.ts tests/e2e/sucursal-eliminacion.spec.ts` | Corrida acotada de los specs de mayor contrato (con `NO_WEB_SERVER=1` si el servidor E2E ya está levantado) |
| `npm run test:accessibility` | Subset axe si solo se toca markup |

---

## 8. Registro de revisiones

### Revisión v2 (2026-09-26)

Re-verificación completa del documento contra el código vigente. Todo lo afirmado en v1 se confirmó; cambios aplicados:

**Correcciones de precisión**

- `getDefaultBranchId` resuelve por **match exacto case-sensitive** (`findByName` → `eq`), no case-insensitive: A7/H-C1 ahora especifican comparación exacta contra `getDefaultBranchName()` (`src/lib/server-cache.ts:79-96`, `branchRepository.ts:35-39`).
- Semántica pública de "abierto" corregida: `open = cajaAbierta && (!tieneHorarios || isBranchOpen)` (`api/public/sucursal/estado/route.ts:32-37`) — **sin horarios el canal público la da por abierta si hay caja abierta**; ajustados §1.4, A4, A6 y la tabla de riesgos.
- El lockout (H-C1.2) depende del `branchId` **asignado** al usuario en la base (`session.user.branchId` revalidado), no de la sucursal activa de la cookie.
- Riesgo de A5 reformulado: `toHaveText` evalúa `textContent` y funciona sobre celdas ocultas; los specs corren a 1280px y ninguno usa `toBeVisible` sobre esas celdas → `hidden {bp}:table-cell` es seguro.
- `ProductHelpCard` se renderiza **dentro** del form de productos (arriba), no como tarjeta lateral — §3.3 aclarado.
- Guard inconsistente en la convención de productos: `nuevo` revalida sesión, `[id]/editar` no — §3.3 indica copiar el guard completo.
- H-m7 ampliado: `listBranches()` corre en el layout para todo admin en todas las páginas del panel, y se repite en `/sucursales` y `/usuarios`; sugerido `getCachedBranchList` (tag `branches` ya invalidado).
- Refs de líneas corregidas: `dialog.tsx` (74, 112), `branch-resolver.ts` (13-66), `page.tsx` (13-34), `branch-list.tsx` (39-113), `branchService.ts` (145-237), `branch-helpers.ts` (315-417), `branch-actions.tsx` (76-121).
- Agregados a §1.5: viewport fijo de `responsive.spec.ts`, `toHaveText`/`textContent` en contactos, specs `pedido-sucursal-*` sin dependencia de la UI, auto-scroll de Playwright y seed 24/7 de `global-setup.ts`.

**Hallazgos nuevos**

- **H-M5 (mayor)**: `handleOpenDelete` fabrica un resumen con conteos en cero si la consulta falla → el diálogo informa falsamente "0 registros afectados" y vuelve inalcanzable el mensaje "No se pudo cargar el resumen" (`branch-actions.tsx:76-100`). Se remedia dentro de A7.
- **H-C1 punto 4**: renombrar la sucursal por defecto en edición produce el mismo efecto que borrarla (`/pedido` caído en la URL canónica) sin ningún aviso → nuevo quick win A8.
- **H-m9 (menor)**: al fallar `deleteBranchAction` el diálogo de error se apila sobre el de confirmación (dos modales concurrentes) → sugerido error inline.

**Contexto agregado**

- `/sucursales` también es el destino defensivo del admin sin `branchId` (`auth.ts:157-160`) → A1 debe mantener el CTA de alta visible con tabla vacía.
- `ConfirmDialog` genérico existe pero no aplica al diálogo de eliminación (sin input de confirmación) → §2.4/§3.4.
- §3.3: las actions pueden seguir inyectadas por props o importarse directo en las nuevas páginas; `deleteBranchViaUi` no requiere cambios.

**Implementación parcial (2026-09-26, mismo día que la v2)**

Los tres hallazgos nuevos se implementaron de inmediato, sin tocar contratos E2E:

- **H-M5 resuelto**: `loadSummary` ya no fabrica un resumen en cero. El diálogo se abre solo tras la consulta; si falla muestra "No se pudo cargar el resumen de registros asociados" con botón **Reintentar** + Cancelar, y el formulario de confirmación no se renderiza hasta tener un resumen válido (`canConfirm` exige `summary` no nulo). El bloqueo de submit sin resumen quedó aplicado por defecto seguro.
- **H-m9 resuelto**: el segundo `Dialog` de error se eliminó; los errores de `deleteBranchAction` ahora se muestran **inline** en el diálogo de confirmación (`role="alert"`, `data-testid="branch-delete-error"`), con descarte del error viejo al cerrar (`dismissed`).
- **A8 implementado**: aviso "sucursal por defecto del catálogo público" bajo el campo nombre al editar la sucursal que coincide exacto con `DEFAULT_BRANCH_NAME`.
- **Test nuevo**: `src/components/sucursales/branch-actions.test.tsx` (3 tests: resumen + confirmación por nombre, regresión del resumen falso en cero, reintento).
- **Verificado**: `npx tsc --noEmit`, `eslint` sobre los archivos tocados, `jest` del spec nuevo (3/3) y `npm run knip` — todos verdes. Pendiente para CI: suite E2E completa (los contratos no cambiaron).

### Revisión v3 (2026-09-26)

Meta-revisión del propio informe contra el código post-implementación: la v2 declaraba resueltos H-M5, H-m9 y A8 y se confirmó que el working tree los contiene (`M` en `page.tsx`, `branch-list.tsx`, `branch-form.tsx`, `branch-actions.tsx` + `branch-actions.test.tsx` nuevo — todo **sin commit**). Verificaciones re-ejecutadas: `npx tsc --noEmit` ✅, `eslint` sobre los 5 archivos tocados ✅, `jest branch-actions.test.tsx` 3/3 ✅. Todas las afirmaciones estructurales se confirmaron (H-C1 completo, H-M1–H-M4, menores, contratos E2E/tour, semántica `open = cajaAbierta && (!tieneHorarios || isBranchOpen)`, orden de `deleteCascade`, inconsistencia de guards en `/productos`, `ConfirmDialog` insuficiente y `Sheet` inexistente, `MAX_LIMIT=100`). Cambios aplicados:

**Correcciones de precisión**

- §1.3: el flujo "Si falla la consulta del resumen" describía el `handleOpenDelete` previo al fix (fabricaba un resumen en cero); reescrito al `loadSummary` vigente (error + Reintentar, submit bloqueado sin resumen).
- §0 y §2.1 anotan que el escenario de renombrado del default ya tiene aviso (A8) y que H-M5 está resuelto; §4: la fila "Resumen de impacto" describía el defecto ya corregido (actualizada; queda el TOCTOU inherente resumen↔submit).
- §1.2: la celda de `branch-actions.tsx` mencionaba un "diálogo de error separado" ya eliminado (H-m9); actualizada al error inline.
- Refs corregidas post-A8: `branch-form.tsx` pasó de 806 a 819 líneas (refs internas desplazadas ~+13: §1.2, H-M2, H-m1, H-m6, H-m8); `branch-list.tsx` (§1.1, §1.2, H-M1, H-m1, H-m2); `branch-actions.tsx` (§1.2, H-M5); `sucursales/page.tsx` (§1.1, §1.2, H-m7).
- §1.5: `sucursal-form-ux.spec.ts` tiene **6 tests**, no 5; precisión del seed (`00:00–23:59` ×7, no 24/7 literal — gap de 1 min a la medianoche).
- `README.md` de informes: el estado decía "pendiente aprobación para implementar"; actualizado a implementación parcial.

**Hallazgos nuevos (menores)**

- **H-m10**: `confirmName` no se resetea al cerrar el diálogo → la confirmación queda pre-armada al reabrir (`branch-actions.tsx:92-99`).
- **H-m11**: `deleteButtonRef` asignada pero nunca leída — código muerto (`branch-actions.tsx:62,110`).
- **H-m12**: el "Total de registros afectados" solo suma las 8 tablas top-level; los hijos en cascada (`sale_items`, `order_items`, `order_messages`, `order_stock_reservations`, `sale_payments`, `sale_item_recipes`, `order_item_recipes`) no se cuentan → el total subestima el daño real.
- **H-m13**: `getBranchDeletionSummary` serializa el `Branch` completo al cliente cuando el diálogo solo muestra `branchName` por prop.

Los cuatro se absorben en el alcance de A7 (mismo componente y misma consulta). Pendiente sin cambios: **H-C1 puntos 1-3** (flags del diálogo + banners, con decisión del usuario sobre bloqueos) y los **Tramos A/B** de §3.

### Implementación Tramo A (2026-09-26)

Se implementó el Tramo A completo (A1–A8; A8 venía de la implementación parcial de v2) sin tocar ningún `data-testid`/`data-tour` existente ni spec E2E. Decisión del usuario registrada: **A7 solo advierte — no se bloquea la eliminación en ningún escenario** (ni última sucursal, ni propia cuenta, ni default, ni caja abierta).

**Cambios por ítem**

- **A1**: `BranchList` renderiza la tabla primero y el formulario después, bajo el mismo `data-tour="branches-table"`; el estado vacío agrega el enlace "Crear la primera sucursal" → `#nueva-sucursal`.
- **A2**: header de `page.tsx` con patrón de `/productos` y botón "Nueva sucursal" (`data-tour="branches-new"`) como ancla nativa `<a href="#nueva-sucursal">` (sin JS); el wrapper del form tiene `id="nueva-sucursal"` + `scroll-mt-20` por el header sticky del panel.
- **A3**: `branch-form.tsx` gana heading `data-testid="branch-form-heading"` ("Crear sucursal" / `Editar: {name}`) y, al montarse en modo edición, `scrollIntoView({block:'start'})` + foco al campo `name` (vía `form.elements.namedItem`, sin ref nuevo).
- **A4**: nuevo `getBranchOperationalStatus(branch, now)` en `branch-helpers.ts` (`state: 'in_hours'|'closed'|'no_hours'` + `detail`); `page.tsx` lo calcula en SSR por sucursal (`statusById`) — sin queries extra — y la celda Horarios muestra badge `En horario`/`Cerrado` + `N días · M franjas` + detalle. El badge rotula `title` explícito ("según horarios al cargar la página; el canal público además requiere caja abierta") y "Sin horarios" aclara que públicamente se considera abierta con caja abierta. La celda Nombre suma indicadores `Mapa`/`N tel.`/`N redes` (iconos lucide + `title` de detalle). No se agregó la query `getOpenCashRegister` por fila: el badge es de horario, no de estado público.
- **A5**: breakpoints de `/productos` aplicados — Dirección `hidden sm:table-cell`, Teléfono `hidden md:table-cell`, ID `hidden lg:table-cell`; sub-resumen `sm:hidden` bajo el nombre (dirección + primer teléfono + "+N"); `title` con el valor completo en celdas truncadas. El "+N" vive en el sub-resumen/chip, **no** en la celda `branch-phone`, porque `sucursal-contactos-y-turnos.spec.ts` aserta `toHaveText` exacto sobre ella.
- **A6**: textos de ayuda extendidos — Nombre ("se muestra en el catálogo público y debe ser único"), Dirección ("dirección de retiro en pedidos pickup") y Horarios ("alimentan el estado del catálogo y los avisos de caja por turnos; sin horarios, abierta si hay caja abierta"), con `aria-describedby` coherente con el patrón de Ubicación.
- **A7**: `getBranchDeletionSummary(id, currentUserBranchId?)` devuelve ahora `flags` (`isDefaultBranch` por match exacto con `getDefaultBranchName()`; `isSelfBranch` contra el `branchId` asignado del admin que la action obtiene de `requireAdmin`; `isLastBranch` vía nuevo `countBranches()`; `hasOpenCashRegister` y `activeOrders` como conteos nuevos al final de `countBranchDeletionImpact` — `status='open'`/`pending|in_process` + `deletedAt IS NULL`) y `counts.cascaded` (nuevo `countDeletionCascadeChildren`: ítems de ventas/pedidos, pagos, recetas aplicadas, mensajes y reservas — lo que borra el `ON DELETE CASCADE`). `counts.total` = top-level + cascaded, con línea aclaratoria en el diálogo. El diálogo muestra un banner destructivo por flag (`branch-delete-warning-last/self/default/open-register/active-orders`). Absorbidos: **H-m10** (`setConfirmName('')` al cerrar), **H-m11** (`deleteButtonRef` eliminado), **H-m12** (total ya no subestima), **H-m13** (`branch: {id, name}`; el tipo del cliente se infiere de la action).

**Tests actualizados**: `branch-actions.test.tsx` (+3: banners y línea de cascada, ausencia de banners sin flags, regresión H-m10 de reset de `confirmName`), `branchRepository.test.ts` (+2 describes: `countDeletionCascadeChildren` con/sin padres, `countBranches`; `countBranchDeletionImpact` extendido con `openCashRegisters`/`activeOrders`), `branchService.test.ts` (payload slim, flags del escenario destructivo con env `DEFAULT_BRANCH_NAME`, `isSelfBranch` por parámetro).

**Verificado**: `npx tsc --noEmit` ✅, `eslint` sobre los archivos tocados ✅, `jest` suite completa 1952/1952 ✅, `npm run knip` ✅, `npm run build` ✅, y E2E acotada contra la base descartable (`sucursal-form-ux`, `sucursal-contactos-y-turnos`, `sucursal-eliminacion`, `responsive`, `accessibility`): **25/25 ✅** — contratos intactos.

**Quedaba pendiente al cerrar el Tramo A**: Tramo B (rutas dedicadas §3.3) y los menores ajenos al tramo (H-m1, H-m3–H-m8) — ambos implementados a continuación.

### Implementación menores (2026-09-26)

Commit `9aa5b3f`. Se resolvieron los menores ajenos al tramo:

- **H-m1**: los `data-testid` de los inputs del form pasaron a `branch-form-name`/`branch-form-address` (antes duplicaban los de las celdas de tabla `branch-name`/`branch-address`).
- **H-m3**: `createBranch`/`updateBranchAction`/`deleteBranchAction` normalizan errores no-`DomainError` a mensajes genéricos en español (nunca `error.message` crudo); el error de borrado se muestra inline en el diálogo (`branch-delete-error`) en vez de relanzar al error boundary.
- **H-m4**: `schema.ts` reusa los tipos `BranchOpeningHours`/`BranchPhone`/`BranchSocialLink` de `domain/types.ts`; `branch-form.tsx` importa `DAYS` de `branch-helpers.ts`.
- **H-m5**: `sr-only "Close"` y el "Close" del footer de `dialog.tsx` pasaron a "Cerrar". La traducción generó un nombre accesible duplicado en diálogos que ya tenían un botón "Cerrar" propio (éxito de pedido: X + footer) — se desambiguó con `data-testid="order-success-close"` en el botón de footer y se actualizaron los tests/specs (`pedido-client.test.tsx`, `stock-list.test.tsx`, `pedido-cancelacion-panel`, `pedido-reserva-flujo`, `pedido-sucursal-y-stock`, `productos-y-recetas`).
- **H-m6**: checkbox de día a `h-6 w-6` (24px, WCAG 2.2 SC 2.5.8).
- **H-m7**: nuevo `listBranchesForRequest` en `server-cache.ts` (`React.cache` por request) reemplaza los `listBranches()` sueltos de `(panel)/layout.tsx`, `sucursales/page.tsx`, `usuarios/page.tsx` y las páginas de ventas — una query por request.
- **H-m8**: al desmarcar un día las franjas se guardan en `disabledDaySlots` y se restauran al remarcar; el día simplemente no viaja en el payload.

**Verificado**: `npx tsc --noEmit` ✅, `eslint` ✅, jest de los archivos tocados 116/116 ✅, `npm run knip` ✅.

### Implementación Tramo B (2026-09-26)

Alta y edición migradas a rutas dedicadas espejando `/productos`, siguiendo §3.3:

- **Rutas nuevas**: `routes.sucursalesNueva` (`/sucursales/nueva`) y `routes.sucursalesEditar(id)` (`/sucursales/[id]/editar`) en `src/config/routes.ts`.
- **`sucursales/nueva/page.tsx`**: guard completo (`auth` + `revalidateSessionUser` + rol `admin`, redirect a `routes.home`), heading "Nueva sucursal", `BranchForm` en modo crear dentro de `data-tour="branch-form"`.
- **`sucursales/[id]/editar/page.tsx`**: mismo guard; `params.id` validado con `Number.isInteger` (NaN → `notFound()`); `branchService.getBranchById` + `notFound()` si no existe; `isDefaultBranch` por match exacto con `getDefaultBranchName()` para el aviso A8.
- **`branch-list.tsx`**: pierde `BranchForm`, el estado `editingBranch` y el prop `defaultBranchName` — queda solo el inventario bajo `data-tour="branches-table"`; el CTA del estado vacío es `Link` a `routes.sucursalesNueva`.
- **`branch-actions.tsx`**: "Editar" es `Link` → `routes.sucursalesEditar(branchId)` envolviendo `Button` (patrón `/productos`: conserva `getByRole('button', {name:'Editar'})` en los specs); `onEdit` eliminado.
- **`branch-form.tsx`**: `onCancel` reemplazado por `router.push(routes.sucursales)`; tras guardar con éxito navega al inventario + `router.refresh()` (la fila confirma el cambio); `BranchHelpCard` renderiza arriba dentro del form (patrón `ProductHelpCard`); el heading dinámico y el scroll/foco de A3 se conservan.
- **`sucursales/page.tsx`**: header con `Link` a `/sucursales/nueva` (`data-tour="branches-new"`); deja de pasar `defaultBranchName` (el aviso vive en la ruta de edición).
- **`branch-help-card.tsx`** (nuevo): tarjeta de ayuda downstream (nombre/default, horarios↔estado público, dirección↔retiro pickup, contactos↔catálogo/pedido).
- **Contratos**: `data-tour` sin duplicar (`branches-header`/`branches-new` en `/sucursales`, `branches-table` en el list, `branch-form` en las páginas dedicadas); testids del form (`branch-form-*`, `branch-form-heading`, `branch-cancel`, `branch-location*`, `branch-phone-*`, `branch-social-*`, `branch-day-*`, `branch-slot-*`) viajan con el form; testids de tabla (`branch-row`, `branch-name`, `branch-address`, `branch-phone`, `branch-opening-hours`, `branch-schedule-status`, `delete-branch-${id}`) quedan en la tabla.

**Specs E2E actualizados**: `sucursal-form-ux.spec.ts` (altas → `/sucursales/nueva`, edición → click en Editar + `waitForURL('/sucursales/{id}/editar')`; el helper `deleteBranchViaUi` sigue en `/sucursales`), `sucursal-contactos-y-turnos.spec.ts` (idem), `sucursal-eliminacion.spec.ts` (creación → `/nueva`, borrado sigue desde la tabla), `accessibility.spec.ts` (+`/sucursales/nueva` en rutas auditadas), y los specs de pedido/productos por la colisión "Cerrar" (H-m5).

**Verificado**: `npx tsc --noEmit` ✅, `eslint` ✅, jest suite completa 1952/1952 ✅ (incluye fix de la colisión "Cerrar": `pedido-client.test.tsx` ×2 → `order-success-close`, `stock-list.test.tsx` ×2 → `name:'Cerrar'`), `npm run knip` ✅, `npm run build` ✅ (rutas `/sucursales/nueva` y `/sucursales/[id]/editar` generadas), y E2E acotada contra la base descartable (`sucursal-form-ux`, `sucursal-contactos-y-turnos`, `sucursal-eliminacion`, `accessibility`, `responsive`, `pedido-cancelacion-panel`, `pedido-reserva-flujo`, `pedido-sucursal-y-stock`, `productos-y-recetas`): **44/44 ✅**.
