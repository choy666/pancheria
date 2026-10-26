# Mejora del menú digital `/menu` y reorganización de `/pantalla-config`

> Prompt ejecutado en sesión del 2026-10-21. Incluye el **addendum** de
> precisiones verificadas contra el código antes de la ejecución (auditoría
> previa del prompt, misma sesión).

## Contexto

Este proyecto (Panchería, Next.js + drizzle + Neon) tiene dos vistas kiosk por
sucursal:

- `/pantalla?branchId=N` — carrusel publicitario (escenas de producto, videos,
  QR, escena de sucursal)
- `/menu?branchId=N` — carta completa en grilla paginada por categorías

Ambas se configuran desde una única página del panel admin: `/pantalla-config`
(titulada "Pantalla publicitaria"), con tres secciones: `PantallaSettingsForm`
(tabla `pantalla_settings`), `PantallaPlaylistEditor` (tabla `pantalla_items`) y
`MenuSettingsForm` (tabla `menu_settings`).

Hoy `menu_settings` solo persiste `paginaMs`, `filasPagina`, `showQrStrip` y
`hiddenProductIds`. La configuración viaja dentro del `MenuSnapshot` (SSR +
polling a `/api/public/menu`), así que un cambio en el panel se aplica solo en
el próximo poll de la TV, sin redeploy.

Problemas observados en el menú actual: las fotos quedan chicas dentro del
lienzo blanco (doble padding: la imagen ya viene normalizada a 16:9 con aire),
los nombres se truncan a 1 línea, la tipografía queda justa para lectura a
distancia en TV, y —lo más importante— las promos no dicen qué incluyen: el
campo `description` ya viaja en el snapshot (`PublicCatalogProduct` lo incluye)
pero `MenuCard` no lo renderiza (la escena de producto de `/pantalla` sí lo
hace).

## Objetivo

Mejorar la legibilidad del menú digital, ampliar su personalización desde el
panel y reorganizar `/pantalla-config` para que quede claro que administra las
dos TVs.

## Tareas

### Fase 1 — Mejoras visuales de `/menu` (sin cambios de schema)

1. `src/components/menu/menu-card.tsx`:
   - Mostrar `product.description` bajo el nombre cuando exista
     (`line-clamp-2`, `text-white/70`); es la data que más falta en las promos.
     Ojo: la descripción compite con la imagen por altura dentro de
     `min-h-0 flex-1` — con `filasPagina` alto puede reducir la imagen a casi
     nada; verificar visualmente con 4 filas × 4 columnas.
   - Nombre: pasar de `truncate` a `line-clamp-2`.
   - Agrandar tipografía en `md:`: nombre ~`text-3xl`, precio ~`text-4xl`
     (verificar que no rompa la grilla con 4 filas × 4 columnas).
   - Reducir/quitar el padding interno de la imagen (`p-1.5 md:p-2`): el lienzo
     normalizado ya trae su aire. Probar cómo llena mejor la tarjeta.
2. Estado "Cerrado" en el chrome del menú: agregar un mensaje secundario breve
   tipo "Cerrado — podés mirar la carta y pedir desde el QR" bajo el badge de
   estado. **Ojo:** el chrome es `PantallaChrome`
   (`src/components/pantalla/pantalla-chrome.tsx`), compartido con `/pantalla`.
   No cambiar el comportamiento de `/pantalla`: agregar una prop opcional (p.
   ej. `closedHint?: string`) y usarla solo desde `menu-client.tsx`.
   `menu.spec.ts` espera `toContainText('Cerrado')` (contains, no exacto), así
   que no rompe.
3. Última fila incompleta de la grilla (p. ej. 11 ítems → 4/4/3): centrar una
   fila corta en CSS grid no es una clase suelta (requeriría reestructurar la
   grilla). Decisión: dejarla alineada a la izquierda como está y documentarlo
   en el comentario del componente; no invertir tiempo en centrarla.

### Fase 2 — Nuevas opciones en `menu_settings`

Agregar columnas a `menu_settings` y cablear el flujo completo existente:
`src/db/schema.ts` (tabla) → `MenuSettingsRow` en `src/domain/types.ts` →
`menuSettingsSchema` en `src/lib/zod-schemas.ts` → `menuService`
(`src/application/services/menuService.ts`, incl. `defaultSettings()`) →
`menuRepository` → tipo `MenuSettings` en `src/lib/menu-pages.ts` →
`MenuSettingsForm` (`src/components/menu-config/menu-settings-form.tsx`) →
`updateMenuSettingsAction` (`src/app/(panel)/pantalla-config/actions.ts`) →
consumo en `menu-client.tsx` / `menu-board.tsx` / `menu-card.tsx` /
`menu-qr-strip.tsx`.

Campos (defaults que preserven el comportamiento actual):

| Campo | Tipo | Default | Efecto |
|---|---|---|---|
| `gridColumns` | integer + CHECK `BETWEEN 3 AND 5` (patrón de `pagina_ms_check`) | 4 | Columnas en landscape (`md:`). `MENU_GRID_COLS` se usa en `buildMenuPages`/`groupLines` y **3 lugares de `menu-board.tsx`** (cálculo de `rows` para `flex`, `gridTemplateRows` inline, clase `md:grid-cols-4`): volverlo parámetro. Clases Tailwind estáticas: mapear `md:grid-cols-3/4/5` con un record, no interpolar. Mobile queda `grid-cols-2` fijo. Si `MENU_GRID_COLS` queda como export sin uso knip lo marca: conservarlo como default interno o eliminarlo. |
| `fontScale` | `pgEnum` `('normal','large')` | `normal` | Escala global de tipografía para lectura a distancia. Implementar con records de clases estáticas (misma restricción Tailwind). En el form, nota de que `large` rinde mejor con pocas filas/columnas. |
| `showDescriptions` | boolean | `true` | Muestra `description` en las tarjetas (lo agregado en Fase 1 pasa detrás de este toggle). |
| `cardStyle` | `pgEnum` `('image','compact')` | `image` | `image` = tarjeta actual; `compact` = imagen lateral chica + texto a la derecha. **Solo 2 valores en esta iteración** (un modo `text` cambia la semántica de `filasPagina`/`gridColumns` y queda para una fase posterior; usar `pgEnum` ya permite `ALTER TYPE ADD VALUE` después). Si `compact` cambia el alto real de las tarjetas, ajustar el cálculo de filas en la paginación. |
| `sortOrder` | `pgEnum` `('catalog','price_asc','price_desc')` | `catalog` | Orden de ítems dentro de cada categoría; aplicar en `buildMenuPages` antes de paginar (el orden de grupos sigue `typePriority`). |
| `featuredProductIds` | jsonb `number[]`, `.max(50)` en zod | `[]` | Destacados: **reordenan primero dentro de su categoría Y llevan badge/borde mostaza "Recomendado"**. Con `sortOrder` activo: featured primero (ordenados entre sí por el mismo criterio), luego el resto. Si un ID está en `hidden` y `featured`, `hidden` gana — documentarlo en el form y en el comentario de `buildMenuPages`. Validar igual que `hiddenProductIds` (existe, no eliminado, vendible al público de la sucursal) — extraer la validación compartida en un helper del service. |
| `qrStripText` | text, zod `max(60)` | `'Pedí desde tu celu'` | CTA principal de la franja QR. El subtítulo "Escaneá el código…" queda fijo (no configurable). |

Firma de `buildMenuPages`: pasar a un objeto de opciones en vez de parámetros
posicionales, p. ej.
`buildMenuPages(products, { filasPagina, columnas, ocultos, destacados, orden })`.

Restricciones: una sucursal sin fila en `menu_settings` debe comportarse igual
que hoy (defaults en `defaultSettings()`); las columnas nuevas van
`.default(...).notNull()` para que las filas existentes migren solas;
`availability <= 0` nunca se muestra; `hiddenProductIds` sigue igual. En el
form, el selector de destacados reutiliza el patrón de checkboxes agrupados por
tipo que ya tiene el de ocultos; para los enums usar el `Select` de
`src/components/ui/select.tsx` (ya existe).

### Fase 3 — Reorganizar `/pantalla-config`

**La ruta `/pantalla-config` NO cambia** (rompería `routes.pantallaConfig` y los
6 `goto` + navegación por nav en E2E). Solo cambian título, label de nav y
layout interno.

1. Renombrar a "Pantallas":
   - `<h1>` y descripción de `src/app/(panel)/pantalla-config/page.tsx`.
   - Nav: en `src/components/panel/panel-header.tsx` cambiar
     `{ href: routes.pantallaConfig, label: 'Pantalla' }` →
     `label: 'Pantallas'` (línea ~52, en `adminNavItems`).
   - **NO tocar** los `mobileText`/`label` de los `kioskLinks` (líneas ~145-174:
     "Pantalla publicitaria" y "Menú digital" se refieren a las vistas `/pantalla`
     y `/menu`, no a esta página) ni el tooltip `'Pantalla publicitaria de
     {branch.name}'`de`branch-list.tsx` (~línea 220).
   - El atributo `data-tour="pantalla-config-page"` puede quedar igual (ningún
     test ni step del tour lo referencia; no hay textos del tour con el nombre
     viejo).
2. Agrupar en dos secciones claramente rotuladas: "Carrusel publicitario
   (`/pantalla`)" con `PantallaSettingsForm` + `PantallaPlaylistEditor`, y
   "Menú digital (`/menu`)" con `MenuSettingsForm`. No hay componente Tabs en
   `src/components/ui`: usar encabezados de sección (`<h2>` + anclas) — lo más
   simple y consistente.
3. Mover los botones "Ver pantalla" (`pantalla-open-live`) y "Ver menú"
   (`menu-open-live`) junto al encabezado de su sección correspondiente.
4. Preview embebido: **queda fuera** (un iframe de una vista kiosk completa con
   polling propio agrega complejidad sin beneficio claro — los botones "Ver
   menú"/"Ver pantalla" ya cubren el preview en pestaña real). Justificar en el
   PR.

## Archivos clave

- Menú: `src/app/(kiosk)/menu/page.tsx`,
  `src/components/menu/{menu-client,menu-board,menu-card,menu-qr-strip}.tsx`,
  `src/lib/{menu-pages,menu-snapshot}.ts`,
  `src/components/pantalla/pantalla-chrome.tsx` (compartido)
- Config menú: `src/app/(panel)/pantalla-config/{page,actions}.ts(x)`,
  `src/components/menu-config/menu-settings-form.tsx`,
  `src/application/services/menuService.ts`,
  `src/repositories/menuRepository.ts`, `src/lib/zod-schemas.ts`
  (`menuSettingsSchema`), `src/db/schema.ts` (tabla `menu_settings`),
  `src/domain/types.ts` (`MenuSettingsRow`), `src/config/menu.ts` (defaults por
  env — los campos nuevos no necesitan env, igual que `showQrStrip`)
- Espejo de patrón (pantalla): `src/components/pantalla-config/*`,
  `pantallaService`, tabla `pantalla_settings`
- Nav: `src/components/panel/panel-header.tsx`

## Tests afectados (actualizar + agregar)

- `tests/e2e/pantalla-config.spec.ts` — **rompe seguro**: línea ~93 espera el
  link de nav `name: 'Pantalla'` con `exact: true`, línea ~99 el heading
  "Pantalla publicitaria". Los botones `pantalla-open-live`/`menu-open-live`
  solo se assertan con `toBeVisible()` (no posición): moverlos a las secciones
  no rompe.
- `src/lib/menu-pages.test.ts` — la firma de `buildMenuPages` cambia (objeto de
  opciones); agregar tests de columnas dinámicas, `sortOrder`, featured
  (primero + precedencia de `hidden`).
- `src/application/services/menuService.test.ts` — `makeSettingsRow` necesita
  los campos nuevos; agregar tests de validación de `featuredProductIds` y del
  default sin fila.
- `src/lib/menu-snapshot.test.ts` y `src/app/(kiosk)/menu/page.test.tsx` — los
  literales `settings: {...}` quedan incompletos por el tipo nuevo.
- `tests/e2e/menu.spec.ts` — `toContainText('Cerrado')` sigue pasando
  (contains); agregar cobertura si se expone algo nuevo observable en E2E (p.
  ej. descripción visible, badge de destacado).

## Reglas del proyecto (obligatorias)

- Todo en español: código, comentarios, textos de UI.
- Cambios de schema: modificar `src/db/schema.ts` + `npx drizzle-kit generate` +
  commitear el SQL en `drizzle/`; aplicar local con `npx drizzle-kit migrate`.
  No usar `drizzle-kit push`.
- Nada hardcodeado que deba venir de config/entorno.
- Antes de pushear: `npm run lint`, `npx tsc --noEmit`, `npm test`,
  `npm run knip`, y consultar `.devin/informes/checklist-pre-push.md`. NO correr
  E2E contra bases con datos reales (`global-setup` trunca tablas).
- Actualizar documentación del repo: `.devin/informes/arquitectura/
  base-de-datos.md`(tabla`menu_settings` columna por columna, ~línea 351),
  `.devin/informes/arquitectura/modulos.md` (descripción de la página y de
  `menu_settings`, ~líneas 99-113), `AGENTS.md` (~línea 338, menciona
  `/pantalla-config` y la sección "Menú digital") y los comentarios de
  `.env.example` (~líneas 196-217) si los nombres de sección cambian.

## Criterios de aceptación

- [ ] Las tarjetas muestran descripción cuando existe y `showDescriptions` está
  activo, el nombre no se trunca a 1 línea y la tipografía es legible a 2–3 m.
- [ ] Estado "Cerrado" en `/menu` aclara que la carta sigue disponible, sin
  cambiar el chrome de `/pantalla`.
- [ ] Todas las opciones nuevas del menú se configuran desde `/pantalla-config`
  y se aplican solas en el próximo poll de la TV.
- [ ] La página se titula "Pantallas", el nav dice "Pantallas" y separa
  claramente carrusel vs menú; la ruta sigue siendo `/pantalla-config`.
- [ ] Migración drizzle generada y commiteada; sin fila en `menu_settings` el
  comportamiento es idéntico al actual; `hidden` gana sobre `featured`.
- [ ] `npm run lint` + `npx tsc --noEmit` + `npm test` + `npm run knip` en
  verde; `tests/e2e/pantalla-config.spec.ts` y `tests/e2e/menu.spec.ts`
  actualizados.
- [ ] Docs (`base-de-datos.md`, `modulos.md`, `AGENTS.md`) reflejan las nuevas
  columnas y el nuevo nombre de la página.

---

## Addendum — precisiones verificadas contra el código (pre-ejecución)

Auditoría del prompt contra el código real (misma sesión, antes de ejecutar).
Ninguna es bloqueante; quedan incorporadas como decisiones de implementación:

1. **`sortOrder: 'catalog'` conserva el orden intra-grupo actual.** El orden
   vigente dentro de cada grupo no es "orden del catálogo" sino el que deja
   `groupProductsByType`: alfabético por nombre (`localeCompare`) con
   sub-prioridad `criticalSupplyTypePriority` dentro de `critical_supply`.
   Implementación: con `orden === 'catalog'` el comparador no reordena entre
   ítems del mismo nivel de destacado (retorna 0 y el sort estable conserva el
   orden del agrupamiento). Con `price_asc`/`price_desc` el orden por precio
   **reemplaza** esa sub-prioridad de insumos críticos — es deliberado (el
   orden dentro de la categoría es lo que `sortOrder` controla).
   `menu.spec.ts` depende implícitamente del orden alfabético ('0 Menu promo'
   ordena primero), así que el default debe preservarlo.
2. **Los botones `pantalla-open-live`/`menu-open-live` solo se verifican con
   `toBeVisible()`** en `pantalla-config.spec.ts` (líneas 106-107) — moverlos a
   sus secciones no rompe el spec; lo que rompe seguro es el nav
   `name: 'Pantalla', exact: true` y el heading "Pantalla publicitaria".
3. **Son 6 `goto('/pantalla-config')` + 1 click de nav** en E2E, todos en
   `pantalla-config.spec.ts` (el prompt original decía "~10").
4. **`qrStripText` con `.trim().min(1).max(60)` en zod** (el prompt original
   solo pedía `max(60)`): un CTA vacío o de solo espacios se rechaza con
   `ValidationError` y mensaje en español.
5. **`sizes` de `next/image` en `MenuCard` se parametriza por `gridColumns`**:
   `(max-width: 768px) 50vw, ${100/columnas}vw` — el valor fijo `25vw` asumía
   siempre 4 columnas.

Precisiones adicionales registradas durante la auditoría:

- `featuredProductIds` no viaja dentro de `MenuPage.items` (son
  `PublicCatalogProduct`): el flag llega al `MenuCard` como prop/`Set` aparte
  vía `menu-client` → `menu-board` → `menu-card`.
- `pantalla.spec.ts` asserta `'Cerrado'` sobre `pantalla-branch-status` (escena
  de sucursal, no el chrome): el `closedHint` opt-in de `PantallaChrome` no lo
  afecta.
- El `Select` de `src/components/ui/select.tsx` es Base UI, no Radix; la
  convención del repo para emitirlo en `FormData` es controlado + `<input
  type="hidden" name=...>` (patrón de `user-form.tsx`).
- `menu.spec.ts` inserta `menu_settings` directo con columnas parciales: la
  restricción `.default(...).notNull()` de las columnas nuevas es justamente lo
  que lo mantiene funcionando.
- `modulos.md` línea ~100 ya describe `/pantalla-config` solo como config de
  `/pantalla` (desactualizado de origen): la actualización documental lo
  corrige al pasarla a "Pantallas" con las dos secciones.
- JSDoc a refrescar junto con los docs formales: `menu-snapshot.ts` (lista de
  campos del snapshot), `menuService.ts` (defaults), `config/menu.ts` ("grilla
  de 4 columnas" pasa a ser configurable), `menu-pages.ts`/`menu-board.tsx`
  (decisión de la última fila incompleta).
- El diagrama ER (`base-de-datos.md`, bloque mermaid ~línea 247) lista las
  columnas de `menu_settings`: actualizar y regenerar
  `diagramas/svg/base-de-datos.svg` con `npx -y -p @mermaid-js/mermaid-cli mmdc`
  (convención de `informes/arquitectura/README.md`).
