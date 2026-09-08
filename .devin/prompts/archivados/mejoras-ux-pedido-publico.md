# Prompt: mejoras de UX y lenguaje en el flujo público de pedidos

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/guia-funcionamiento-pancheria.md`

## Estado actual relevante

El flujo público del cliente (`/pedido`, `/pedido/seguimiento`, `/pedido/[id]/chat`) funciona y tiene buena cobertura E2E, pero expone jerga interna de gestión de stock al cliente y carece de acompañamiento visual:

- El catálogo público agrupa productos por `ProductType` interno y muestra los encabezados `productTypeLabels` ("Insumo crítico", "Servicio / extra") definidos en `src/lib/product-style.ts`. Como el catálogo público solo incluye `compound`, `service` y `critical_supply` con `criticalSupplyType = 'beverage'` (ver `publicSellableConditions` en `src/repositories/catalogRepository.ts`), el cliente ve literalmente un grupo "Insumo crítico" que contiene las bebidas.
- Cada tarjeta de producto muestra un badge con el tipo interno: "Insumo crítico — Bebida" (`typeLabel` en `src/components/productos/product-card-base.tsx`).
- Los mensajes de falta de stock exponen nombres de insumos y cantidades internas: "Faltan insumos para X: {supplyName} (disponible N, requerido M)".
- El estado abierto/cerrado de la sucursal solo se consulta al abrir el modal de checkout; el cliente puede armar todo el pedido sin saber que la sucursal está cerrada.
- En mobile el carrito queda al final de la página, debajo de todo el catálogo, sin acceso rápido.
- El diálogo de pedido creado mezcla la celebración con un textarea de "Motivo de cancelación" y un botón destructivo "Cancelar pedido" en primer plano, y muestra "Horario de retiro estimado" aunque el pedido sea `delivery`.

## Objetivo

Que la navegación del cliente en `/pedido` sea totalmente intuitiva: lenguaje de cliente (sin jerga interna), acompañamiento visual en cada paso y estado de la sucursal visible antes de armar el pedido.

## Reglas de negocio

1. El cliente nunca debe ver los términos internos: "insumo", "insumo crítico", "insumo manual", "stock", "operador", "receta", "supply", "disponible/requerido" con cantidades, ni tipos internos de producto.
2. Las etiquetas públicas de grupos deben ser: `compound` → "Combos y promos", `critical_supply` (solo bebidas llegan al catálogo público) → "Bebidas", `service` → "Extras", `manual_supply` → no aplica al público (no se listan, pero el mapa debe tener un fallback seguro).
3. Las etiquetas internas (`productTypeLabels`, `productTypeBadgeClasses`, etc.) se siguen usando en el panel; crear un mapa separado para el público (p. ej. `publicProductTypeLabels` en `src/lib/product-style.ts` o un archivo nuevo `src/lib/public-product-labels.ts`) y NO modificar las etiquetas del panel.
4. Los mensajes de falta de stock deben ser accionables y sin datos internos: "No hay suficiente {producto} por el momento. Probá bajar la cantidad o elegí otra opción." Mantener los `data-testid` existentes.
5. "Horario de retiro estimado" solo aplica a `pickup`; para `delivery` mostrar texto de envío a domicilio. `createdOrder.deliveryType` ya existe en `CreatedOrder`.
6. No exponer cantidades de stock exactas al cliente: reemplazar "Disponible: N unidades" por estados cualitativos ("Disponible", "Últimas unidades" cuando availability <= 3, "Agotado"). El valor numérico se sigue usando internamente para `isOutOfStock`.
7. Mantener todos los `data-testid` y la estructura de selects/inputs que usan los tests E2E (`product-card-${id}`, `add-product-${id}`, `cart-item`, `checkout-button`, `checkout-dialog-title`, `confirm-order-button`, `branch-select-*`, `catalog-load-more`, `recent-orders-banner`, `checkout-summary`, `checkout-item`, `order-success-*`, `order-summary`, `cart-item-shortage`, `checkout-blocker`, `checkout-error`, `single-branch-indicator`, `product-availability`).
8. Sin valores hardcodeados de configuración: textos nuevos van como constantes del componente o configuración existente; no introducir variables de entorno salvo necesidad real.
9. No cambiar la lógica de negocio (validaciones, disponibilidad, rate limit, tokens de cancelación): este prompt es de presentación y textos, salvo los agregados de UI explícitos.

## Implementación detallada

### Etiquetas y textos (prioridad alta)

- <ref_file file="C:/developer/paginas/pancheria/src/lib/product-style.ts" />
  - Agregar `publicProductTypeLabels: Record<ProductType, string>` con las etiquetas de la regla 2 y reutilizar los `productTypeGroupClasses` existentes.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />
  - Usar `publicProductTypeLabels` para los encabezados de grupo.
  - Agregar estado vacío del catálogo: si `groupedProducts.length === 0`, mostrar mensaje amigable ("No hay productos disponibles en esta sucursal por ahora. Probá más tarde o elegí otra sucursal.").
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-base.tsx" />
  - En `variant="catalog"`, el badge debe usar la etiqueta pública (bebida → "Bebida", promo → "Promo", servicio → "Extra") u omitir el badge si la etiqueta del grupo ya lo comunica. Mantener la variante `sales` sin cambios.
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-availability.tsx" />
  - Soportar un modo "público" (prop `publicLabel` o variante) que muestre estados cualitativos según la regla 6. En catálogo pasar `unit=undefined` ya ocurre; ajustar para no mostrar "unidades" crudo.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
  - Reemplazar el bloque de `shortageByProduct` por un mensaje por producto sin datos internos (regla 4).
  - Reescribir la descripción del checkout: "El local confirma tu pedido antes de prepararlo." en lugar de "El stock se confirma cuando el operador acepta el pedido."
  - Mostrar el estado de la sucursal en el encabezado del catálogo (no solo en el modal): mover el fetch de `PUBLIC_SUCURSAL_ESTADO_API` a la carga inicial o a un efecto al montar, y reutilizar `BranchInfoCard` (o una versión compacta) en el header junto al selector de sucursal. Mantener la verificación en checkout como segunda pasada.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />
  - Mensaje de shortage por línea: "{producto}: no alcanza la disponibilidad. Bajá la cantidad o quitalo." sin `supplyName`/cantidades.
  - Empty state: "Todavía no agregaste productos. Elegí del catálogo para empezar." con un ícono o flecha visual hacia el catálogo.
  - Mientras `isCheckingAvailability`, mostrar un indicador "Verificando disponibilidad..." junto al botón (actualmente los controles se deshabilitan sin explicación).
- <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />
  - Renombrar secciones: "Siempre incluye" → "Incluye", "Insumos opcionales" → "Podés sacar", "Servicios / extras" → "Extras". Mantener la misma lógica.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" />
  - Mostrar "Horario de retiro estimado" solo cuando `createdOrder.deliveryType === 'pickup'`; para `delivery` mostrar "Enviaremos tu pedido a: {address}" usando `createdOrder.address`.
  - Destacar el número de pedido con botón "Copiar número" y texto "Guardalo para seguir tu pedido desde 'Seguimiento'".
  - Mover la cancelación a un bloque colapsable ("¿Necesitás cancelar el pedido?") para que no compita con la acción principal "Ir al chat del pedido".
  - Evitar mostrar "No hay horarios de apertura configurados." crudo: si no hay horarios, ocultar la línea o mostrar "Consultá el horario por el chat".
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/order-tracker.tsx" />
  - Label "Nombre del cliente" → "Tu nombre"; aclarar con texto de ayuda que alcanza con nombre O teléfono (según lo que valide el API) o marcar el requerido.
  - Reemplazar el placeholder del número por algo neutro ("Ej: PED-...") o un texto de ayuda "Lo recibiste al confirmar el pedido".
  - Agregar una línea de progreso visual de estados: Pendiente → En proceso → Pagado → Finalizado (y estado Cancelado aparte), marcando el actual. Reutilizar `statusLabel`.

### Acompañamiento visual (prioridad media)

- Indicador de pasos en `/pedido`: stepper simple "1. Elegí tus productos → 2. Revisá el pedido → 3. Completá tus datos" en el header o como texto de ayuda; dentro del modal de checkout reforzar el paso actual.
- Carrito accesible en mobile: botón fijo inferior ("Ver mi pedido · N ítems · $total") visible solo cuando hay ítems y en viewport < lg, que haga scroll al carrito o abra un sheet/modal con `CartSummary`. Reutilizar el componente; no duplicar lógica de carrito.
- Feedback al agregar: micro-animación en el badge "N en tu pedido" o un toast breve "Agregado al pedido" (si el proyecto ya tiene sistema de toast, usarlo; si no, animación CSS sin nueva dependencia).
- Revisar que errores del backend (`throwApiError` → `data.error`) no muestren jerga interna al cliente; si el API devuelve mensajes técnicos, mapear a textos amigables en el cliente.

### Tests

- Actualizar tests unitarios que assertan textos modificados: `src/components/pedido/pedido-client.test.tsx`, `src/components/pedido/product-card.test.tsx`, `src/components/pedido/order-tracker.test.tsx`, `src/components/pedido/recent-orders-banner.test.tsx`, `src/components/promo/promo-options-dialog.test.tsx`.
- Tests E2E que dependan de los textos ("Insumo crítico", "Agotado", etc.) en `tests/e2e/` — buscar referencias con grep antes de cambiar textos.
- Agregar cobertura: mensaje de shortage sin `supplyName`, texto de delivery vs pickup en el success dialog, empty state del catálogo, stepper/barra mobile si se implementa.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales ni URLs de API.
- No exponer datos internos de stock (nombres de insumos, cantidades) en la UI pública; el API puede seguir devolviéndolos si el panel los usa, pero el cliente no los renderiza.
- Ejecutar tests E2E solo en base de datos de prueba (`.env.e2e`).
- `.env.local` no debe commitearse.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests E2E en base de prueba |
| `npm run build` | Build de producción |

Verificación manual: recorrer `/pedido` en viewport mobile y desktop, agregar productos, forzar shortage (cantidad mayor al stock), completar checkout con `pickup` y `delivery`, revisar `/pedido/seguimiento` y el chat.
