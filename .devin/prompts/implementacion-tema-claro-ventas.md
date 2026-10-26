# Prompt: Tema claro híbrido en `/ventas` + estructura del catálogo (Fase 1 de §8.2 de la auditoría)

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md` — especialmente §18 (overlays portaleados salen del scope de `[data-theme]`; componentes compartidos se bifurcan por prop)
- `.devin/informes/checklist-pre-push.md`
- `.devin/informes/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` — **fuente de verdad**: §2 (tema claro, inventario de portales y decisión híbrida), §5 (agrupado), §6 (garantías del POS a preservar), §7 (riesgos E2E/tour).

Todo el trabajo, comentarios y documentación en español.

## Alcance

**Implementación acotada.** Solo tema claro del contenido de `/ventas` + estructura del catálogo (headers de grupo y estado vacío). No se toca la interacción de la card (quick-add va en `implementacion-quick-add-ventas.md`), ni la barra móvil, ni el layout/hero del diálogo (fase de pulido), ni `/ventas/historial` (página separada, permanece oscura).

## Estado actual verificado (punto de partida — no re-derivar)

Verificado contra `HEAD` `bbcb1b8` (post-refresco, commit `da0af67`):

- El bloque `[data-theme='light']` ya redefine todas las variables de superficie + tipografías de marca (`--font-sans` → Poppins, `--font-heading` → Anton) en `src/app/globals.css:101-138`; el fix de anillos para `card`/`dialog-content`/`select-content` está en `globals.css:145-149`. `<html class="dark">` es global y el panel lo necesita.
- `(public)/layout.tsx:11-14` es el precedente: wrapper `data-theme="light"` con `bg-background text-foreground`.
- El panel renderiza `PanelHeader` oscuro + `<main class="flex-1 p-4 md:p-6 lg:p-8">` (`src/app/(panel)/layout.tsx:45-57`); `/ventas` es `src/app/(panel)/ventas/page.tsx` (server component) → `SalesTerminal`.
- `SalesTerminal` (`src/components/ventas/sales-terminal.tsx`): wrapper raíz `space-y-5` (línea 451), `CajaStatus` en `data-tour="caja-status"` (452-466), `h2` "Catálogo" + toggle `toggle-show-out-of-stock` (470-482), grid plano `data-tour="sales-products"` (484-508), `SalesCart` en `CartPanel` sticky (511-532), dos `PromoOptionsDialog` (agregar 535-565, editar línea 567-584).
- Orden actual del catálogo: `sortSellableProducts` (`src/lib/ventas-helpers.ts:22-31`) = compound → critical_supply/beverage → service, alfabético. `groupProductsByType` (`src/lib/product-grouping.ts:8-56`) con `typePriority` produce el mismo orden de grupos para el conjunto vendible.
- Headers de grupo públicos de referencia: `pedido-catalog-section.tsx:183-204` (`h2` inline-flex + `publicProductTypeGroupClasses`/`publicProductTypeLabels`); estado vacío `catalog-empty-state` en líneas 174-182.
- Clases hardcodeadas dentro del scope: `sales-cart.tsx:282,288` (`border-white/10`), `cash-register-shift-badge.tsx:41,55` (`text-green-400`/`text-amber-400` sobre `*-500/20`, compartido con `/cierre` vía `caja-panel.tsx`), `payment-parts-input.tsx:76` (`text-amber-500`, ya light-safe), `sales-cart.tsx:129,207` (`text-amber-700`, ya light-safe), `cash-register-alert.tsx:81-82` (`*-700`, ya light-safe).
- Portales dentro de `/ventas`: `PromoOptionsDialog` (tema atado a `variant === 'public'`, `promo-options-dialog.tsx:256`), `ConfirmDialog` "Vaciar venta" (`sales-cart.tsx:342-352`, ya acepta `dataTheme`), diálogos abrir/cerrar caja (`cash-register-controls.tsx:88,240`, compartidos con `/cierre`). La barra `cart-mobile-bar` es `fixed` pero NO portalea — hereda el tema del árbol.
- `CajaStatus` (`caja-status.tsx`) también se usa en `/cierre` vía `caja-panel.tsx` — todo prop de tema debe ser opcional y default oscuro.
- El popover del tour (`.pancheria-tour-popover`, `globals.css:229-239`) resuelve `var(--card)` en `body` → permanece oscuro siempre.
- Tests unitarios del terminal: `src/components/ventas/sales-terminal.test.tsx` (jsdom, `CajaStatus` mockeado, fetch por URL, polling deshabilitado por defecto vía `mockedGetVentasCatalogRefreshIntervalMs.mockReturnValue(0)`).

## Decisiones ya tomadas (no re-debatir)

1. **Variante híbrida: chrome oscuro + contenido claro** (auditoría §2.3). `PanelHeader` y menú mobile siguen oscuros; solo el contenido de `/ventas` (incluido `CajaStatus`) va dentro del scope `data-theme="light"`. No aclarar otras páginas del panel.
2. **El scope se pinta a sí mismo**: el contenedor claro lleva `bg-background text-foreground` propio — el fondo oscuro del `body`/`main` no debe asomar dentro.
3. **`variant` y tema se desacoplan en `PromoOptionsDialog`**: `variant` controla layout (hero/bottom-sheet vs. centrado); el tema se pasa aparte. El POS conserva `variant="sales"` (sin hero) pero con `dataTheme="light"`.
4. **Los diálogos de caja se aclaran en `/ventas`**: se propaga un prop opcional de tema desde `CajaStatus`; `/cierre` no lo pasa y sigue oscuro.
5. **El popover del tour queda oscuro** — es overlay del driver, no del layout (documentado en la auditoría).
6. **Headers de grupo con lenguaje de mostrador**: nuevo mapa `salesProductTypeLabels` — "Combos y promos", "Bebidas", "Servicios y extras" — y clases claras (reusar `publicProductTypeGroupClasses`, ya validadas sobre claro).
7. **Cero cambios de selectores**: todos los `data-testid`/`data-tour` existentes intactos; `data-tour="sales-products"` envuelve ahora el contenedor de grupos.

## Objetivo

Que `/ventas` renderice su contenido en el tema claro de `/pedido` (mismo lenguaje visual: cards blancas, CTA rojo, acentos mostaza) conviviendo con el chrome oscuro del panel, y que el catálogo gane headers de grupo + estado vacío — sin cambios funcionales ni de selectores.

## Reglas de negocio

1. Todo componente compartido que reciba tema lo hace por prop opcional con default = comportamiento actual (oscuro). Ninguna otra página del panel cambia.
2. Ningún texto puede quedar ilegible sobre fondo claro: auditar cada clase `*-400`/`*-300`/`border-white/*`/`bg-white/*` dentro del scope y migrar a tokens o paletas `*-700` light-safe.
3. `aria-*`, `role`, `data-testid`, `data-tour` intactos; la única excepción permitida es agregar un `data-testid` nuevo para el estado vacío del catálogo.
4. El precheck de disponibilidad, el polling de catálogo (`useVisibilityPolling`) y el polling de caja no se tocan.
5. Los `Badge` de la card (`secondary`/`outline`/`default`) ya son tokens — no mapear a `productTypeBadgeClasses` (esas paletas `*-400` son para el panel oscuro, `product-style.ts:42-68`).

## Implementación detallada

### Scope de tema

- `src/app/(panel)/ventas/page.tsx`: envolver todo el contenido (h1 + `SalesTerminal`) en `<div data-theme="light" className="min-h-full space-y-5 rounded-2xl bg-background p-4 text-foreground md:p-6">`. El `h1` "Ventas" queda dentro del sheet claro. Ajustar padding/redondeo a criterio visual con capturas; el sheet debe cubrir el alto disponible del `main`.
- El skeleton de carga (`sales-terminal.tsx:435-446`) queda dentro del scope automáticamente — verificar que se lee bien sobre claro (tokens, no debería requerir cambio).

### Migraciones de color dentro del scope

- `sales-cart.tsx:282,288`: `border-white/10` → `border-border`.
- `cash-register-shift-badge.tsx`: los dos badges con `text-green-400`/`text-amber-400` necesitan variante clara. Como el componente se comparte con `/cierre` (oscuro), agregar prop opcional `dataTheme?: 'light'` y bifurcar las clases (`text-green-700`/`bg-green-500/15` y `text-amber-700`/`border-amber-500/30` en claro). `CajaStatus` lo propaga.
- `payment-parts-input.tsx:76` (`text-amber-500`): verificar contraste sobre claro; si falta, migrar a `text-amber-700` solo cuando el scope es claro (prop o clase dual — preferir lo mínimo; `dark:` NO funciona acá porque `.dark` sigue en `<html>`, es una trampa: los `dark:*` se siguen aplicando dentro del scope claro).
- Revisar el resto del render dentro del scope a mano (card, cart, caja) con capturas desktop/mobile.

### Portales

- `PromoOptionsDialog`: agregar `dataTheme?: 'light'` aplicado a `DialogContent` independiente de `variant` (reemplazar la condición `isPublic` de la línea 256 por `dataTheme ?? (isPublic ? 'light' : undefined)` para mantener compatibilidad). En `sales-terminal.tsx` pasar `dataTheme="light"` a los dos diálogos (agregar y editar línea). Actualizar `promo-options-dialog.test.tsx` si el test del `data-theme` cubre el default público.
- `ConfirmDialog` "Vaciar venta" (`sales-cart.tsx:342`): pasar `dataTheme="light"`.
- `CajaStatus` + `CashRegisterOpenControls`/`CashRegisterCloseControls` (`cash-register-controls.tsx:88,240`): prop opcional `dataTheme` propagado a `DialogContent`. `SalesTerminal` pasa `dataTheme="light"` a `CajaStatus`; `caja-panel.tsx` (`/cierre`) no lo pasa.

### Estructura del catálogo

- En `sales-terminal.tsx`: agrupar `displayProducts` con `groupProductsByType(displayProducts, typePriority, criticalSupplyTypePriority)` y renderizar headers de grupo siguiendo `pedido-catalog-section.tsx:183-204` como referencia visual (`h2`/`h3` inline-flex con `salesProductTypeLabels[type]` + `publicProductTypeGroupClasses[type]`).
- Nuevo `salesProductTypeLabels` en `src/lib/product-style.ts` junto a los mapas existentes (con comentario de uso: lenguaje de mostrador para el POS).
- `data-tour="sales-products"` pasa a envolver el contenedor de grupos (no una sola grilla): la grid `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` se repite por grupo dentro.
- Estado vacío: cuando `displayProducts.length === 0` tras la carga, mensaje equivalente a `catalog-empty-state` pero con lenguaje de terminal y testid propio (`sales-catalog-empty`), p. ej. "No hay productos vendibles con stock. Activá 'Mostrar agotados' para ver todo el catálogo." — diferenciar el caso "todo agotado oculto por el toggle" del "catálogo vacío" si es trivial; si no, un solo mensaje neutro.
- Test unitario del nuevo mapa si `product-style.test.ts` ya cubre los otros mapas (líneas 10-35) — seguir el patrón.

## Fuera de alcance (explícito)

- No quick-add ni reestructura de la card (prompt `implementacion-quick-add-ventas.md`).
- No hero/imagen ni pill PROMO en la card sales (fase de pulido).
- No cambiar `cart-mobile-bar` a pill (fase de pulido).
- No hero/bottom-sheet en `PromoOptionsDialog` para el POS (se evalúa en pulido).
- No tocar `/ventas/historial`, `/cierre`, `/productos`, `/pedidos` ni el `PanelHeader`.
- No cambiar el precio a `font-heading` (Anton) — la decisión mono-vs-Anton queda para la fase de pulido.
- No tocar el popover del tour.
- No cambios de servidor/endpoints/esquema.

## Consideraciones de seguridad y entorno

- No hardcodear URLs ni parámetros; el tema se resuelve en CSS/props, sin env vars nuevas.
- Verificación visual obligatoria con la base dev local (`npm run dev` contra `.env.local`, solo lectura: no abrir caja ni confirmar ventas si la base tiene datos reales — o hacerlo en base descartable).
- E2E solo con `.env.e2e` en base descartable (el `global-setup` trunca tablas).

## Criterios de aceptación

- [ ] `/ventas` renderiza contenido claro con `PanelHeader`/menú oscuros alrededor; el sheet claro cubre el área de contenido (desktop 1280 y mobile 390).
- [ ] Los tres portales (`PromoOptionsDialog` agregar/editar, `ConfirmDialog` vaciar, diálogos de abrir/cerrar caja) se ven claros en `/ventas` y oscuros en `/cierre`.
- [ ] El catálogo muestra headers "Combos y promos" / "Bebidas" / "Servicios y extras" con las clases claras y el orden de productos no cambia.
- [ ] `toggle-show-out-of-stock` filtra igual dentro de cada grupo; el estado vacío aparece cuando corresponde.
- [ ] Ningún texto `*-400` ilegible dentro del scope; el badge de turno se lee en ambos temas.
- [ ] `data-tour` intactos: `caja-status`, `sales-products`, `sales-cart`, `payment-parts-input`.
- [ ] axe-core sin violaciones nuevas en `/ventas` (`npm run test:accessibility`).
- [ ] Capturas lado a lado en `.devin/informes/shots/` (1280 + 390) como evidencia de la variante híbrida.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Tipos |
| `npm test` | Tests unitarios (incluye `product-style` y `promo-options-dialog` si cambian) |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto (nuevo mapa/props deben estar usados) |
| `npm run test:accessibility` | Contraste/ARIA en el nuevo tema (con `.env.e2e`) |
| `npm run test:e2e` (con `.env.e2e`, base descartable) | Regresión de `ventas-*`, `tour`, `responsive`, `caja-*` |

## Cierre de la tarea

- Actualizar `.devin/informes/auditoria-sincronizacion-ventas-pedido-2026-10-25.md` §8.2: marcar la Fase 1 (tema y estructura) como implementada con nota breve de estado.
- Si se mergea un PR, `reporte-estado.md` §0 se actualiza según la convención del proyecto.
- No archivar el informe ni los prompts hasta completar todas las fases.
