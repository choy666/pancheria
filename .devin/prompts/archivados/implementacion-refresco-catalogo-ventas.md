# Prompt: Refresco en vivo del catálogo de `/ventas` (Fase 1 de la sincronización `/ventas` ↔ `/pedido`)

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/checklist-pre-push.md`
- `.devin/informes/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` — **fuente de verdad de esta tarea**: §3 (refresco en vivo, opciones evaluadas), §6 (garantías del POS a preservar), §7 (riesgos E2E/tour), §8.2 (fases propuestas).

Todo el trabajo, comentarios y documentación en español.

## Alcance

**Implementación acotada a una fase.** Solo el refresco en vivo del catálogo del terminal `/ventas`. No se toca tema visual, layout, la card, el diálogo de opciones, el quick-add, el agrupado ni ningún selector/`data-testid`/`data-tour`. Las fases restantes (tema claro híbrido, quick-add) tienen prompts dedicados posteriores.

## Estado actual verificado (punto de partida — no re-derivar)

Verificado contra `HEAD` `3a905ac` en la auditoría:

- `/ventas` carga el catálogo **una sola vez al montar**: `useEffect` con `[]` → `fetchProducts()` → `fetchAllPages` sobre `GET /api/productos?includeAvailability=true` (`src/components/ventas/sales-terminal.tsx:121-158`, `src/lib/fetch-all-pages.ts`, `src/app/api/productos/route.ts:9-24`).
- El precheck reactivo ya existe: efecto sobre `[lines, products]` con debounce 300 ms → `POST /api/ventas/disponibilidad` con `{ items, productIds: products.map(p => p.id) }` — **todo el catálogo** — y guarda `availabilityByProduct` + `shortageByProduct` detallado en `cartAvailability`/`cartShortage` (`sales-terminal.tsx:160-225`). Deduplicación por `availabilityRequestIdRef`.
- `isCheckingAvailability` bloquea "Confirmar venta" y muestra "Verificando disponibilidad…" en `confirm-sale-blocker` (`src/components/ventas/sales-cart.tsx:75-99`).
- Post-venta: `router.refresh()` + `refresh()` (caja) + `fetchProducts()` (`sales-terminal.tsx:366-371`).
- La caja ya hace polling propio cada 5 s vía `useCashRegister` → `useVisibilityPolling` (`src/hooks/useCashRegister.ts:73`, `src/config/caja.ts:163-171`); es independiente y no se toca.
- `useVisibilityPolling(callback, intervalMs, enabled, immediate, onResume)` pausa con pestaña oculta y al reanudar ejecuta `onResume?.()` + callback inmediato (`src/hooks/use-visibility-polling.ts:19-89`).
- `POST /api/ventas/disponibilidad` acepta `items` + `productIds` (≤500, `cartAvailabilitySchema`), aplica reservas activas de pedidos `in_process` y devuelve shortage interno con `supplyName`/cantidades (`src/app/api/ventas/disponibilidad/route.ts`, `src/lib/product-helpers.ts:483-550`).
- Referencia del patrón: `/pedido` hace `useVisibilityPolling(() => { refreshCatalog(); fetchBranchStatus(); }, getPedidoRefetchIntervalMs(), true, false)` (`src/components/pedido/usePedidoClient.ts:402-410`) y `refreshCatalog` refresca primera página + disponibilidad de extras con `POST ... {items: [], productIds}` (`usePedidoClient.ts:302-363`).
- Tests unitarios del terminal en `src/components/ventas/sales-terminal.test.tsx` (jsdom, `global.fetch` mockeado por URL, `useCashRegister` mockeado).

## Decisiones ya tomadas (no re-debatir)

1. **El tick periódico es el POST de disponibilidad, no `GET /api/productos`.** Es el contrato que ya devuelve disponibilidad viva de todo el catálogo (incluye reservas y stock cruzado) y es más liviano que re-paginar productos. Detecta cambios de stock/ventas/reservas, que es el caso común.
2. **`fetchProducts()` completo se dispara al reanudar visibilidad** (`onResume` de `useVisibilityPolling`), que es el momento en que importa ver altas/bajas/ediciones de catálogo hechas mientras la pestaña dormía. El cambio de `products` dispara el efecto existente y repuebla disponibilidad.
3. **Variable de entorno propia**, no reusar `getPedidoRefetchIntervalMs`: semántica y cadencias distintas (tráfico público vs terminal). `0` deshabilita el polling (patrón `getPedidosRefreshIntervalMs`, `src/config/orders.ts:64-73`).
4. **El polling es siempre silencioso**: actualiza `cartAvailability`/`cartShortage` sin tocar `isCheckingAvailability` ni `setError` — el blocker `confirm-sale-blocker` no debe parpadear cada intervalo.
5. **Sigue corriendo con caja cerrada**: el operador lee el catálogo y la disponibilidad antes de abrir; `addToCart` ya bloquea por `cartDisabled` (`sales-terminal.tsx:231,398`).
6. **La transacción sigue siendo la única garantía real**: el polling es precheck informativo; `POST /api/ventas` → `confirmSale` es quien bloquea stock en definitiva.

## Objetivo

Que la disponibilidad visible en `/ventas` se mantenga fresca durante la sesión sin interacción del operador: ventas de otra terminal, reservas de pedidos públicos `in_process` y cambios de stock/catálogo deben reflejarse en ≤ el intervalo configurado, sin spinners ni bloqueos espurios del confirm.

## Reglas de negocio

1. El tick periódico envía el **carrito actual + todos los `productIds`** (mismo cuerpo que el precheck reactivo), así `cartAvailability` y `cartShortage` se actualizan considerando lo que ya está en la venta.
2. Un tick nunca interfiere con un precheck en vuelo: comparten `availabilityRequestIdRef`; el request más reciente gana.
3. No disparar el tick mientras `isSubmitting` (la confirmación de venta en curso ya refrescará al terminar, vía `confirmSale`).
4. `products` solo se re-descarga al montar, al reanudar visibilidad y post-venta (comportamiento existente + `onResume`).
5. Si el endpoint falla en un tick, error silencioso (mismo criterio del catch actual del precheck: el confirm mostrará el problema real).
6. El toggle "Mostrar agotados" (`toggle-show-out-of-stock`) y `displayProducts` reaccionan solos a `cartAvailability` nuevo — sin lógica adicional.
7. Cero cambios en markup/atributos: `data-testid`, `data-tour`, `role`, `aria-*` intactos.

## Implementación detallada

### Config

- Nuevo `src/config/ventas.ts` con `getVentasCatalogRefreshIntervalMs()`:
  - Lee `NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS`.
  - Default `30_000` cuando la variable no existe.
  - `0` (o inválido ≤ 0) → devuelve `0` = **deshabilitado** (el hook recibe `enabled: false`).
  - Mínimo `5_000` para valores positivos menores (proteger Neon: cada tick ejecuta `validateCartAvailability` con el contexto completo).
  - Patrón de `getPedidosRefreshIntervalMs` (`src/config/orders.ts:64-73`) y `getCajaRefreshInterval` (`src/config/caja.ts:163-171`), con comentario explicando qué refresca (disponibilidad viva del catálogo del POS) y que `0` deshabilita.

### Frontend

- `src/components/ventas/sales-terminal.tsx`:
  - Extraer el cuerpo del `setTimeout` del efecto `[lines, products]` (líneas 165-220) a una función `runAvailabilityCheck(options?: { silent?: boolean })` dentro del componente:
    - Construye `requestItems` igual que hoy (`groupCartItemsForSubmit` sobre `lines`) y `productIds: products.map(p => p.id)`.
    - `requestId` compartido con `availabilityRequestIdRef` (incrementar siempre; chequear antes de aplicar resultados — igual que ahora).
    - `silent: false` → comportamiento actual: `setIsCheckingAvailability(true)` antes y `false` al resolver (en el `finally`, solo si es el request vigente).
    - `silent: true` → no toca `isCheckingAvailability` ni `setError`; mismo catch silencioso.
  - El efecto actual pasa a llamar `runAvailabilityCheck()` (no silencioso) dentro del mismo debounce de 300 ms, preservando la semántica exacta.
  - Agregar `useVisibilityPolling`:
    - `callback`: `() => { if (!isSubmittingRef.current) void runAvailabilityCheck({ silent: true }); }` — usar una ref para `isSubmitting` (o la condición equivalente) para no re-crear el intervalo.
    - `intervalMs`: `getVentasCatalogRefreshIntervalMs()`.
    - `enabled`: `interval > 0` y `products.length > 0` (sin catálogo no hay nada que refrescar; evaluar contra el estado o una ref).
    - `immediate`: `false` (el montaje ya dispara `fetchProducts` + el primer precheck por el cambio de `products`).
    - `onResume`: `() => void fetchProducts()` — recarga catálogo completo (altas/bajas/ediciones). `fetchProducts` ya guarda disponibilidad inicial vía `includeAvailability` y dispara el efecto de `[lines, products]`.
  - Opcional (recomendado): parámetro `silent` también en `fetchProducts` para que el refresh de `onResume` no ponga `isCheckingAvailability`/`loading` visible — mantener `loading` solo para la carga inicial (guardar con `hasLoadedRef` o similar).
  - **No cambiar**: `addToCart`, `confirmSale`, `displayProducts`, markup, `data-tour`, `data-testid`, el diálogo, la card.

### Tests

- Nuevo `src/config/ventas.test.ts` (patrón `src/config/orders.test.ts`/`caja.test.ts`): default 30000, respeta la variable, `0` e inválidos → deshabilitado/default según corresponda, menores al mínimo → 5000.
- `src/components/ventas/sales-terminal.test.tsx`: agregar casos con `jest.useFakeTimers()` (ver cómo manejan timers los tests existentes antes de elegir entre fake timers y `waitFor`):
  - tras la carga inicial, avanzar el intervalo dispara **otro** POST a `/api/ventas/disponibilidad` sin cambios en el carrito;
  - el tick no deja `isCheckingAvailability` activo: "Confirmar venta" no queda bloqueado por el refresco ni aparece "Verificando disponibilidad…";
  - el tick envía `productIds` de todo el catálogo cargado;
  - con intervalo `0` (mockear `getVentasCatalogRefreshIntervalMs`) no se programa llamada adicional;
  - (si el harness lo permite) `visibilitychange` → vuelve a llamar `GET /api/productos`.
- No crear tests E2E nuevos ni modificar specs: no hay cambios de contrato. Para determinismo total en la suite E2E, ver "Variables de entorno".

### Variables de entorno y documentación

- `.env.example`: documentar `NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS` (default 30000, mínimo 5000, `0` deshabilita) en la sección de variables del panel/ventas, siguiendo el estilo comentado de `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` y `NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS`.
- `.env.e2e.example`: agregar `NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS=0` con comentario — la suite E2E corre determinista sin polling; la cobertura del refresco es unitaria.
- `AGENTS.md` → sección "Variables de entorno": agregar la variable con su descripción (misma sección donde están `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` y `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS`).

## Fuera de alcance (explícito)

- No portar `[data-theme='light']` ni ningún cambio visual (Fase 2).
- No quick-add ni cambio de interacción de la card (fase posterior, pendiente de datos de personalización).
- No agrupar por tipo ni headers (Fase 2).
- No tocar `useCashRegister`, `CajaStatus`, `PaymentPartsInput`, `SalesCart` (salvo que el flag `isCheckingAvailability` requiera un ajuste menor de prop — preferir no tocar).
- No crear endpoints nuevos ni modificar `validateCartAvailability`, `cartAvailabilitySchema` ni esquema/migraciones.
- No cambiar `getPedidoRefetchIntervalMs` ni el comportamiento público.

## Consideraciones de seguridad y entorno

- No hardcodear URLs ni parámetros: usar `VENTAS_DISPONIBILIDAD_API` y `PRODUCTOS_API` de `src/config/api.ts` (ya importados) y la env nueva.
- `authenticatedFetch` como hoy para ambos endpoints (autenticados, scope por `branchId` de la sesión).
- El POST de disponibilidad es de solo lectura (precheck); no escribe nada en la base.
- Pensar en carga: cada tick hace el cálculo completo de disponibilidad; el mínimo 5000 ms existe para no martillar Neon con terminales múltiples. Documentar en `.env.example` que subir el intervalo es la válvula de escape.
- E2E solo con `.env.e2e` en base descartable (el `global-setup` trunca tablas).
- `setState` en `useEffect` solo para carga asíncrona con flag de montaje (lección ya registrada): el tick usa `isMountedRef` como el precheck actual.

## Criterios de aceptación

- [ ] Con la página abierta y sin tocar el carrito, una venta confirmada en otra sesión se refleja en "Disponible"/"Podés sumar" en ≤ el intervalo configurado.
- [ ] El tick no muestra "Verificando disponibilidad…" ni bloquea "Confirmar venta" en ningún momento.
- [ ] Ocultar la pestaña pausa el polling; al volver, el catálogo se re-descarga (`fetchProducts`) y la disponibilidad se repuebla.
- [ ] `NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS=0` apaga el polling por completo (sin requests extra tras la carga inicial).
- [ ] Productos que pasan a agotados por ventas ajenas se ocultan del grid por defecto y aparecen con "Mostrar agotados"; los que vuelven a tener stock reaparecen.
- [ ] `shortageByProduct`/`cartShortage` siguen mostrando insumos internos; ningún comportamiento de `confirm-sale-blocker` cambió salvo datos más frescos.
- [ ] Todos los specs E2E existentes pasan sin modificaciones.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Tipos |
| `npm test` | Tests unitarios (incluye los nuevos de config y del terminal) |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto (la nueva función config debe estar usada) |
| `npm run test:e2e` (con `.env.e2e`, base descartable) | Regresión de `ventas-*`, `tour`, `responsive` |

## Cierre de la tarea

- Actualizar el informe `.devin/informes/auditoria-sincronizacion-ventas-pedido-2026-10-25.md`: marcar en §8.2 la Fase de refresco como implementada (o nota breve de estado), manteniendo el informe abierto mientras queden fases pendientes.
- Si se mergea un PR, `reporte-estado.md` §0 se actualiza según la convención del proyecto.
- No archivar el informe de la auditoría ni este prompt hasta completar todas las fases.
