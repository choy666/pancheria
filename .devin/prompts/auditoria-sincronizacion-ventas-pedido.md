# Prompt: Auditoría de sincronización `/ventas` ↔ `/pedido` — tema claro, catálogo en vivo y quick-add

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/archivados/rediseno-pedido-pr1-2026-10-02.md` — tema claro scoped, tokens de marca, card pública
- `.devin/informes/archivados/rediseno-pedido-pr2-2026-10-02.md` — modal food-delivery (variantes `public`/`sales`)
- `.devin/informes/archivados/rediseno-pedido-pr3-2026-10-02.md` — aclaraciones por ítem end-to-end
- `.devin/informes/analisis-comportamiento-ventas-pedidos-2026-10-06.md` — comportamiento de las tres superficies
- `.devin/informes/checklist-pre-push.md`

Todo el trabajo y el informe en español.

## Alcance

**Solo lectura.** No modificar código, ni esquema, ni configuración. El entregable
es un informe con recomendaciones priorizadas; la implementación queda para una
sesión posterior con prompt dedicado.

## Estado actual verificado (punto de partida — no re-derivar)

`/pedido` fue rediseñado estilo food-delivery (commits `3a029e4`, `dfb2872`):

- Tema claro con scope `[data-theme='light']` en `src/app/(public)/layout.tsx`;
  tokens `--color-brand-red`/`--color-brand-mustard`/`--color-brand-ink` en
  `@theme`; fuentes Anton (`--font-heading`) y Poppins (`next/font/google`).
- `ProductCardBase` (<ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-base.tsx" />) tiene dos
  variantes: `catalog` (hero aspect-video con `ProductCardImage` + fallback
  monograma, pill PROMO en `compound`, badge `N en tu pedido` sobre el hero,
  quick-add con `selectedByDefault`, botón circular `customize-product-${id}`) y
  `sales` (card-botón sin imagen, badges tipo/opcionales/`N en venta`, stock
  restante).
- `PromoOptionsDialog` (<ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />) acepta
  `variant: 'public' | 'sales'` (default `sales`): la pública trae hero,
  `data-theme="light"` explícito en el portal, toggles `role="switch"` "A tu
  gusto"/"Sumale", stepper, CTA `pill bg-brand-red` con precio y hoja inferior
  en mobile.
- `usePedidoClient` (<ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />): catálogo SSR +
  "Cargar más" (`/api/public/catalogo?limit&offset`), `useVisibilityPolling`
  refresca primera página + disponibilidad de extras + estado de sucursal con
  `getPedidoRefetchIntervalMs()` (`src/config/catalog.ts`), y valida el carrito
  con debounce contra `POST /api/public/disponibilidad` (mensajes públicos sin
  insumos: `publicShortageMessage`).
- `PedidoCatalogSection` (<ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />):
  encabezado con pasos 1-2-3, selector de sucursal,
  `BranchInfoCard`, grupos por tipo con `publicProductTypeGroupClasses`, y barra
  mobile fija `Ver mi pedido · N ítems · $X` (pill `bg-brand-red`).

`/ventas` (<ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />) quedó en el diseño previo:

- Tema oscuro del panel (`<html class="dark">` global). Card `variant="sales"`
  entera como botón; en compuestos con opcionales el click abre el modal (NO hay
  quick-add).
- `fetchAllPages` de `GET /api/productos?includeAvailability=true` al montar y
  tras cada venta confirmada; **sin polling**: la disponibilidad visible del
  catálogo puede quedar desactualizada durante la sesión (el pre-check por
  carrito sí va contra `POST /api/ventas/disponibilidad`, que devuelve
  `supplyName`/cantidades — correcto por ser interno).
- Funciones exclusivas del POS a conservar: `CajaStatus` (abrir/cerrar caja),
  `PaymentPartsInput` (pago mixto), `ProductCardSalesExtra` ("Podés sumar: N
  más" / "Sin stock"), toggle "Mostrar agotados", idempotencia
  `useSubmitIdempotencyKey`/`saleSignature`,
  roles admin/operator, `data-tour` (`caja-status`, `sales-products`,
  `sales-cart`).

## Objetivo

Auditar `/ventas` contra `/pedido` y producir un informe con recomendaciones
priorizadas para sincronizar estética y funciones, con estas decisiones ya
tomadas:

- **Destino visual: tema claro como `/pedido`.** La auditoría debe evaluar cómo
  llevar `[data-theme='light']` al terminal dentro del layout oscuro del panel
  (alcance del scope, portales de diálogos/selects/confirms, componentes
  compartidos, convivencia con el header/nav del panel que sigue oscuro).
- **Funciones priorizadas:** refresco en vivo del catálogo/disponibilidad
  (análogo a `useVisibilityPolling` + `refreshCatalog`) y quick-add en
  compuestos con `selectedByDefault` + botón de personalización separado.

## Preguntas a responder

1. **Estética comparativa.** Mapear cada bloque visual de `/pedido` a su
   equivalente en `/ventas`: card (hero, pill PROMO, badge, CTAs), estructura
   del catálogo (grupos con encabezados vs grid plana), modal de
   personalización (hero, secciones, stepper, CTA), barra mobile, skeletons /
   empty / error states. Para cada brecha: archivo/línea, qué cambiaría y qué
   queda igual.
2. **Portar el tema claro a una página del panel.** Evaluar viabilidad y costo:
   - `<html class="dark">` es global y el panel lo necesita; el scope sería por
     página (`data-theme="light"` en el contenedor de `/ventas`, mismo patrón
     de `(public)/layout.tsx`).
   - Inventario de portales afectados: `PromoOptionsDialog`, `ConfirmDialog`
     (ya acepta `dataTheme`, ver `cart-summary.tsx`), `Select`, tooltips/tour.
   - Componentes compartidos con el panel oscuro: `CartPanel`, `CajaStatus`,
     `PaymentPartsInput`, `Card`, `Badge` — ¿quedan legibles bajo el bloque
     `[data-theme='light']` de `globals.css` o necesitan ajustes/prop?
   - Convivencia: nav/header del panel sigue oscuro alrededor del contenido
     claro — evaluar si resulta aceptable o si conviene una variante visual
     híbrida, y documentar la decisión con capturas.
3. **Refresco en vivo del catálogo.** Comparar el modelo de `/pedido`
   (`useVisibilityPolling` → `refreshCatalog` + `fetchBranchStatus`) con el de
   `/ventas` (fetch único + post-venta). Proponer el endpoint adecuado para el
   POS (`/api/productos` paginado con `includeAvailability` vs
   `/api/ventas/disponibilidad` con `productIds`), intervalo configurable
   (reusar `getPedidoRefetchIntervalMs` o nueva env), y el manejo de caja
   cerrada/turnos.
4. **Quick-add en compuestos.** Hoy todo click en una promo con opcionales abre
   el modal; `/pedido` agrega directo con `selectedByDefault` y el botón
   `customize-product-${id}` abre el modal aparte. Evaluar el cambio de
   interacción en la card `variant="sales"` (o nueva variante), cómo se
   combina con `maxAdditional`/agotados, y el impacto en velocidad de
   mostrador.
5. **Agrupado y paginación.** Evaluar `groupProductsByType`/headers para el
   grid de ventas (clases de grupo para el tema claro) y si conviene reemplazar
   `fetchAllPages` por carga incremental — trade-off del POS: precalcula
   disponibilidad sobre el catálogo completo.
6. **Funciones exclusivas del POS.** Confirmar que se preservan y dónde quedan
   en el nuevo layout: `CajaStatus`, pago mixto, shortage con insumos
   (interno, no aplicar el mensaje público), disponibilidad restante
   ("Podés sumar: N más" / "Sin stock"), toggle agotados,
   idempotencia, `data-tour`, historial en `/ventas/historial`.
7. **Riesgos E2E y tour.** Listar los selectores que cambiarían y los specs
   afectados: `[data-testid="product-card"][data-product-name]` (click en toda
   la card) en `ventas-disponibilidad`, `ventas-historial`, `ventas-pago-mixto`,
   `ventas-stock-compartido`, `paso3`, `flujo-diario`, `responsive`,
   `accessibility`; `toggle-show-out-of-stock`, `confirm-sale-blocker`,
   `cart-mobile-bar`, `cart-item`/`cart-item-note`, y `data-tour`
   (`tour.spec.ts`, que recorre el tour en `/ventas`, y
   `prod-login-and-tour.spec.ts`). Recomendar estrategia de selectores
   (mantener IDs por variante como hizo `ProductCardBase` vs migrar specs).
8. **Matriz comparativa final.** Tabla: aspecto × `/pedido` × `/ventas` ×
   brecha × recomendación × prioridad (alta/media/baja) × esfuerzo estimado ×
   riesgo. Cerrar con una propuesta de fases de implementación (tema/estructura
   → funciones → pulido) sin ejecutarla.

## Entregable

- Informe en `.devin/informes/` con el formato de los existentes (cabecera con
  estado/fecha/HEAD/alcance, secciones numeradas, matriz final y recomendaciones
  priorizadas). Nombre sugerido:
  `auditoria-sincronizacion-ventas-pedido-YYYY-MM-DD.md`.
- Al crearlo, actualizar los índices según `.devin/prompts/README.md`:
  `.devin/informes/README.md` y el bloque Estructura de `.devin/README.md`.
- Opcional y recomendado: capturas lado a lado `/pedido` vs `/ventas` (desktop
  1280px y mobile 390px) sobre la base dev local, guardadas en
  `.devin/informes/shots/` (no trackeado).

## Restricciones y verificaciones

- Auditoría estrictamente de solo lectura: no tocar código, ni escribir en la
  base, ni correr `npm run test:e2e` contra bases con datos reales
  (`global-setup` trunca tablas). Si se quiere evidencia E2E, solo con
  `.env.e2e` en base descartable.
- No hardcodear credenciales ni URLs; usar la config existente.
- Verificar cada afirmación contra `archivo:líneas` del HEAD vigente.
- `npm run lint` / `npx tsc --noEmit` solo si el informe los menciona como
  verificación recomendada para la fase de implementación.
