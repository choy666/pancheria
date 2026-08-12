# Prompt: Arreglar el recorrido interactivo iniciado desde el navbar

> **Resuelto.** Este prompt ya fue implementado en `src/components/tour/tour-context.tsx`. El recorrido ahora se reinicia desde cualquier página con `restartTour`, los pasos usan `skipMissingElement` y los callbacks globales invocan directamente `driver.moveNext()` / `driver.movePrevious()`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- `driver.js` v1.8.0 para tours interactivos

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>

## Estado actual relevante

El tour interactivo está implementado en <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" /> y se expone a través del componente `TourButton` en la navbar (<ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />).

Los pasos del tour combinan popovers modales (sin `element`) y pasos que resaltan elementos con `data-tour` distribuidos en distintas rutas:

- Paso 0: "Bienvenido a Panchería" — popover centrado.
- Paso 1: resalta `[data-tour="dashboard-header"]` en `/`.
- Paso 2: resalta `[data-tour="main-nav"]` en `/`.
- Paso 3: resalta `[data-tour="dashboard-ventas"]` en `/`; al avanzar navega a `/ventas`.
- Paso 4: resalta `[data-tour="caja-status"]` en `/ventas`.
- Paso 5: resalta `[data-tour="sales-products"]` en `/ventas`.
- Paso 6: resalta `[data-tour="sales-cart"]` en `/ventas`; al avanzar navega a `/productos`.
- Paso 7: resalta `[data-tour="products-table"]` en `/productos`.
- Paso 8: resalta `[data-tour="products-new-product"]` en `/productos`; al avanzar navega a `/stock`.
- Paso 9: resalta `[data-tour="stock-table"]` en `/stock`.
- Paso 10: resalta `[data-tour="caja-panel"]` en `/cierre`; al avanzar navega a `/cierre/historial`.
- Paso 11: resalta `[data-tour="closure-history-table"]` en `/cierre/historial`.
- Paso 12: "Fin del recorrido" — popover centrado.

La navegación entre páginas se maneja guardando el índice del paso destino en `localStorage` bajo `pancheria-tour-step` y marcando `pancheria-tour-active`, destruyendo la instancia de `driver.js` y usando `router.push`. Al llegar a la nueva ruta, el `useEffect` de `TourProvider` reanuda el tour con `startTour(savedStep)`.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="134-156" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="158-292" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="353-359" />

## Problema

1. **El botón "Guía" de la navbar no inicia el recorrido correctamente desde cualquier página.** Si el usuario está en `/productos`, `/stock`, `/cierre`, `/ventas/historial`, etc., y presiona "Guía", el tour arranca en el paso 0 ("Bienvenido"), pero al avanzar al paso 1 intenta resaltar `[data-tour="dashboard-header"]`, que no existe fuera de `/`. El popover no se ancla a ningún elemento, la experiencia se rompe y los botones "Siguiente"/"Anterior" parecen no responder. El comportamiento esperado es que presionar "Guía" siempre reinicie el tour y ubique al usuario en `/`, resaltando el panel de control.

2. **Los botones "Siguiente" y "Anterior" del popover no avanzan/retroceden correctamente en algunos pasos.** Actualmente los callbacks globales `onNextClick` y `onPrevClick` en la configuración de `driver()` tienen una guarda que retorna cuando `step.popover?.onNextClick` o `step.popover?.onPrevClick` existen:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" lines="330-337" />

Como `driver.js` ya elige el callback del paso sobre el global (`step.popover?.onNextClick || getConfig("onNextClick")`), esa guarda es redundante, confusa y puede dificultar la depuración. Además, cuando un paso que requiere navegación define `onNextClick`/`onPrevClick` a nivel de popover, ese callback debe destruir el tour, guardar el paso destino y navegar; cualquier error en el orden o en el manejo de la bandera `isNavigatingRef` puede dejar el tour sin reanudar en la página destino.

## Objetivo

- Al presionar el botón "Guía" en la navbar, **sin importar en qué página se encuentre el usuario**, el tour debe reiniciar desde el paso 0 y finalizar en `/`, resaltando el primer elemento (`[data-tour="dashboard-header"]`).
- Los botones "Siguiente" y "Anterior" del popover deben funcionar en todo el recorrido: dentro de una misma página deben avanzar/retroceder entre pasos, y en los pasos que cambian de ruta deben navegar y reanudar el tour en el paso correcto.
- El estado de `localStorage` debe mantenerse consistente: al cerrar el tour se debe limpiar `pancheria-tour-step` y `pancheria-tour-active`; al navegar entre páginas del tour se debe guardar el paso destino y marcar el tour como activo.
- No se deben hardcodear URLs de navegación en el tour.

## Reglas de negocio

1. El tour siempre comienza desde el paso 0 cuando se inicia manualmente con el botón "Guía".
2. Las rutas de navegación entre pasos deben obtenerse de las rutas de la aplicación (por ejemplo `navItems` o una constante de rutas) y no escribirse directamente como strings en el tour.
3. El botón "Guía" en la navbar debe reiniciar el tour: si la página actual no es `/`, debe guardar el paso `0` en `localStorage`, marcar `pancheria-tour-active = true`, destruir cualquier instancia activa de `driver.js` y navegar a `/`. Si ya se está en `/`, debe iniciar el tour directamente en el paso 0.
4. Los callbacks globales `onNextClick` y `onPrevClick` deben llamar siempre a `driver.moveNext()` / `driver.movePrevious()` para los pasos que no tienen handler propio.
5. Los callbacks a nivel de paso (`nextOn` / `prevOn`) deben:
   - Guardar el índice del paso destino en `localStorage`.
   - Marcar el tour como activo.
   - Destruir la instancia actual de `driver.js`.
   - Usar `router.push` para navegar.
6. Al llegar a una nueva ruta, el `useEffect` de `TourProvider` debe reanudar el tour en el paso guardado, siempre que `pancheria-tour-active` sea `true`.
7. Si un elemento `data-tour` no está disponible en la página actual, el tour no debe bloquearse; considerar habilitar `skipMissingElement` o manejar el error de forma elegante.

## Implementación detallada

### Frontend

- `src/components/tour/tour-context.tsx`
  - Añadir una función `restartTour` (o equivalente) al contexto, expuesta para el botón de navbar.
  - `restartTour` debe:
    - Llamar `stopTour()` si hay una instancia activa.
    - Guardar el paso `0` en `localStorage` y marcar el tour activo.
    - Si `pathname !== '/'`, destruir el driver y ejecutar `router.push('/')`.
    - Si `pathname === '/'`, ejecutar `startTour(0)`.
  - Revisar los callbacks globales `onNextClick` y `onPrevClick` para eliminar la guarda redundante. El global debe llamar `driver.moveNext()` / `driver.movePrevious()` directamente.
  - Considerar añadir `skipMissingElement: true` a los pasos que resaltan elementos, para evitar que el tour se rompa si el usuario accede a una página sin el `data-tour` correspondiente.
  - Revisar que `isNavigatingRef` se resetee correctamente al iniciar, navegar y destruir.

- `src/components/panel/panel-header.tsx`
  - El `TourButton` sigue usando `useTour`; si se añade `restartTour`, actualizar el botón para usar la nueva función cuando el tour no esté activo.

### Tests

- `src/components/tour/tour-context.test.tsx`
  - Añadir un test que simule estar en `/productos` (u otra ruta), presionar el botón "Guía" y verificar que:
    - Se guarda `pancheria-tour-step = 0`.
    - Se guarda `pancheria-tour-active = true`.
    - Se llama a `router.push('/')`.
  - Añadir un test que simule estar en `/`, presionar el botón "Guía" y verificar que `startTour(0)` se invoca sin navegación.
  - Extender los tests de `onNextClick`/`onPrevClick` para verificar que el callback global siempre llama a `moveNext`/`movePrevious`.

- `tests/e2e/tour.spec.ts`
  - Extender el test E2E para cubrir:
    - Iniciar el tour desde `/productos` y verificar que se navega a `/` y aparece el popover "Bienvenido a Panchería".
    - Avanzar hasta el paso de "Ventas", presionar "Siguiente" y verificar que se navega a `/ventas` y aparece "Estado de la caja".
    - Presionar "Anterior" en `/ventas` y verificar que se vuelve a `/` en el paso "Ventas".
    - Completar el recorrido hasta el paso final y presionar "Finalizar".

## Archivos y áreas a tocar

- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.test.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/tour.spec.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" />

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni URLs de API.
- Las URLs de navegación deben provenir de la configuración de rutas de la aplicación.
- Los tests E2E truncan tablas de la base de datos; ejecutarlos solo en un entorno de prueba.
- `.env.local` no debe commitearse.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificar tipos de TypeScript |
| `npm run lint` | Lint y formato |
| `npm test` | Tests unitarios del tour |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Flujo completo del tour en entorno de prueba |
