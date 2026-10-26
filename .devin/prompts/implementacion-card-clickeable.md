# Prompt: Card clickeable completa (tap-to-add) en `/ventas` y `/pedido` + depuración de la card sales

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:

- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/checklist-pre-push.md`
- `.devin/informes/archivados/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` — contexto de por qué la card dejó de ser `role="button"` (§4, §6-7).

Todo el trabajo, comentarios y documentación en español.

## Alcance

Tres cambios acotados a la card de producto compartida (`ProductCardBase`), pensados para agilizar la facturación en tablet y limpiar la superficie:

1. Eliminar el badge `+N opcionales` de la variante `sales`.
2. Desduplicar la línea "Disponible: N unidad · Podés sumar: M más" (variante `sales`).
3. Que toda la superficie de la card (ambas variantes) agregue una unidad al carrito con click/touch — quick-add con la selección por defecto, igual que el botón "Agregar".

No se toca el diálogo de personalización, el carrito, endpoints, ni el tema visual.

## Estado actual verificado (punto de partida — no re-derivar)

- `ProductCardBase` (`src/components/productos/product-card-base.tsx`):
  - `variant="catalog"` (132-237): card presentacional + hero `aspect-video` + pill "Promo" + badge `N en tu pedido` + botones `customize-product-${id}` (solo `hasOptions`) y `add-product-${id}` (quick-add).
  - `variant="sales"` (245-363): mismo lenguaje visual + badge tipo (no compuestos) + badge `+N opcionales` (291-295, alimentado por `optionalItems`, 243) + línea "Disponible: N unidad · Podés sumar: M más" (303-323) + acciones `customize-sale-product`/`add-sale-product` (327-360).
- `product.availability` = disponibilidad total del catálogo (pesimista con reservas); `maxAdditional` = remanente tras el consumo del carrito (`cartAvailability` ← `POST /api/ventas/disponibilidad` → `validateCartAvailability`, `product-helpers.ts:616-650`). Con carrito vacío coinciden → redundancia visual; difieren cuando el producto está en la venta o cuando otra promo del carrito consumió sus insumos (caso de `ventas-stock-compartido.spec.ts:96`).
- `useSellableCart.addItem(product)` sin selección aplica `getDefaultSelectedRecipeItemIds` + capea a `maxOptionalSelections` y rechaza agotados vía `onOutOfStock` (`useSellableCart.ts:86-163`).
- Todos los specs E2E interactúan por testid de botón (`add-sale-product`, `customize-sale-product`, `add-product-${id}`, `customize-product-${id}`); **ninguno** clickea el cuerpo de la card ni aserta el badge de opcionales.
- `eslint-config-next` trae `jsx-a11y/click-events-have-key-events` y `no-static-element-interactions` como error: un `onClick` sobre un `div` exige `eslint-disable` — evitarlo con el patrón de la Regla 1.

## Objetivo

Card más limpia (sin badge de opcionales ni números redundantes) y target de agregado = toda la superficie, para facturación rápida en tablet sin sacrificar accesibilidad ni los selectores existentes.

## Decisiones ya tomadas (no re-debatir)

1. **Stretched button** para el click de superficie: un `<button>` real `absolute inset-0 z-10` dentro del `Card` (que pasa a `relative select-none`), no un `onClick` en el contenedor ni `role="button"` (regresión explícita de la Fase 2: anidar botones dentro de `role="button"` es ARIA inválido). Los botones internos (`customize-*`, `add-*`) quedan a `relative z-20`: como son **hermanos** del overlay y no hijos, no hace falta `stopPropagation` — el hit-test los resuelve por encima.
2. **"Podés sumar" condicional**: se muestra solo cuando `isOutOfStock || maxAdditional !== product.availability`. Con carrito vacío queda solo "Disponible: N unidad"; cuando difiere (ítems propios o insumos compartidos consumidos) ambos números son informativos y se muestran.
3. **Badge eliminado del todo**: se borra el badge `+N opcionales` y la variable `optionalItems` (queda sin uso); el dato no se conserva en la card — el botón de personalizar ya indica que hay opcionales.
4. **Ambas variantes**: el gesto aplica a `sales` y a `catalog` (aceptado el riesgo de mis-tap en el flujo público; el badge `N en tu pedido` hace visible el agregado).
5. **El botón "Agregar" visible se conserva** en ambas variantes: affordance, fallback accesible y cero regresión de specs.

## Reglas de negocio

1. Click/touch en cualquier zona de la card = quick-add de 1 unidad con `selectedByDefault` (mismo `onAdd()` que el botón "Agregar"); los opcionales nunca se fusionan (línea propia por unidad personalizable) y los demás productos fusionan como hoy.
2. El overlay lleva `aria-label` contextual igual que el botón visible (`sales`: "Agregar {name} a la venta" / "Agregar otro {name} a la venta" / "{name} agotado"; `catalog`: "Agregar {name} al pedido" / equivalentes) y `disabled={isDisabled}` — agotado o caja cerrada lo inactivan junto con la card (`opacity-50`, `data-out-of-stock` intactos).
3. "Podés sumar: N más" solo cuando `isOutOfStock || maxAdditional !== product.availability`; "Sin stock" siempre que `isOutOfStock` (incluido el borde `availability === maxAdditional === 0`); `service` intacto ("Disponible: sin límite").
4. Cero cambios en `data-testid`/`data-product-name`/`data-out-of-stock`/`product-card-cart-quantity-*`/`add-product-${id}`/`customize-*` existentes. El overlay recibe testid propio (`add-sale-product-surface` / `add-product-surface-${id}`) solo para tests unitarios; los E2E ejercitan el gesto con `card.click()` (el centro cae sobre el overlay, descendiente de `product-card` → hit-test de Playwright válido).
5. Focus visible del overlay con `focus-visible:ring-2 focus-visible:ring-inset` (tab stop adicional, redundancia inofensiva con "Agregar"). `select-none` en la card evita selección de texto en taps rápidos y el callout de iOS sobre la imagen; `-webkit-tap-highlight-color: transparent` en el overlay suprime el flash gris del tap móvil.

## Implementación detallada

### `src/components/productos/product-card-base.tsx`

- Ambas variantes: `Card` con `relative select-none` agregados a su `className`; overlay stretched button como **primer hijo** del `Card`:
  ```tsx
  <button
    type="button"
    data-testid={isCatalog ? `add-product-surface-${product.id}` : 'add-sale-product-surface'}
    aria-label={...} // misma lógica que el aria-label/label del "Agregar" visible
    disabled={isDisabled}
    onClick={() => onAdd()}
    className="absolute inset-0 z-10 cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-inset active:bg-black/[0.04] disabled:cursor-not-allowed [-webkit-tap-highlight-color:transparent]"
  />
  ```
- Filas de acciones → `relative z-20` (catalog: el `div` con customize+add, ~línea 187; sales: el `div mt-auto`, ~línea 327).
- Variante `sales`: eliminar el badge `+N opcionales` (291-295) y la variable `optionalItems` (243); condición del `ProductCardSalesExtra` → `product.type !== 'service' && maxAdditional !== undefined && (isOutOfStock || maxAdditional !== product.availability)`.
- Actualizar el docblock de cabecera (70-89): la superficie completa agrega vía botón estirado en ambas variantes; cualquier futuro elemento interactivo dentro de la card requiere `relative z-20` (o superior) para no quedar bajo el overlay.

### Tests

- `src/components/productos/product-card-base.test.tsx`:
  - Nuevos: click en `add-product-surface-${id}`/`add-sale-product-surface` dispara `onAdd` una sola vez y no abre diálogo; overlay deshabilitado con `isOutOfStock`/`disabled`.
  - Nuevos (`sales`): badge de opcionales no se renderiza (`queryByText(/opcionales/)`); "Podés sumar" ausente cuando `maxAdditional === availability`, presente cuando difiere; "Sin stock" con `isOutOfStock` aunque coincidan (`availability: 0`, `maxAdditional: 0`).
  - El test "la tarjeta es presentacional" sigue válido (el `Card` sigue sin `role`/`tabindex`; el overlay es un botón real hijo).
- `sales-terminal.test.tsx` y specs E2E: **sin migración** — todos usan testids de botón. Cobertura opcional del gesto: en `ventas-disponibilidad.spec.ts` cambiar el segundo click de `add-sale-product` (~línea 45) por `card.click()`; en `pedido.spec.ts` cambiar el click de `add-product-${id}` (~línea 36) por click sobre `product-card-${id}` (el producto del caso es `service`, sin botón de personalizar en el centro).

## Fuera de alcance (explícito)

- Sin cambios en `PromoOptionsDialog`, `SalesCart`, `useSellableCart`, endpoints, polling ni tema.
- Sin gestos extra (long-press → personalizar queda como idea futura, no implementar).
- Sin tocar la variante `catalog` fuera del overlay (disponibilidad cualitativa sr-only intacta).

## Consideraciones de seguridad y entorno

- Sin endpoints ni env vars nuevas; `authenticatedFetch` sin cambios.
- E2E solo con `.env.e2e` en base descartable (el `global-setup` trunca tablas); si un `next dev` ajeno ocupa `:3000`, la guardia `x-e2e-server` aborta — cerrar el dev server o dejar E2E para CI.
- Riesgo UX aceptado: toda la superficie es target de mutación (mis-tap) — mitigado por el badge `N en venta`/`N en tu pedido` con `animate-in zoom-in` y la línea removible del carrito; scroll táctil que arranca sobre la card no dispara click.

## Criterios de aceptación

- [ ] Tap/click en hero, nombre o precio de la card agrega 1 unidad con la selección por defecto (sales y catálogo).
- [ ] `customize-*` y `add-*` siguen funcionando sin doble agregado ni disparo del overlay.
- [ ] Agotado/caja cerrada: overlay deshabilitado, `data-out-of-stock`/`opacity-50` intactos.
- [ ] Badge `+N opcionales` no se renderiza; `optionalItems` eliminado (knip/TS sin huérfanos).
- [ ] Carrito vacío: solo "Disponible: N unidad"; con ítems/consumo compartido: "Podés sumar: M más" visible; agotado: "Sin stock".
- [ ] axe WCAG 2.1/2.2 sin violaciones nuevas en `/ventas` y `/pedido` (el overlay es botón real: sin "botón dentro de botón", target-size OK).

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y jsx-a11y (sin `eslint-disable` nuevos) |
| `npx tsc --noEmit` | Tipos |
| `npm test` | Unitarios migrados + nuevos de la card |
| `npm run build` | Build de producción |
| `npm run knip` | `optionalItems`/imports huérfanos |
| `npm run test:e2e` (con `.env.e2e`, base descartable) | `ventas-*`, `pedido`, `responsive`, `accessibility`, `tour` |

## Cierre de la tarea

- Documentar en `.devin/informes/lecciones-aprendidas.md` el patrón "stretched button" en cards POS (por qué no `role="button"`/`onClick`-div: ARIA inválido y jsx-a11y; regla del `z-20` para futuros interactivos internos).
- Actualizar `.devin/prompts/README.md` (lista de activos) y `.devin/README.md` (lista + bloque Estructura) con este prompt — regla de índices del proyecto.
- Si se mergea un PR, `reporte-estado.md` §0 se actualiza según la convención del proyecto.
