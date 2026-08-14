# Prompt: Hacer responsive el tour-guía y permitir iniciarlo desde cualquier página

## Pre-condición antes de codear

Antes de escribir código o proponer cambios, leé los archivos listados en **Contexto** y usalos como fuente de verdad. Si algo de esa documentación contradice este prompt, avisá antes de continuar.

Al terminar la lectura, antes de tocar código, dejá en la respuesta:

1. Confirmación en 2-3 líneas de las lecciones aprendidas que aplican.
2. Listado de archivos que vas a modificar.
3. Comandos de verificación que vas a correr (`npm run lint`, `npm run build`, `npm test`, `npx tsc --noEmit`, `npm run test:e2e`).

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/diseno-responsive.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado-2026-08-13.md" />

Código relevante:
- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/globals.css" />
- <ref_file file="C:/developer/paginas/pancheria/src/config/routes.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/tour.spec.ts" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/responsive.spec.ts" />

## Estado actual relevante

El tour usa `driver.js` y está envuelto en `<TourProvider>` en <ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" lines="34-53" />.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="56-79" />

El botón `Guía` se renderiza dos veces dentro de `PanelHeader`: una en la barra de escritorio y otra dentro del menú hamburguesa móvil.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" lines="56-79" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" lines="110-149" />

El `restartTour` ya redirige a `/` si se inicia desde otra página:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="460-475" />

Los pasos del tour apuntan a `[data-tour="main-nav"]`, que es la navegación de escritorio (`hidden lg:flex`). En móvil ese elemento está oculto, por lo que el paso se saltea silenciosamente. Además, al tocar `Guía` desde el menú hamburguesa abierto, el menú no se cierra y tapa el recorrido.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="202-230" />

El popover del tour se estiliza en <ref_snippet file="C:/developer/paginas/pancheria/src/app/globals.css" lines="142-149" />, pero no tiene ajustes específicos para viewports pequeños.

## Objetivo

1. Corroborar que el tour-guía sea **responsive**: en móvil el popover debe verse completo, sin ser tapado por el menú hamburguesa ni desbordar el viewport.
2. Permitir **iniciar el tour desde cualquier página** sin errores ni obstáculos: el botón `Guía` debe funcionar en escritorio y en móvil, cerrar el menú hamburguesa si está abierto, y redirigir a `/` cuando corresponda.
3. Mantener el recorrido dinámico según el rol (`admin` / `operator`).
4. Agregar o ajustar tests E2E y unitarios para evitar regresiones.

## Reglas de negocio

1. **No hardcodear rutas**: toda navegación del tour debe usar `src/config/routes.ts`.
2. **Cerrar el menú móvil antes de iniciar el tour**: si el usuario toca `Guía` desde el menú hamburguesa abierto, el menú debe cerrarse antes de que `driver.js` empiece.
3. **El tour debe funcionar en cualquier página**: si no estamos en `/`, `restartTour` debe seguir redirigiendo a `/` y luego iniciar; si ya estamos en `/`, debe iniciar directamente.
4. **Paso de navegación visible en móvil**: el paso que describe el menú debe tener sentido en móvil. Agregar un `data-tour` al botón de hamburguesa y/o al menú móvil, y usar `skipMissingElement: true` para evitar errores cuando un elemento no esté presente. Como `driver.js` no descarta automáticamente elementos ocultos por CSS, el `element` del paso debe ser una función que devuelva el nodo solo si es visible.
5. **Popover responsive**: en viewports pequeños (375 px), el popover no debe desbordar la pantalla; ajustar `max-width`, `stagePadding`, `popoverOffset` y, si es necesario, el CSS de `.pancheria-tour-popover`.
6. **Áreas táctiles mínimas**: botones del tour, del menú y del popover deben mantener al menos 44×44 px.
7. **No romper el comportamiento actual**: seguir respetando el `isNavigatingRef` para no detener el tour accidentalmente durante navegaciones, y mantener `skipMissingElement: true` en elementos asíncronos.
8. **No modificar esquema de base de datos** ni agregar variables de entorno para este cambio.

## Implementación detallada

### 1. `src/components/panel/panel-header.tsx`

- Agregar `data-tour="mobile-menu-button"` al botón de hamburguesa.
- Asegurar que el menú móvil tenga su propio `data-tour` si se quiere resaltar abierto (por ejemplo `data-tour="mobile-nav"`).
- Antes de que `TourButton` invoque `restartTour` o `stopTour` desde el menú móvil, cerrar el menú (`setOpen(false)`).  
  Opción recomendada: agregar una prop opcional `onBeforeToggle` a `TourButton` que se dispare antes de la acción; el header de escritorio no necesita pasarla.

### 2. `src/components/tour/tour-context.tsx`

- Extender `TourButtonProps` con una prop opcional `onBeforeToggle?: () => void` y llamarla antes de `restartTour` / `stopTour`. No es necesario exportar la interfaz para que `panel-header.tsx` la use, pero si se prefiere tipar el callback allí, exportarla es opcional.
- En `buildSteps`:
  - Mantener los pasos actuales según rol.
  - Agregar un paso para móvil que apunte a `data-tour="mobile-menu-button"` con `skipMissingElement: true`, de modo que en escritorio se salte y en móvil se muestre una referencia al menú.
    - **Importante:** el botón hamburguesa existe en el DOM aunque esté oculto en escritorio (`lg:hidden`), y el menú de escritorio (`data-tour="main-nav"`) existe aunque esté oculto en móvil. `driver.js` no salta un elemento solo por estar oculto con CSS. Para que se omita correctamente, el `element` del paso debe ser una función que devuelva el nodo solo si `getBoundingClientRect().width > 0` y `height > 0`. Aplicar la misma lógica al paso "Menú superior" (`data-tour="main-nav"`) para que en móvil apunte al menú desplegado o se salte.
  - Agregar `popoverOffset` y `stagePadding` en la `Config` de `driver` (son propiedades globales, no por paso) para que el popover no quede fuera de la pantalla en móvil.
- En `restartTour`, asegurar que el estado `open` del header móvil no interfiera. Si es necesario, exponer un mecanismo limpio para cerrar el menú desde el header (preferir props, no levantar estado de UI a `TourProvider`).
- Verificar que `onDestroyStarted` y `onDestroyed` no desactiven el tour cuando `isNavigatingRef.current` es `true`, para evitar que un reinicio desde otra página lo cancele.
- Revisar `driver` config: `popoverClass: 'pancheria-tour-popover'` ya existente. Opcionalmente evaluar `allowScroll: false`, teniendo en cuenta que impide el scroll automático hacia el elemento resaltado; en móvil esto puede dejar el popover fuera de la vista si no se ajusta manualmente.

### 3. `src/app/globals.css`

- Ajustar `.pancheria-tour-popover` para móvil:
  - Limitar `max-width` a `90vw` o `min(90vw, 320px)`, evitando que el popover desborde el viewport.
  - Asegurar que el título y la descripción hagan `word-break: break-word` u `overflow-wrap: break-word`.
  - Si los botones del footer quedan muy juntos, aumentar el `gap` o el `padding` en pantallas pequeñas.
  - Considerar `max-height: 80vh` con `overflow-y: auto` si el contenido es largo.
  - Verificar que los botones del footer (`driver-popover-footer-btn` y similares) mantengan un área táctil mínima de 44×44 px; si el test de áreas táctiles los reporta, aumentar el `padding` o el `min-height`.

### 4. Tests

- En `tests/e2e/tour.spec.ts`:
  - `playwright.config.ts` solo define el proyecto `chromium` desktop, por lo que para simular móvil se debe usar `page.setViewportSize({ width: 375, height: 667 })` dentro del test.
  - Agregar un test con viewport móvil (375×667) que:
    1. Inicie sesión.
    2. Abra el menú hamburguesa.
    3. Toque `Guía`.
    4. Verifique que el menú se cerró (`aria-expanded="false"`).
    5. Verifique que el popover del tour es visible y no está cortado.
    6. Avance al menos un paso y confirme que no hay errores.
  - Mantener el test de reinicio desde cualquier página, cubriendo el caso móvil si aplica.
- En `tests/e2e/responsive.spec.ts`:
  - Ampliar el test del menú hamburguesa para verificar que el botón `Guía` es visible y clickeable dentro del menú móvil.
- En `src/components/tour/tour-context.test.tsx`:
  - Si se agrega `onBeforeToggle` a `TourButton`, agregar un test que verifique que se llama antes de `restartTour` / `stopTour`.
  - Verificar que el tour no se inicia dos veces si ya está activo.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni secretos.
- `npm run test:e2e` trunca tablas de negocio y ejecuta el seed. Correrlo solo en una base de datos de prueba y con confirmación explícita.
- No modificar `.env.local` ni agregar variables sensibles.
- No commitear archivos de entorno.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad de código |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba (requiere confirmación) |
