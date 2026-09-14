# Plan de acción — Observaciones de la auditoría de sucursales y caja por turnos

> Fecha: 2026-09-13
> Estado: Pendiente de priorización por el equipo
> Fuente: §8.3 de `auditoria-sucursales-y-caja-por-turnos.md`

Este documento define un plan estructurado para abordar las observaciones de la
auditoría que no requirieron acción inmediata pero tienen valor de mejora
técnica o de UX.

---

## 1. `estadoTurno` no se consume en la UI

**Impacto:** Bajo — funciona como contrato de API para UI futura.
**Prioridad:** Baja — refactorización opcional si se requiere más visibilidad de turnos en la UI.

### 1.1 Estado actual

- `getOpenCashRegisterSummary` en `cashRegisterService.ts` calcula
  `estadoTurno` (tipo `CashRegisterShiftInfo`) y lo adjunta al payload.
- Los endpoints `/api/caja/resumen` y `/api/panel/resumen` lo incluyen en la
  respuesta via `CashRegisterShiftInfoDTO` (fechas como ISO).
- Ningún componente cliente lee este campo — solo `alertaCaja` se consume.
- Existe dualidad de tipos documentada: `CashRegisterShiftInfo` (Date, servidor)
  ↔ `CashRegisterShiftInfoDTO` (ISO, cliente).

### 1.2 Propuesta de mejora

Opción A — **Consumir en la UI para mostrar detalle del turno actual:**

1. Exponer `currentShift` (turno en curso) y `nextShiftStart` en `CashRegisterAlertBanner` o en un badge separado.
2. Mostrar "En turno: Hoy de 11:00 a 14:00" o "Próximo turno: Mañana de 19:00 a 23:00" en el panel de caja.
3. Usar los datos ya disponibles en el payload sin agregar queries adicionales.

Opción B — **Mantener como contrato de API y documentar el uso futuro:**

1. Agregar un comentario en `config/caja.ts` sobre el propósito de `estadoTurno`.
2. Documentar en `AGENTS.md` o en la API docs que este campo está reservado para
   UI de monitor de turnos futura.

### 1.3 Pasos si se elige Opción A

- [ ] Extender `CashRegisterAlertBanner` o crear `CashRegisterShiftBadge` que
  reciba `estadoTurno` y renderice el turno en curso.
- [ ] Actualizar `caja-panel.tsx`, `caja-status.tsx` y `dashboard-client.tsx`
  para pasar `cashRegister.estadoTurno` al nuevo componente.
- [ ] Agregar tests de integración que verifiquen el renderizado de turnos en
  los 4 componentes.
- [ ] Verificar E2E que toquen el panel de caja (specs actuales no asertan
  textos específicos de turnos).
- [ ] Agregar testids para el nuevo componente.

### 1.4 Riesgos

- Riesgo bajo: el campo ya viaja en el payload; es consumo seguro.
- Si se implementa, asegurar que `currentShift` y `nextShiftStart` sean `null`
  cuando `status === 'sin_horarios'` para no mostrar datos inconsistentes.

---

## 2. Doble punto en `message` ("...atendemos..")

**Impacto:** Muy bajo — solo cosmético.
**Prioridad:** Baja — corrección trivial sin riesgo.

### 2.1 Estado actual

- `src/app/api/public/sucursal/estado/route.ts:38`:
  ```ts
  const message = open
    ? `Sucursal abierta. ${currentOpening}.`
    : `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`;
  ```
- `src/components/pedido/pedido-client.tsx:152` (línea aproximada):
  ```ts
  Sucursal abierta. {currentOpening}.
  ```
- Cuando `currentOpening` es "Hoy de 20:00 a 23:00", el resultado es
  "Sucursal abierta. Hoy de 20:00 a 23:00." — dos puntos seguidos.

### 2.2 Propuesta de corrección

Unificar el formato de mensaje para evitar el doble punto:

**Opción A — Eliminar el punto final de `currentOpening`:**
- Cambiar `getTodayOpening`/`getCurrentOrNextOpening` para que devuelvan
  "Hoy de 20:00 a 23:00" sin punto.
- Impacto: afecta otros lugares que usan estos helpers (`BranchInfoCard`,
  `PedidoSuccessDialog`).

**Opción B — Usar dos puntos en lugar de punto:**
- `Sucursal abierta: ${currentOpening}.`
- `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`

**Opción C — Agregar espacio explícito:**
- `Sucursal abierta. ${currentOpening}` (sin punto final en el template).

### 2.3 Pasos (Opción B recomendada)

- [ ] Cambiar `route.ts:38` a:
  ```ts
  const message = open
    ? `Sucursal abierta: ${currentOpening}.`
    : `La sucursal está cerrada. Próxima apertura: ${nextOpening}.`;
  ```
- [ ] Cambiar `pedido-client.tsx` a usar el mismo formato.
- [ ] Agregar test unitario en `branch-helpers.test.ts` que verifique que
  `getCurrentOrNextOpening` no termina con punto (si se elige Opción A) o
  actualizar el test de `route.test.ts` para esperar el nuevo formato.
- [ ] Verificar E2E de pedido público (specs actuales no asertan el mensaje
  exacto).

### 2.4 Riesgos

- Riesgo nulo: cambio de texto puramente cosmético.
- Si se elige Opción A, revisar otros consumidores de `getTodayOpening` y
  `getCurrentOrNextOpening` (`BranchInfoCard`, `PedidoSuccessDialog`).

---

## 3. `branch-list` muestra solo nombre + ID

**Impacto:** Medio — mejora de UX para administradores.
**Prioridad:** Media — útil pero no crítico.

### 3.1 Estado actual

- `src/components/sucursales/branch-list.tsx` muestra:
  - Nombre de la sucursal.
  - ID (numérico).
- No se ve dirección, teléfono, horarios o estado de configuración sin entrar
  a editar.
- La auditoría original (§1.2) sugería mostrar un resumen.

### 3.2 Propuesta de mejora

Opción A — **Agregar columnas de resumen:**

- Dirección (truncada con ellipsis).
- Primer teléfono (label + número).
- Cantidad de horarios configurados (ej. "7 días").
- Indicador de "sin horarios".

Opción B — **Agregar un badge de estado:**

- "Con horarios" (verde) vs "Sin horarios" (amarillo).
- Mantener el diseño limpio actual.

Opción C — **Tooltip al hover:**

- Mostrar resumen de dirección/teléfono al pasar el mouse sobre la fila.

### 3.3 Pasos (Opción A recomendada)

- [ ] Extender `BranchList` para incluir columnas opcionales (configurables por
  toggle o siempre visibles).
- [ ] Ajustar el layout de `Table` para acomodar nuevas columnas (responsive:
  ocultar columnas menos críticas en móvil).
- [ ] Agregar truncación de texto (`truncate`, `text-ellipsis`) para dirección
  larga.
- [ ] Actualizar tests E2E de sucursales (specs actuales no asertan el contenido
  de la tabla).
- [ ] Considerar agregar paginación si la lista crece (actualmente muestra
  todas las sucursales).

### 3.4 Riesgos

- Riesgo bajo: solo UI de admin.
- Validar que la tabla no se rompa en pantallas pequeñas (responsive).

---

## 4. Diffs de `.devin` mezclados en el working tree

**Impacto:** Bajo — limpieza de working tree.
**Prioridad:** Media — para mantener el historial limpio.

### 4.1 Estado actual

El `git status` muestra cambios en `.devin/` de una auditoría documental
previa:

```
M .devin/informes/checklist-pre-push.md
M .devin/informes/guia-funcionamiento-pancheria.md
M .devin/informes/reporte-estado.md
M .devin/prompts/README.md
```

Estos cambios son legítimos (corrección de índices, actualización de
estados) pero corresponden a una sesión de trabajo distinta de la
implementación de sucursales/caja por turnos.

### 4.2 Propuesta de acción

Opción A — **Commitear aparte antes de commitear la feature:**

1. Crear un commit único con solo los cambios de `.devin/`:
   ```
   git add .devin/
   git commit -m "doc: actualización de índices y estados en .devin (auditoría documental)"
   ```
2. Luego commitear la feature de sucursales/caja en otro commit.

Opción B — **Unificar en un solo commit con mensaje descriptivo:**

- Un solo commit que incluya los cambios de `.devin/` y la feature.
- Riesgo: mezcla dos trabajos conceptuales en el mismo commit.

Opción C — **Stash y aplicar más tarde:**

- `git stash push -m "wip: cambios de .devin de auditoría previa" .devin/`
- Aplicar después en una sesión dedicada.

### 4.3 Pasos (Opción A recomendada)

- [ ] Verificar el diff exacto de `.devin/` para confirmar que solo contiene
  cambios documentales (sin código de producción).
- [ ] Crear el commit de `.devin/` con mensaje descriptivo.
- [ ] Verificar que el working tree solo contenga cambios de la feature
  (sucursales/caja).
- [ ] Commitear la feature en otro commit.

### 4.4 Riesgos

- Riesgo nulo: cambios de documentación no afectan el runtime.
- Si ya se commiteó todo junto, se puede corregir con `git rebase -i` (solo
  si el branch no fue pushado).

---

## 5. Warning de hidratación en `/ventas/historial/[id]`

**Impacto:** Muy bajo — warning de React, no funcional.
**Prioridad:** Baja — preexistente, no causado por esta feature.

### 5.1 Estado actual

El log de E2E reporta un warning de hidratación en:

```
src/components/caja/cash-register-summary.tsx (línea ~153)
<p data-testid="cash-register-opened-by">
```

El warning se relaciona con texto dependiente de `now` (duraciones,
timestamps) que difiere entre servidor y cliente. El componente ya tiene
`suppressHydrationWarning` en la línea cercana.

### 5.2 Propuesta de acción

Opción A — **Investigar raíz y corregir:**

1. Identificar qué parte del texto causa el mismatch (probablemente
   `safeFormatDuration` o la hora de apertura).
2. Mover el cálculo de duración al cliente para que se compute en el mismo
   instante en ambos lados.
3. O usar un `key` basado en el timestamp para forzar el re-render sin warning.

Opción B — **Aceptar como preexistente y documentar:**

- Agregar un comentario en el código indicando que el warning es conocido
  y preexistente.
- Agregar a `lecciones-aprendidas.md` como nota técnica.

Opción C — **Eliminar `suppressHydrationWarning` y hacer la corrección:**

- Esto obliga a arreglar el problema real (Opción A).

### 5.3 Pasos (Opción A si se decide corregir)

- [ ] Reproducir el warning localmente accediendo a la página de historial.
- [ ] Identificar el componente exacto que causa el mismatch (devtools React).
- [ ] Si es duración, mover el cálculo de `intervalToDuration` al cliente
  (`useEffect` o `useMemo`).
- [ ] Si es hora de apertura, usar `formatDateTime` con cuidado o
  computar en cliente.
- [ ] Quitar `suppressHydrationWarning` solo cuando el warning desaparezca.
- [ ] Verificar E2E que no aparezca el warning tras la corrección.

### 5.4 Riesgos

- Riesgo bajo: el warning no causa fallos funcionales.
- Al mover lógica al cliente, asegurar que el comportamiento no cambie
  entre SSR y CSR (p. ej. si el usuario tiene el reloj desfasado).

---

## Matriz de prioridades sugerida

| # | Observación | Prioridad | Esfuerzo | Valor |
|---|---|---|---|---|
| 4 | Diffs `.devin` mezclados | Media | Muy bajo | Limpieza de working tree |
| 2 | Doble punto en `message` | Baja | Muy bajo | Cosmético trivial |
| 3 | `branch-list` con más datos | Media | Medio | UX de admin |
| 1 | Consumir `estadoTurno` en UI | Baja | Medio | Preparación para UI futura |
| 5 | Warning de hidratación | Baja | Alto | Técnico preexistente |

---

## Próximos pasos recomendados

1. **Inmediato (sesión actual):** Commitear los diffs de `.devin/` aparte
   (Opción A, §4) para limpiar el working tree antes de commitear la feature.
2. **Corto plazo:** Corregir el doble punto en `message` (Opción B, §2) —
   cambio trivial sin riesgo.
3. **Medio plazo:** Mejorar `branch-list` (Opción A, §3) si el equipo valora
   la UX de administración.
4. **Largo plazo / bajo demanda:** Consumir `estadoTurno` en UI (Opción A, §1)
   cuando se diseñe la interfaz de monitor de turnos.
5. **Bajo demanda / técnico:** Investigar warning de hidratación (Opción A, §5)
   si el equipo quiere mantener el log de E2E limpio.
