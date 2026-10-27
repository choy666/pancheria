# Prompt: Corregir el dropdown recortado del selector de insumos en el formulario de promos

## Contexto

Proyecto: `pancheria` — Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, `@base-ui/react` (instalado 1.7.0; `package.json` declara `^1.6.0`), Drizzle ORM + PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:

- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md` — en particular la lección de `Select.Value` con valor crudo (línea ~67) y las de portales que salen del scope `[data-theme]` (líneas ~181 y ~202)
- `.devin/informes/checklist-pre-push.md`
- Skill `context7-stack` — IDs de Context7 pre-resueltos por dependencia; `@base-ui/react` ya tiene ID (usar `query-docs` directo, sin `resolve-library-id`)

Todo el trabajo, comentarios y documentación en español.

## Estado actual verificado (punto de partida — no re-derivar)

- `src/components/productos/supply-searchable-select.tsx`: combobox propio con búsqueda, grupos, highlight y navegación por teclado. El listbox se renderiza con `absolute z-50` dentro de un `div.relative` (líneas 357 y 381-390) **sin portal**. `useLayoutEffect` (241-275) calcula `placement`/`maxHeight` solo contra `window.innerHeight` y solo escucha `resize` (no `scroll` — hoy no hace falta porque el listbox absoluto viaja junto con el card al scrollear).
- `src/components/ui/card.tsx:15`: `Card` tiene `overflow-hidden` → recorta el listbox en el borde del card. Síntoma: en la última fila de insumos solo se ve ~1 opción; en filas medias el dropdown se dibuja encima de la fila siguiente. Causa raíz: el flip actual mide contra el viewport, no contra el borde del `Card`.
- `src/components/productos/promo-form.tsx:634`: **único uso** de `SupplySearchableSelect` en todo `src/` (verificado por grep), dentro de cada card de insumo del `Card` "Insumos de la promo". El form se monta vía `ProductFormTabs` solo en `(panel)/productos/nuevo` y `(panel)/productos/[id]/editar` — ámbito de panel oscuro únicamente.
- `promo-form.test.tsx:51-77` ya mockea `SupplySearchableSelect` con un `<select>` nativo que usa `data-testid={id}` (o sea `promo-recipe-${index}`, **no** el prop `data-testid`): el refactor interno no lo rompe mientras la firma de props no cambie.
- Testids/ids a preservar: `data-testid="recipe-supply-select-${index}"` en el trigger e `id={promo-recipe-${index}}` (lo usa el mock como testid y los `<Label htmlFor>`).
- `src/components/ui/select.tsx`: patrón de referencia que ya resuelve este mismo problema con `@base-ui/react` — `Portal` + `Positioner` + `max-h-(--available-height)` + `w-(--anchor-width)` (líneas 74-94).
- **NO existe spec unitario** de `supply-searchable-select` (verificado): hay que crearlo, no "ajustarlo si existe".
- El spec E2E `tests/e2e/productos-y-recetas.spec.ts` (describe "Edición y eliminación de promos", 402+) **no interactúa con el select por UI a propósito**: el comentario en 488-490 documenta que "la edición de receta por Select fue flaky en la suite completa" y muta la receta por API (`POST /api/recetas`), verificando el form vía `data-supply-name` en `recipe-item`. Ningún test actual usa `getByRole('combobox')` ni `recipe-supply-select-*` por UI.
- `jest.setup.ts` no stubbea `ResizeObserver`, `scrollIntoView`, `hasPointerCapture` ni `matchMedia`; `promo-form.test.tsx:83` stubbea `scrollIntoView` por-spec. Un spec nuevo que renderice primitivas reales de Base UI (floating-ui usa `ResizeObserver` en `autoUpdate`) necesita esos stubs locales.
- Handlers que asumen DOM contenido y **se rompen con portal** (riesgo mayor del refactor): `handleClickOutside` (229-239) chequea `containerRef.contains(target)` y el `onBlur` del input de búsqueda (403-409) chequea `containerRef.contains(relatedTarget)`. Con el listbox en `document.body`, un `mousedown` sobre una opción dispara "click afuera" antes del `click` → la selección se pierde; el blur hacia el portal también cierra.

## Objetivo

Que el listado de insumos se vea completo y usable desde cualquier fila del formulario (incluida la última), sin recortes ni solapamientos, conservando búsqueda, grupos, highlight, teclado y un patrón de accesibilidad equivalente.

## Reglas

1. El listbox debe escapar el clipping del `Card`: renderizar en portal con posicionamiento anclado al trigger, flip top/bottom y `max-height` según espacio real disponible. Recalcular en `resize` **y** `scroll` de página (ver regla 8).
2. No quitar `overflow-hidden` de `Card` (protege imágenes y bordes en todo el sistema).
3. Preferir Base UI: `Combobox` de `@base-ui/react` (soporta `Combobox.Input` dentro de `Combobox.Popup` — el patrón "trigger + búsqueda dentro del popup" que hoy tiene el componente) o reusar el patrón `Portal`/`Positioner` de `ui/select.tsx`. Si se implementa portal propio, justificar en el código/PR por qué no se usa Base UI. Verificar la API vigente con Context7 antes de codificar.
4. Conservar comportamiento funcional: búsqueda normalizada sin tildes (`normalizeSearch`), agrupación con `preferredGroupKey` primero (`groupPriorityDefault` −100), highlight con `<mark>` (`HighlightText`), cierre con click afuera/`Escape`/`Tab`, selección devuelve `supply.id` vía `onChange`, foco inicial en el input de búsqueda.
5. Cero cambios en `data-testid` del trigger ni en la firma `SupplySearchableSelectProps` (`id`, `data-testid`, `supplies`, `value`, `onChange`, `preferredGroupKey`).
6. **Click-afuera y blur con portal**: si el portal es propio, los chequeos "afuera" deben incluir el nodo del listbox portaleado (segundo ref), no solo `containerRef` — tanto en el `mousedown` de `document` como en el `onBlur` del input. Si se usan primitivas de Base UI, esto lo resuelve el primitive: no reimplementarlo.
7. **Accesibilidad equivalente, no idéntica**: conservar un patrón accesible combobox → listbox → option con active-descendant, pero la ubicación exacta de los atributos puede cambiar (Base UI `Combobox` pone `role="combobox"` en el input del popup, no en el trigger — patrón ARIA 1.2). Nada depende del DOM actual: el spec E2E no usa `getByRole('combobox')` para este select y el mock no reproduce roles.
8. **Scroll**: recalcular posición solo ante scroll de página/ancestros del trigger, no ante el scroll interno del `overflow-y-auto` del listbox (un listener ingenuo haría flip al scrollear las opciones). Con listener propio usar fase capture (`addEventListener('scroll', fn, true)`) porque `scroll` no burbujea. Base UI `Positioner` ya lo resuelve con `autoUpdate` de floating-ui.
9. **Ancho del popup**: `w-full` deja de resolver contra el trigger al portalizar — usar `w-(--anchor-width)` (patrón `select.tsx:86`) o medir el `getBoundingClientRect` del trigger. `sm:min-w-[320px]` no debe desbordar el viewport en mobile (~375px): collision handling del `Positioner` o clamp manual.
10. **Trigger con label formateado**: si se usa `Select`/`Combobox` de Base UI, el trigger debe seguir mostrando `formatSupplyLabel(selectedSupply)`, no el id crudo — `Select.Value`/`Combobox.Value` reciben función `(value) => label` o `items` en `Root` (`lecciones-aprendidas.md` ~línea 67).
11. **`data-theme` no aplica hoy**: los portales salen del scope `[data-theme]` (`lecciones-aprendidas.md` ~181, ~202), pero el componente solo vive en el panel oscuro (`<html>` dark) → no agregar prop `dataTheme` ni variante. Dejarlo asentado en lecciones solo si el patrón se reutiliza en el futuro flujo público claro.

## Implementación

### Frontend

- `src/components/productos/supply-searchable-select.tsx`: migrar el listbox a portal posicionado (o a `Combobox` de `@base-ui/react`); eliminar el `useLayoutEffect` manual de `placement`/`maxHeight` si la primitiva lo resuelve (con Base UI sí: `Positioner` + `max-h-(--available-height)`).
- Conservar `scrollIntoView({ block: 'nearest' })` del option activo y, si el DOM resultante lo permite, los ids `${id || fallbackId}-listbox` y `-option-${supply.id}` (los referencian `aria-controls`/`aria-activedescendant`).
- Verificar mobile (~375px): `sm:min-w-[320px]` + collision no deben desbordar el viewport ni tapar el trigger.

### Tests

- Crear `src/components/productos/supply-searchable-select.test.tsx` (no existe hoy). Stubs locales necesarios en jsdom: `Element.prototype.scrollIntoView = jest.fn()` (patrón de `promo-form.test.tsx:83`), `ResizeObserver` y, si la primitiva los invoca, `hasPointerCapture`/`releasePointerCapture`/`setPointerCapture`. Casos mínimos: búsqueda normalizada sin tildes, grupo `preferredGroupKey` primero, selección devuelve `supply.id`, cierre con `Escape`, click en opción selecciona (regresión del riesgo `mousedown`/blur).
- El mock de `promo-form.test.tsx` no debería requerir cambios (firma de props intacta).
- E2E en `tests/e2e/productos-y-recetas.spec.ts` (describe "Edición y eliminación de promos"): agregar **un caso acotado** — login, promo con receta creada por API (patrón del spec), ir a `/productos/{id}/editar`, agregar una segunda fila con `#promo-add-recipe-item`, abrir `recipe-supply-select-{último índice}` y asertar que el listbox queda `toBeVisible`, dentro del viewport (bounding box) y una opción es clickeable de verdad. Cerrar con `Escape`. **No** convertirlo en flujo completo de edición de receta por UI: esa interacción se sacó de E2E por flakiness documentada (spec:488-490); el caso nuevo es una aserción de renderizado/hit-test, no de valor reflejado. Si resulta flaky en la suite completa, quitarlo y dejar nota — la cobertura funcional ya existe por API.

## Fuera de alcance (explícito)

- Sin cambios en `Card`, `promo-form.tsx` (salvo lo indispensable), endpoints ni schema de Drizzle.
- Sin prop `dataTheme` ni variante pública — el componente solo vive en el panel.
- Sin refactor de `promo-options-dialog.tsx` ni de otros selects del sistema.

## Consideraciones de seguridad y entorno

- Sin endpoints ni env vars nuevas.
- E2E solo con `.env.e2e` en base descartable (el `global-setup` trunca tablas; el nombre de la base debe terminar en `test`/`e2e`/`testing`/`qa`/`staging`). Si un `next dev` ajeno ocupa `:3000`, la guardia `x-e2e-server` aborta — cerrar ese dev server o dejar E2E para CI.

## Criterios de aceptación

- [ ] Abrir el select en la **última** fila de insumos muestra el listado completo (o con scroll interno usable), sin recorte por el `Card`.
- [ ] En filas medias el dropdown no queda solapado bajo el borde del card (flip top si no hay espacio abajo).
- [ ] Click afuera, `Escape` y `Tab` cierran; click en opción selecciona (sin cierre prematuro por `mousedown`/`blur` sobre el portal).
- [ ] Búsqueda sin tildes, grupos con `preferredGroupKey` primero e highlight `<mark>` intactos.
- [ ] Con el dropdown abierto, scrollear la página mantiene el anclaje al trigger (no queda flotando desalineado) y el scroll interno de opciones no provoca flip.
- [ ] `recipe-supply-select-${index}` sigue en el trigger; `promo-form.test.tsx` pasa sin tocar el mock; `promo-recipe-${index}` sigue como `id`/`htmlFor`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo |
| `npx tsc --noEmit` | Tipos |
| `npm test` | Unitarios (spec nuevo + `promo-form.test.tsx` sin cambios) |
| `npm run build` | Build de producción (checklist pre-push) |
| `npm run knip` | Código muerto si se elimina lógica de posicionamiento manual |
| `npm run dev` + prueba manual | Abrir select en primera y última fila, scrollear la página con el dropdown abierto, probar en ~375px |
| `npm run test:e2e` (`.env.e2e`, base descartable) | Solo `productos-y-recetas.spec.ts` si se agregó el caso E2E |

## Cierre de la tarea

- Regla de índices del proyecto: al resolverse, mover este prompt a `.devin/prompts/archivados/` y actualizar `.devin/prompts/README.md` y `.devin/README.md` (lista de entrada + bloque Estructura) en el mismo cambio.
- Si el patrón portal+floating queda como referencia para futuros dropdowns propios, dejar nota en `.devin/informes/lecciones-aprendidas.md` (junto a las lecciones de portales/`data-theme`), incluyendo el detalle del `mousedown`/`blur` que asume DOM contenido.
