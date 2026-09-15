# Auditoría y plan: sección Sucursales y avisos de caja por turnos

> Estado: **Resuelto e implementado por completo** (D1–D6 aplicadas;
> hallazgos de la re-auditoría en §8). Las observaciones de §8.3 se
> implementaron el 2026-09-14 (commit `a3d70d5`): doble punto en `message`,
> columnas de resumen en `branch-list`, badge `CashRegisterShiftBadge` que
> consume `estadoTurno` en la UI y corrección del warning de hidratación.
> Migración `drizzle/0030_branch_contacts.sql` aplicada en desarrollo y E2E.
> Actualizado el 2026-09-13 con las decisiones del usuario, el estado final y
> la auditoría post-implementación; archivado el 2026-09-15.
> Alcance: `src/app/(panel)/sucursales`, `src/components/sucursales`,
> `src/lib/branch-helpers.ts`, `src/lib/cash-register-helpers.ts`,
> `src/config/{branch,caja}.ts`, servicios y los 4 componentes con avisos.

## 0. Decisiones tomadas (resumen)

| # | Decisión | Resolución |
|---|---|---|
| D1 | Columna `phone` | **Se migra a `phones[0]` (label "Principal") y se dropea la columna.** |
| D2 | Semántica del aviso de cierre | **Literal**: el aviso dispara al inicio del **primer turno posterior a la apertura** de la caja (sin ancla). Análisis de impacto en §4.4 — incluye mitigación de mensaje y flag de reversa. |
| D3 | Fuente de horarios | **Horarios vigentes** de la sucursal (sin snapshot). Además: **todos** los campos (días, horarios, ubicación, redes, teléfonos) se cargan al crear y son editables siempre — mismo formulario para alta y edición. |
| D4 | Exposición pública | **Sí**: teléfonos y redes se exponen en `/pedido`, diálogo de éxito y chat. |
| D5 | Turnos overnight | **Sí**: `close < open` significa "termina al día siguiente". |
| D6 | Sin horarios | **Fallback legacy** (fecha calendario + umbral configurable) — pero la expectativa es que los horarios se configuren siempre desde el formulario. |

## 1. Diagnóstico de la implementación actual

### 1.1 Modelo de datos

- Tabla `branches` (`src/db/schema.ts:85-96`): `id`, `name` (unique),
  `openingHours` jsonb, `address`, `phone`, `location`, `createdAt`.
- `BranchOpeningHours = { dayOfWeek: 0-6, open: 'HH:mm', close: 'HH:mm' }`
  está **duplicado** en `src/db/schema.ts:79-83` y `src/domain/types.ts:45-49`.
- `phone` es `varchar(50)` libre: sin validación de formato en cliente ni
  servidor. No existen teléfonos múltiples ni redes sociales.
- `location` sí se valida (`branchService.normalizeLocation` →
  `tryBuildLocationUrl`/`isValidLocationUrl` en `src/lib/maps.ts`): acepta URLs
  http(s) o coordenadas `lat,lng` normalizadas según `NEXT_PUBLIC_MAPS_*`.

### 1.2 Formulario y UX (`src/components/sucursales/`)

- `branch-form.tsx`: nombre, dirección, UN teléfono, ubicación y editor de
  horarios por día con franjas múltiples. El mismo componente sirve para crear
  y editar (patrón a mantener para los campos nuevos, ver D3).
- Hallazgos:
  - `parseOpeningHoursForm` (`branch-helpers.ts:78-104`) **descarta en
    silencio** franjas incompletas (open sin close): el usuario cree que guardó
    un horario y desaparece sin aviso.
  - Sin validación client-side de `close > open`; el error llega del server
    action. Tampoco hay indicio de que los horarios se interpretan en
    `NEXT_PUBLIC_BRANCH_TIMEZONE`.
  - Turnos overnight (`20:00–02:00`) imposibles: `validateOpeningHours` exige
    `close > open` (`branch-helpers.ts:43-47`).
  - `branch-list.tsx` solo muestra nombre e ID: dirección, teléfono y horarios
    no se ven sin entrar a editar.
  - Interfaces `Branch` **duplicadas localmente** en `branch-form.tsx:17-24` y
    `branch-list.tsx:20-27` en vez del tipo de dominio → drift al agregar
    campos.
  - `createBranch`/`updateBranch` reciben **parámetros posicionales**
    `(name, openingHours, address, phone, location)` → se migra a objeto
    `BranchInput` para soportar los campos nuevos sin romper firmas.

### 1.3 Exposición pública de datos de sucursal

| Canal | Campos expuestos hoy |
|---|---|
| `/pedido` SSR (`listPublicBranches`, `branch-resolver.ts:30-38`) | `id`, `name`, `openingHours`, `createdAt` (recorta el resto) |
| `catalogService.getBranch` → `PedidoClient.activeBranch` | fila completa |
| `GET /api/public/sucursal/estado` | `id`, `name`, `openingHours`, `address`, `phone`, `location` |
| `BranchInfoCard` (`pedido-client.tsx:37-114`) | nombre, abierto/cerrado, horarios, dirección, teléfono, "Ver en mapa" |
| `pedido-success-dialog.tsx:155-178` | address, phone, location |
| Chat (`chatService.ts:160,249,283`) | `branchLocation` solamente |
| `sendBranchLocation` (`chatService.ts:402-415`) | envía `location` como mensaje (solo pickup) |

### 1.4 Avisos de caja — lógica actual

`src/lib/cash-register-helpers.ts`:

- `isCashRegisterFromPreviousDay(openedAt, tz, now)`: compara fecha civil de
  apertura con la de hoy → **dispara a las 00:00 aunque la sucursal siga
  dentro de un turno nocturno**.
- `isCashRegisterOverdue(openedAt, threshold=12, now)`: umbral fijo
  `CASH_REGISTER_OVERDUE_HOURS = 12` **hardcodeado** — ignora `openingHours` y
  viola la regla "nada hardcodeado".

Renderizados en 4 lugares, todos con el mismo par de avisos ámbar:

1. `caja-panel.tsx:168-201` (`/cierre`, vía `useCashRegister` → `GET /api/caja/resumen`)
2. `caja-status.tsx:188-225` (`/ventas`, mismo hook)
3. `cash-register-summary.tsx:77-78,192-203` (usado por `caja-panel` con datos
   del API y por `ventas/historial/[id]/page.tsx` por SSR)
4. `dashboard-client.tsx:118-172` (`/` vía `useDashboard` → `GET /api/panel/resumen`)

**Punto clave**: ningún payload incluye `openingHours` de la sucursal → el
estado por turnos se computa **en el servidor** dentro de
`getOpenCashRegisterSummary` (`cashRegisterService.ts:188-204`), que es el
punto único que alimenta a `/api/caja/resumen` y `/api/panel/resumen`.
Beneficios: una sola fuente de verdad, sin skew de reloj del cliente, y el
polling existente (5 s panel / 30 s dashboard) refresca el aviso sin reload.

### 1.5 Inconsistencias detectadas

- "Caja del día anterior" es falso para cajas dentro de un turno nocturno.
- Los textos de aviso están duplicados en 4 componentes con variantes mínimas.
- En `/api/public/sucursal/estado` (`route.ts:28`): `open = cajaAbierta &&
  isBranchOpen(branch)` → una sucursal **sin horarios nunca figura abierta**
  aunque tenga caja abierta. Fix propuesto: `isBranchOpen` solo exigirse
  cuando hay horarios configurados (§5, ítem 11).

## 2. Eje A — Personalización de la sucursal

### 2.1 Modelo de datos

Dos columnas jsonb nuevas en `branches` (precedente: `openingHours`; volumen
bajo, siempre se leen/escriben con la sucursal → no justifica tabla hija):

```ts
// src/domain/types.ts
export type BranchPhone = {
  label: string;   // "Pedidos", "WhatsApp", "Local"…
  number: string;  // validación permisiva: dígitos, +, espacios, (), -
};

export type BranchSocialNetwork =
  | 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'x' | 'web' | 'otro';

export type BranchSocialLink = {
  network: BranchSocialNetwork;
  url: string;     // URL canónica ya normalizada
};

export type Branch = {
  id: number;
  name: string;
  openingHours: BranchOpeningHours[];
  address?: string | null;
  phones: BranchPhone[];            // NUEVO (reemplaza a phone)
  socialLinks: BranchSocialLink[];  // NUEVO
  location?: string | null;
  createdAt: Date;
};
```

```ts
// src/db/schema.ts
phones: jsonb('phones').$type<BranchPhone[]>().default([]).notNull(),
socialLinks: jsonb('social_links').$type<BranchSocialLink[]>().default([]).notNull(),
// phone: eliminada (D1)
```

**Migración** (`npx drizzle-kit generate` + edición manual del SQL generado,
patrón ya usado para datos custom):

```sql
ALTER TABLE branches ADD COLUMN phones jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE branches ADD COLUMN social_links jsonb DEFAULT '[]'::jsonb NOT NULL;
UPDATE branches
   SET phones = jsonb_build_array(
     jsonb_build_object('label', 'Principal', 'number', phone))
 WHERE phone IS NOT NULL AND btrim(phone) <> '';
ALTER TABLE branches DROP COLUMN phone;
```

Verificar con `npx drizzle-kit check` que no quede drift.

### 2.2 Validación y normalización

Nuevas funciones en `src/lib/branch-helpers.ts` (o `branch-contacts.ts`):

```ts
export function validateBranchPhones(p: unknown): asserts p is BranchPhone[]
// label: string no vacío (≤ ~50 chars); number: /^[+()\-.\s\d]{5,25}$/
// sin duplicados exactos

export function normalizeSocialLinks(links: unknown): BranchSocialLink[]
// Acepta URL completa o handle ('@usuario'/'usuario') y normaliza por red:
//   instagram → https://instagram.com/<handle>
//   facebook  → https://facebook.com/<handle>
//   tiktok    → https://tiktok.com/@<handle>
//   whatsapp  → https://wa.me/<solo dígitos>
//   x         → https://x.com/<handle>
//   web/otro  → URL http(s) tal cual
// Rechaza protocolos ≠ http(s) — mismo criterio que isValidLocationUrl.

export function parseContactsForm(formData: FormData): {
  phones: BranchPhone[];
  socialLinks: BranchSocialLink[];   // crudos; normaliza el servicio
}
// keys: phones[i][label], phones[i][number], social[i][network], social[i][value]
```

Servicio — firma a objeto (D3):

```ts
export interface BranchInput {
  name: string;
  openingHours?: BranchOpeningHours[];
  address?: string | null;
  phones?: BranchPhone[];
  socialLinks?: unknown;        // se normaliza con normalizeSocialLinks
  location?: string | null;
}
export async function createBranch(input: BranchInput): Promise<Branch>
export async function updateBranch(id: number, input: BranchInput): Promise<Branch>
```

### 2.3 Formulario (alta y edición — D3)

- Mismo `BranchForm` para crear y editar: todos los campos nuevos aparecen en
  ambos flujos; los valores actuales precargan en edición.
- Repeaters con el patrón de franjas existente:
  - Teléfonos: `[label][número][eliminar]` + "Agregar teléfono"
    (`name="phones[i][label]"`, `phones[i][number]`).
  - Redes: `[select red][handle o URL][eliminar]` + "Agregar red"
    (`social[i][network]`, `social[i][value]`).
- Fixes de UX: bloquear submit (o resaltar) si una franja quedó con un solo
  campo; hint "si el cierre es anterior a la apertura, el turno termina al día
  siguiente"; mencionar la timezone activa junto al editor de horarios.
- `BranchList`: columnas Dirección / Teléfonos / Horarios (resumen con
  `formatOpeningHours` truncado) + reemplazar interfaces locales por `Branch`
  de dominio en ambos componentes.

### 2.4 Exposición pública (D4 — confirmado)

- Nuevo tipo `PublicBranchInfo = Pick<Branch, 'id'|'name'|'openingHours'|
  'address'|'phones'|'socialLinks'|'location'|'createdAt'>` usado por:
  - `listPublicBranches` (`branch-resolver.ts`).
  - `GET /api/public/sucursal/estado` (campo `branch`).
- `BranchInfoCard` (`/pedido`): teléfonos como links `tel:` con su etiqueta;
  redes como links con icono (lucide cubre Instagram/Facebook; para
  TikTok/WhatsApp/X usar icono genérico `Link`/`Share2` + nombre de red).
- `pedido-success-dialog`: bloque "Contacto" con teléfonos y redes.
- Chat: `ChatMessagesResult` suma `branchContacts: { phones, socialLinks }`
  (mismo fetch de `branch` que ya hace `chatService`); UI opcional: botón
  "WhatsApp" en el encabezado del chat si existe una red `whatsapp` o un
  teléfono etiquetado como tal.

## 3. Eje B — Avisos de caja por turnos

### 3.1 Semántica de "turno" y overnight (D5)

- **Cada franja `{dayOfWeek, open, close}` es un turno.** No se fusionan
  franjas del mismo día.
- `close < open` ⇒ el turno termina **al día siguiente** (`20:00–02:00` =
  Lunes 20:00 → Martes 02:00). `close === open` sigue siendo inválido.
- No requiere migración: el formato jsonb no cambia; cambian validación y
  cálculos.
- `validateOpeningHours` se reescribe para chequear solapamientos sobre
  **intervalos absolutos dentro de la semana** (minutos 0–10080), no solo por
  día: un turno Lunes 20:00–02:00 ocupa Martes 00:00–02:00 y debe rechazarse
  si solapa con un turno Martes 01:00–03:00. Para cubrir el wraparound
  (Domingo 20:00–02:00 vs Lunes 00:00–02:00) se expanden los intervalos sobre
  el rango de días `[-1..7]` y se verifica superposición par a par.

### 3.2 Helpers nuevos

`src/lib/branch-helpers.ts` (puros, server-safe):

```ts
export type ShiftInterval = {
  dayOfWeek: number;  // día civil de INICIO del turno (en tz de la sucursal)
  open: string;
  close: string;
  start: Date;        // instante absoluto
  end: Date;          // start + duración; cruza medianoche si close < open
};

/** local 'HH:mm' del día civil (y,m,d) en `timeZone` → instante UTC.
 *  Implementación: medir el offset de la tz con Intl.DateTimeFormat en doble
 *  pasada (corrige cambios de offset/DST). No requiere date-fns-tz. */
function localTimeToUtc(
  year: number, month: number, day: number,
  hhmm: string, timeZone: string
): Date

/**
 * Expande las franjas a intervalos absolutos cubriendo [from, to].
 * Incluye el día civil previo a `from` para capturar turnos overnight que
 * siguen vigentes al inicio del rango.
 */
export function buildShiftIntervals(
  openingHours: BranchOpeningHours[],
  from: Date,
  to: Date,
  timeZone: string = getBranchTimezone()
): ShiftInterval[]
```

Refactor de los helpers existentes para reusar `buildShiftIntervals` (así el
overnight queda soportado en todos lados con una sola implementación):
`isBranchOpen`, `getTodayOpening`, `getNextOpening`,
`getCurrentOrNextOpening`. `formatOpeningHours` muestra `20:00 - 02:00` tal
cual (la interpretación "al día siguiente" va como hint en el form).

`src/lib/cash-register-helpers.ts`:

```ts
export type CashRegisterShiftStatus =
  | 'en_turno'           // caja dentro del turno vigente y abierta en él
  | 'fuera_de_horario'   // caja abierta fuera de todo turno
  | 'recomendar_cierre'  // ya arrancó (o pasó) un turno posterior a la apertura
  | 'sin_horarios';      // sucursal sin openingHours → fallback legacy

export type CashRegisterShiftInfo = {
  status: CashRegisterShiftStatus;
  /** true si `openedAt` cayó dentro de un turno (no en un hueco). */
  aperturaEnTurno: boolean;
  currentShift: ShiftInterval | null;
  nextShiftStart: Date | null;
};

export function getCashRegisterShiftStatus(
  openedAt: Date | string,
  openingHours: BranchOpeningHours[] | null | undefined,
  now: Date = new Date(),
  timeZone: string = getBranchTimezone()
): CashRegisterShiftInfo
```

### 3.3 Pseudo-código (semántica literal — D2)

```
si openingHours vacío                → { status: 'sin_horarios' }

intervals  = buildShiftIntervals(hours, from = openedAt − 1d, to = now + 8d, tz)
current    = intervalo con start <= now < end
aperturaEnTurno = ∃ S: S.start <= openedAt < S.end

si current && openedAt >= current.start          → 'en_turno'
si ∃ S: openedAt < S.start <= now                → 'recomendar_cierre'
en otro caso                                     → 'fuera_de_horario'
```

Notas de corrección:
- Si `current` existe y `openedAt < current.start`, el propio `current`
  satisface la segunda condición → `recomendar_cierre`. Ordenar los checks
  como arriba evita el doble cómputo.
- Si `openedAt >= current.start`, ningún otro turno pudo empezar en
  `(openedAt, now]` (los turnos no solapan) → `en_turno` es exhaustivo.

### 3.4 Alerta resuelta y payload

Capa de mapeo única (usada por el servicio y por la página SSR):

```ts
export type CashRegisterAlertCode =
  | 'fuera_de_horario'      // info  — semántica nueva
  | 'cierre_recomendado'    // warning— semántica nueva
  | 'dia_anterior'          // warning— fallback legacy
  | 'excedida';             // warning— fallback legacy

export type CashRegisterAlert = {
  code: CashRegisterAlertCode;
  severity: 'info' | 'warning';
  detalle?: {
    horasUmbral?: number;      // para 'excedida'
    aperturaEnTurno?: boolean; // para 'cierre_recomendado' (ajusta el texto)
    proximoTurno?: string;     // ISO — para 'fuera_de_horario'
  };
};

export function resolveCashRegisterAlert(
  openedAt: Date | string,
  openingHours: BranchOpeningHours[] | null | undefined,
  now?: Date,
  timeZone?: string
): CashRegisterAlert | null
// sin_horarios → dia_anterior (isCashRegisterFromPreviousDay)
//              → excedida      (isCashRegisterOverdue con getCajaOverdueHours())
// en_turno     → null
```

Payload de `getOpenCashRegisterSummary` (viaja a `/api/caja/resumen` y
`/api/panel/resumen`):

```ts
{
  ...cashRegister, ...summary, cashInDrawer,
  estadoTurno: CashRegisterShiftInfo,   // para textos con contexto
  alertaCaja: CashRegisterAlert | null, // lo único que necesita la UI
}
```

`src/config/caja.ts`:
- `getCajaOverdueHours()` — env `CAJA_OVERDUE_HOURS`, default 12 (solo
  servidor; el umbral viaja en `alertaCaja.detalle.horasUmbral`).
- `isCashRegisterOverdue` cambia su default a `getCajaOverdueHours()`.
- Interfaz `CashRegister` suma `estadoTurno?` y `alertaCaja?` (tipos desde
  `domain/types.ts`).

### 3.5 Componentes

Nuevo `src/components/caja/cash-register-alert.tsx` — banner único
parametrizado por `alertaCaja` (reemplaza los 4 bloques duplicados). Textos:

| code | Título | Cuerpo |
|---|---|---|
| `fuera_de_horario` (info) | "Fuera de horario de atención" | "La sucursal está fuera de su horario configurado{, próximo turno a las HH:mm}. Podés seguir operando con normalidad." |
| `cierre_recomendado` + `aperturaEnTurno` (warning) | "Caja de un turno anterior" | "Esta caja se abrió en un turno anterior. Cerrala antes de abrir una nueva." |
| `cierre_recomendado` + `!aperturaEnTurno` (warning) | "Caja abierta fuera de turno" | "Esta caja se abrió fuera del turno vigente. Recomendamos cerrarla y abrir una nueva del turno." |
| `dia_anterior` (warning) | "Caja del día anterior" | texto actual |
| `excedida` (warning) | "Caja abierta hace más de {horasUmbral} horas" | texto actual parametrizado |

La distinción `aperturaEnTurno` es la mitigación pedida en D2: bajo semántica
literal, una caja abierta en un hueco no "pertenece a un turno anterior" —
el texto alternativo lo dice correctamente.

Nada se bloquea: los avisos son informativos en todos los estados.

### 3.6 Tabla de estados (semántica literal)

Sucursal ejemplo: L–S `11:00–14:00` y `19:00–23:00`.

| Situación | Estado | Aviso |
|---|---|---|
| Abierta 12:00, ahora 13:00 | en_turno | — |
| Abierta 12:00, ahora 15:00 (hueco) | fuera_de_horario | info |
| Abierta 12:00, ahora 19:30 | recomendar_cierre | warning (desde 19:00) |
| Abierta 18:30 (prep), ahora 19:30 | recomendar_cierre | warning ⚠ — ver §4.4 |
| Abierta 08:00, ahora 08:30 | fuera_de_horario | info |
| Abierta 08:00, ahora 11:05 | recomendar_cierre | warning ⚠ — ver §4.4 |
| Overnight 20:00–02:00: abierta 21:00, ahora 01:00 | en_turno | — (no dispara a las 00:00) |
| Sin horarios + abierta ayer | dia_anterior (fallback) | warning |
| Sin horarios + abierta hace >12 h (mismo día) | excedida (fallback) | warning |

### 3.7 Casos borde — resolución

| Caso | Resolución |
|---|---|
| Overnight 20:00–02:00 | `close < open` → end al día siguiente; caja de las 21:00 queda `en_turno` hasta las 02:00. |
| Sin horarios | Fallback legacy: `dia_anterior` o `excedida` con `CAJA_OVERDUE_HOURS` (default 12). |
| Caja abierta en día sin turnos | `fuera_de_horario` hasta que arranque el próximo turno → `cierre_recomendado` (literal: ese turno ya es "posterior a la apertura"). |
| Múltiples franjas el mismo día | Cada franja = turno. Caja del turno 1 abierta al llegar el turno 2 → `cierre_recomendado`. |
| Caja abierta en hueco previo a un turno | `fuera_de_horario` inmediato (informativo) → `cierre_recomendado` al iniciar ese turno (literal — D2). |
| Cambio de horarios con caja abierta | Estado recalculado con la config vigente en el próximo fetch (D3). |
| Timezone | Todo en `getBranchTimezone()`; `openedAt`/`now` son instantes absolutos. |
| Turnos 00:00–23:59 diarios (setup E2E) | Al cruzar 00:00 arranca el turno del día siguiente → `cierre_recomendado` ≈ "día anterior" actual. Compatible. |

## 4. Análisis profundo — D2 (literal vs. ancla)

Pediste elegir la **literal** pero verificar el impacto. Ambas opciones son
**idénticas** para el caso del requerimiento (caja abierta *dentro* de un
turno → aviso al iniciar el siguiente). Solo difieren cuando la caja se abrió
**fuera de un turno** (en un hueco o antes del primer turno del día).

### 4.1 Comparativa con la sucursal ejemplo (11–14 y 19–23)

| Escenario | Literal (elegida) | Ancla (alternativa) |
|---|---|---|
| Abierta 12:00 en turno 1, sigue a las 19:30 | aviso a las 19:00 | aviso a las 19:00 (idéntico) |
| Abierta 18:30 para preparar el turno de 19:00 | **aviso a las 19:00** — falso positivo diario | sin aviso (pertenece al turno de 19:00) |
| Abierta 08:00 antes del primer turno | `fuera_de_horario` → aviso a las 11:00 | `fuera_de_horario` → `en_turno` a las 11:00 |
| Abierta 15:30 en el hueco y **olvidada** | aviso a las 19:00 (detecta un turno antes) | aviso al inicio del turno siguiente al ancla |
| Caja abierta 15:30 usada en el turno de 19:00 | aviso a las 19:00 pese a estar "en su turno" | sin aviso |

### 4.2 Impacto real de la literal

- **Costo**: el operador que abre la caja 30–60 min antes del primer turno
  (práctica habitual para contar el fondo) ve "cerrala antes de abrir una
  nueva" **todos los días al abrir la sucursal**. Un aviso que se repite en
  falso genera fatiga y termina ignorándose cuando importa.
- **Beneficio**: es la regla más estricta ("una caja = un turno, sin
  excepciones") y detecta antes las cajas olvidadas abiertas en huecos. Si el
  negocio quiere control de efectivo estrictamente por turno, el aviso en
  aperturas tempranas es un recordatorio legítimo, no un bug.
- **Mitigación ya especificada**: el flag `aperturaEnTurno` permite texto
  honesto ("abierta fuera del turno vigente" vs "de un turno anterior").

### 4.3 Veredicto

La literal es correcta **si la regla de negocio es "caja por turno estricta"**.
Si abrir temprano para preparar es práctica normal, la ancla evita el falso
positivo diario. Diferencia de implementación: una condición en el helper
(`S.start > openedAt` vs. `S.start > anchor.start`). La especificación queda
con la **literal** (tu elección); si tras leer esto preferís la ancla, es un
cambio localizado en `getCashRegisterShiftStatus` + tests — avisame y lo
ajusto antes de implementar.

## 5. Lista ordenada de cambios por archivo

### Fase 1 — Modelo, helpers y servicios

1. `src/db/schema.ts` — `phones`, `social_links`; drop `phone` con backfill
   (SQL custom en la migración generada). `drizzle-kit generate` + `check`.
2. `src/domain/types.ts` — `BranchPhone`, `BranchSocialNetwork`,
   `BranchSocialLink`, `Branch` actualizado, `PublicBranchInfo`,
   `CashRegisterShiftStatus`/`CashRegisterAlert` (tipos).
3. `src/config/branch.ts` — getters de contacto del seed
   (`DEFAULT_BRANCH_PHONE` → `phones[0]`; `DEFAULT_BRANCH_SOCIAL_LINKS` JSON;
   ídem `NEW_BRANCH_*`).
4. `src/lib/branch-helpers.ts` — `localTimeToUtc`, `buildShiftIntervals`,
   `validateBranchPhones`, `normalizeSocialLinks`, `parseContactsForm`;
   overnight en `validateOpeningHours` (overlap cross-day), `isBranchOpen`,
   `getTodayOpening`, `getNextOpening`, `getCurrentOrNextOpening`.
5. `src/config/caja.ts` — `getCajaOverdueHours()` (`CAJA_OVERDUE_HOURS`,
   default 12); interfaz `CashRegister` + `estadoTurno`/`alertaCaja`.
6. `src/lib/cash-register-helpers.ts` — `getCashRegisterShiftStatus`,
   `resolveCashRegisterAlert`; `isCashRegisterOverdue` con default de config.
7. `src/application/services/branchService.ts` — `BranchInput` (objeto),
   validar phones/social, normalizeLocation igual.
8. `src/application/services/cashRegisterService.ts` —
   `getOpenCashRegisterSummary` suma `branchService.getBranchById` (no hay
   dependencia circular: branchService no importa cashRegisterService) y
   computa `estadoTurno`/`alertaCaja`.
9. `src/app/(panel)/sucursales/actions.ts` — `parseContactsForm` + pasar
   `BranchInput`.
10. `src/app/(panel)/ventas/historial/[id]/page.tsx` — fetch de branch
    siempre (hoy solo admin) y pasar `alerta` computada con
    `resolveCashRegisterAlert`.
11. `src/app/api/public/sucursal/estado/route.ts` — exponer `phones`,
    `socialLinks`; fix `open = cajaAbierta && (sin horarios || isBranchOpen)`.
12. `src/lib/branch-resolver.ts` — `listPublicBranches` → `PublicBranchInfo`.
13. `src/db/seeds.ts` — cargar phones/social desde env en ambas sucursales.

### Fase 2 — UI

14. `src/components/sucursales/branch-form.tsx` — repeaters, hint overnight,
    fix franja incompleta, tipo de dominio.
15. `src/components/sucursales/branch-list.tsx` — columnas de resumen, tipo
    de dominio.
16. `src/components/caja/cash-register-alert.tsx` — **nuevo** banner único.
17. `caja-panel.tsx`, `caja-status.tsx`, `cash-register-summary.tsx`,
    `dashboard-client.tsx` — usar el banner con `alertaCaja` (o prop).
18. `pedido-client.tsx` (`BranchInfoCard`), `pedido-success-dialog.tsx` —
    teléfonos (`tel:`) y redes (links con icono).
19. `chatService.ts` + componentes de chat — `branchContacts` en
    `ChatMessagesResult`; botón WhatsApp opcional en encabezado.

### Fase 3 — Config y docs

20. `.env.example` / `.env.e2e.example` — `CAJA_OVERDUE_HOURS`,
    `DEFAULT_BRANCH_SOCIAL_LINKS` (y `NEW_BRANCH_*` correspondientes).
21. `AGENTS.md`, `.devin/informes/entornos.md` — nuevas vars + semántica de
    turnos.
22. `.devin/informes/guia-funcionamiento-pancheria.md` — actualizar sección
    de caja (avisos por turno, umbral configurable).

## 6. Impacto en tests

### Unitarios

- `branch-helpers.test.ts` — overnight en `validateOpeningHours` (acepta
  `close < open`, rechaza `close === open`, rechaza solapamiento cross-day y
  wraparound Dom→Lun); `buildShiftIntervals`; `validateBranchPhones`;
  `normalizeSocialLinks`; `parseContactsForm`; `isBranchOpen` con overnight.
- `cash-register-helpers.test.ts` — tabla de casos de
  `getCashRegisterShiftStatus`/`resolveCashRegisterAlert` (los 4 estados ×
  casos borde de §3.7, incluido el caso 18:30→19:30 literal); fallback legacy
  con umbral mockeado.
- `branchService.test.ts` — nuevas firmas objeto + validaciones de contacto.
- `cashRegisterService.test.ts` — `getOpenCashRegisterSummary` incluye
  `estadoTurno`/`alertaCaja` (mockear `getBranchById`).
- `dashboard-client.test.tsx`, `sales-terminal.test.tsx` — mocks de payload
  con `alertaCaja` en vez de helpers de fecha.
- `api/caja/resumen/route.test.ts`, `api/panel/resumen/route.test.ts` —
  assert del campo nuevo (pasa-through del servicio).
- `pedido-client.test.tsx`, `pedido-success-dialog.test.tsx`,
  `public/sucursal/estado/route.test.ts`, `chatService.test.ts` — exposición
  de contactos.
- `knip` — revisar exports que queden sin uso (`isCashRegisterFromPreviousDay`
  y `isCashRegisterOverdue` sobreviven solo dentro del fallback).

### E2E (Playwright)

- Ningún spec aserta los textos "día anterior"/"12 horas" (verificado) →
  riesgo bajo.
- `tests/e2e/helpers.ts:235-253` (00:00–23:59 diario) converge al
  comportamiento anterior a las 00:00.
- `src/db/seeds.ts` usa 10:00–22:00/18:00–23:00: tests que corran fuera de
  turno verán el aviso `fuera_de_horario` — **informativo, no bloquea**;
  correr `npm run test:e2e` completo para confirmar.
- `sucursal-eliminacion.spec.ts` (crea solo con nombre) → compatible.
- Agregar testids nuevos (`branch-phone-label-0`, `branch-social-network-0`,
  …) y un spec de personalización de sucursal + avisos por turno.

## 7. Riesgos restantes y follow-ups

- **Migración `phone`→`phones`**: el backfill es SQL custom dentro de la
  migración generada; validar con `drizzle-kit check` y en la base de
  desarrollo antes de prod (ver `entornos.md` para el flujo de push).
- **Reloj**: estado computado en servidor; el polling existente lo refresca.
- **`jsonb` sin validación DB**: la integridad de `phones`/`socialLinks`
  depende de la validación de servicio (igual que `openingHours` hoy).
- **Follow-up fuera de alcance**: `CAJA_AUTO_CLOSE_HOURS` sigue siendo un
  umbral fijo; en el futuro podría evaluarse "cierre automático al final del
  turno" reutilizando `buildShiftIntervals`. No mezclar con este trabajo.
- **Reversibilidad de D2**: si la semántica literal resulta ruidosa en
  producción, el cambio a ancla es localizado (una condición + tests).

## 8. Auditoría post-implementación (2026-09-13)

Revisión del resultado implementado contra los requisitos D1–D6 y la
propuesta de este documento. Conclusión: **la implementación es la esperada**;
se encontraron y corrigieron 5 defectos/inconsistencias, más observaciones
menores que no requieren acción inmediata.

### 8.1 Conformidad verificada

| Requisito | Estado | Evidencia |
|---|---|---|
| D1 `phone` → `phones[0]` + drop | OK | `0030_branch_contacts.sql` (backfill `jsonb_build_array` + `DROP COLUMN`); sin referencias residuales a `branch.phone`/`branches.phone` en `src/`. |
| D2 literal | OK | `getCashRegisterShiftStatus` avisa al iniciar el primer turno posterior a la apertura, incluida apertura en hueco (`cash-register-helpers.test.ts`). |
| D3 horarios vigentes + edición total | OK | `getOpenCashRegisterSummary` usa `branch.openingHours` vigente; `BranchForm` único para alta/edición con repeaters de contactos. |
| D4 exposición pública | OK | `listPublicBranches` y `/api/public/sucursal/estado` incluyen `phones`/`socialLinks`; se muestran en `BranchInfoCard` (`/pedido`), `PedidoSuccessDialog` y encabezado del chat (`getChatContext`). |
| D5 overnight | OK | `validateOpeningHours` acepta `close < open` con detección de solapamientos semanal (Dom→Lun incluido); `buildShiftIntervals` incluye el día previo a `from` para capturar turnos en curso. |
| D6 fallback configurable | OK | `getCajaOverdueHours()` lee `CAJA_OVERDUE_HOURS`/`NEXT_PUBLIC_CAJA_OVERDUE_HOURS` (default 12); solo aplica en `sin_horarios`. |
| Una sola fuente de verdad server-side | OK (tras corrección) | `estadoTurno`/`alertaCaja` viajan en `/api/caja/resumen` y `/api/panel/resumen`; la página de historial lo calcula por SSR. |
| Contactos en chat | OK | `ChatContext` incluye `branchPhones`/`branchSocialLinks`; el polling usa `ChatMessagesResult` (tipo distinto, sin contactos — ver §8.3). |

### 8.2 Defectos encontrados y corregidos

| # | Defecto | Corrección |
|---|---|---|
| 1 | `CashRegisterSummary` ignoraba `cashRegister.alertaCaja`: `caja-panel.tsx` no pasaba el prop `alerta` y el data type no incluía el campo → el resumen dentro del panel aplicaba el **fallback legacy** (fecha calendario + 12 hs) aunque el servidor ya había calculado el aviso por turnos. Reintroducía el falso positivo "Caja del día anterior" durante turnos overnight. | `CashRegisterSummaryData` ahora incluye `alertaCaja`; la resolución encadena prop `alerta` → `cashRegister.alertaCaja` → fallback legacy. `caja-panel` además pasa el `alerta` ya resuelta. |
| 2 | Fallback `alertaCaja === undefined ? legacyCashRegisterAlert(...)` **duplicado en 4 componentes** con argumentos inconsistentes (`caja-panel` no pasaba `now` ni timezone). | Nuevo helper `resolveDisplayedCashRegisterAlert(alertaCaja, openedAt, now?, tz?)` en `cash-register-helpers.ts`; los 4 componentes lo usan. `legacyCashRegisterAlert` quedó como función interna (knip limpio). |
| 3 | `getTodayOpening` ignoraba el turno overnight en curso: un martes 01:00 dentro del turno lunes 20:00–02:00 devolvía "Hoy no atendemos." mientras `isBranchOpen` era `true` → mensaje contradictorio "Sucursal abierta. Hoy no atendemos." en `/api/public/sucursal/estado` y `BranchInfoCard`. | Ahora incluye el intervalo en curso del día anterior en la lista de "hoy" (`branch-helpers.ts`). |
| 4 | `getCurrentOrNextOpening` etiquetaba "Hoy" a un turno overnight que abrió el día anterior. | Usa `dayLabel(slot.start, now, tz)` también para el turno vigente → "Lunes de 20:00 a 02:00". |
| 5 | `parseOpeningHoursForm` descartaba filas parciales en silencio (`if (open && close)`), inconsistencia con `parseContactsForm` (que las conserva para error visible — flaggeado en §1.2). | Conserva filas con `open` o `close` → `validateOpeningHours` produce el error visible. Test actualizado. |

### 8.3 Observaciones (sin acción requerida)

- **`estadoTurno` sin consumidor en UI**: viaja en los payloads pero ningún
  componente lo lee (solo `alertaCaja`). Se conserva como contrato de API para
  UI futura; tiene dualidad de tipos `CashRegisterShiftInfo` (Date, servidor)
  ↔ `CashRegisterShiftInfoDTO` (ISO, cliente) documentada en `types.ts`.
- **`ChatMessagesResult` no incluye contactos**: el encabezado del chat se
  renderiza una vez por SSR; el polling refresca `branchLocation` pero no
  `branchPhones`/`branchSocialLinks`. Asimetría aceptable: los contactos solo
  quedan desactualizados si se editan con el chat abierto.
- **Doble punto en `message`**: `Sucursal abierta. ${currentOpening}.`
  produce "...atendemos.." — cosmético y preexistente (también en
  `pedido-client.tsx` línea ~152).
- **`branch-list` sigue mostrando solo nombre + ID** (§1.2 sugería resumen de
  configuración): follow-up de UX opcional, no requisito.
- **`.devin` y working tree**: hay cambios documentales de una auditoría
  previa de `.devin` mezclados con los de esta feature en el working tree;
  son legítimos pero conviene commitearlos por separado. El artefacto `nul`
  ya no existe.
- **Warning de hidratación** en `/ventas/historial/[id]` (texto
  dependiente de `now` dentro de `<p>`): preexistente, no fatal.

### 8.4 Verificación tras las correcciones

`npx tsc --noEmit` ✓ · `npm run lint` ✓ · `npm run knip` ✓ ·
Jest **155 suites / 1640 tests** ✓ (incluye cobertura nueva: overnight en
`getTodayOpening`/`getCurrentOrNextOpening`, filas parciales en
`parseOpeningHoursForm` y `resolveDisplayedCashRegisterAlert`).
