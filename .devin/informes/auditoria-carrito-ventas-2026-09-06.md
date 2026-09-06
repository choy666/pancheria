# Auditoría del carrito de ventas (`/ventas`) — 2026-09-06

> **Estado: implementado.** Todas las mejoras de la propuesta fueron
> aprobadas e implementadas el mismo día. Ver la sección
> [5. Implementado](#5-implementado) al final para el detalle de cambios.

Auditoría de usabilidad y funcionamiento del terminal de ventas para
operadores/administradores. Archivos auditados:

- `src/app/(panel)/ventas/page.tsx`
- `src/components/ventas/sales-terminal.tsx`
- `src/components/ventas/sales-cart.tsx`
- `src/components/ventas/sales-product-card.tsx`
- `src/components/productos/product-card-base.tsx` (variante `sales`)
- `src/components/productos/product-card-sales-extra.tsx`
- `src/components/pagos/payment-parts-input.tsx`
- `src/lib/payment-helpers.ts`, `src/lib/money.ts`, `src/lib/ventas-helpers.ts`
- `src/config/payments.ts`
- `src/hooks/usePaymentParts.ts` (el `useCart` mencionado en el pedido pertenece
  al flujo público `/pedido`; el terminal usa `useState` local para el carrito)
- Tests: `src/components/ventas/sales-terminal.test.tsx`,
  `src/components/pagos/payment-parts-input.test.tsx`,
  `src/lib/payment-helpers.test.ts`, `tests/e2e/ventas-*.spec.ts`,
  `tests/e2e/flujo-diario.spec.ts`, `tests/e2e/tour.spec.ts`.

> Nota: `PaymentPartsInput` también se usa en
> `src/components/pedidos/pedido-actions.tsx:85` (cobro de pedidos del panel).
> Cualquier cambio en ese componente impacta ambas pantallas.

## 1. Hallazgos priorizados

### Bloqueante

- **B1 — Bug: "Vuelto" fantasma entre ventas consecutivas.**
  `cashDelivered` es estado interno de `PaymentPartsInput`
  (`payment-parts-input.tsx:45`) y solo se resetea por interacciones internas
  (`updatePayment`, `setFull`, `addToMethod`, `completeWithOther`,
  `clearPayments`). Cuando `confirmSale` termina, el padre hace
  `setCustomPayments(null)` (`sales-terminal.tsx:373`), pero `cashDelivered`
  queda con el valor de la venta anterior. En el carrito vacío siguiente se
  cumple `cashDelivered > (byMethod.get('cash') ?? 0)` y se renderiza
  `Vuelto: $ X` con un monto viejo (`payment-parts-input.tsx:392-400`).
  Riesgo real de entregar cambio incorrecto. El mismo problema aparece si el
  total cambia por `redistributeOnTotalChange`
  (`usePaymentParts.ts:95-106`): el entregado queda desfasado respecto del
  nuevo monto cobrado en efectivo.

### Alto

- **A1 — Parseo de montos ambiguo e impredecible.**
  `parsePaymentAmount` (`payment-helpers.ts:5-44`) decide por heurística si
  `.`/`,` son miles o decimales según la cantidad de dígitos que les sigue:
  `"1.5"` → 1,5 → redondea a **2**; `"12.5"` → **13**; `"1.500"` → **1500**;
  `"1,500"` → **1500** (coma como miles, contrario al locale es-AR usado por
  `formatNumber`). El mismo patrón de tipeo produce resultados distintos y el
  operador puede cobrar un monto equivocado sin notarlo. Los tests actuales
  (`payment-helpers.test.ts:12-34`) documentan esta heurística, por lo que
  cambiarla implica actualizarlos.

- **A2 — Los inputs de pago muestran el monto crudo, sin separador de miles.**
  `value={amount > 0 ? String(amount) : ''}` (`payment-parts-input.tsx:296`)
  renderiza `12500` mientras el total, las denominaciones y los badges usan
  `formatMoney`/`formatNumber` es-AR (`$ 12.500`). Inconsistencia visual
  directa en la pantalla de cobro.

- **A3 — Editar un método de pago modifica el otro sin aviso.**
  `updatePayment` (`payment-parts-input.tsx:71-115`): si el otro método cubre
  el total, al escribir en el nuevo método el otro se re-divide
  automáticamente (líneas 97-106); si ambos tienen valores, el editado se
  clampa al resto (líneas 110-114). Los números cambian solos y el operador
  no entiende por qué.

- **A4 — No hay "quitar ítem" ni "vaciar carrito".**
  Solo existe el stepper `−`/`+` (`sales-cart.tsx:92-118`). Eliminar una
  línea exige bajar la cantidad hasta 0 (`removeFromCart` solo se alcanza vía
  `updateQuantity(lineId, 0)` en `sales-terminal.tsx:224-228`). No hay forma
  de vaciar el carrito completo salvo ítem por ítem.

- **A5 — Caja cerrada: todo deshabilitado sin explicación dentro del
  carrito.** `cartDisabled` apaga el stepper, los pagos y el botón
  (`sales-cart.tsx:100,115,129,151,158-165`), y `addToCart` retorna en
  silencio al tocar un producto (`sales-terminal.tsx:176`). El único aviso
  está en `CajaStatus`, arriba del catálogo; dentro del carrito no se dice
  nada.

- **A6 — Los faltantes de insumos se muestran lejos del ítem que los causa.**
  El banner ámbar está en la columna del catálogo
  (`sales-terminal.tsx:429-444`) mientras las líneas del carrito están en la
  columna derecha; no hay indicación por línea de qué producto falla.

- **A7 — Errores de confirmación lejos del botón y no se limpian al
  corregir.** El banner `error` se renderiza arriba del catálogo
  (`sales-terminal.tsx:423-427`) y `setError(null)` solo ocurre dentro de
  `confirmSale` (`sales-terminal.tsx:351`). Si el operador corrige el pago
  después de un "El pago no cubre el total", el cartel queda visible hasta
  volver a confirmar.

### Medio

- **M1 — Terminología "pedido" en la pantalla de ventas.** Título `Pedido`
  (`sales-cart.tsx:46`), badge `N en pedido`
  (`product-card-base.tsx:173`), `En este pedido: N más`
  (`product-card-sales-extra.tsx:18`), `aria-label` `Agregar X al pedido`
  (`product-card-base.tsx:147`), confirm `Agregar al pedido` del
  `PromoOptionsDialog` abierto desde el terminal, y pasos del tour `Pedido
  actual` (`tour-context.tsx:300`). Confunde con el flujo de pedidos online.

- **M2 — Botón "Confirmar venta" con tres labels y `disabled` sin motivo.**
  (`sales-cart.tsx:154-173`). Se deshabilita por seis causas distintas
  (carrito vacío, submit, caja cerrada, shortage, chequeo en curso, pago
  incompleto) sin texto de ayuda; el operador no sabe qué falta.

- **M3 — "Efectivo recibido" invisible y dos grupos de botones con semántica
  distinta.** Los botones `Denominaciones` (`+N`) fijan el **monto cobrado**
  por método (`addToMethod`, `payment-parts-input.tsx:305-323`), mientras los
  botones `Billetes` acumulan el **efectivo entregado** (`payWithBill`,
  líneas 353-373). Se ven casi iguales pero significan cosas distintas; el
  monto entregado nunca se muestra (solo el badge `Vuelto`) y se mezcla con
  el monto cobrado (`payWithBill` parte de `cashDelivered ?? monto cobrado`,
  línea 205).

- **M4 — Sin subtotal por línea.** Cada línea muestra `precio x cantidad`
  (`sales-cart.tsx:77-79`) pero no el importe de la línea.

- **M5 — El cobro vive dentro de la misma tarjeta del carrito.**
  `PaymentPartsInput` ocupa gran parte de la `Card` sticky
  (`sales-cart.tsx:44,147-152`); en viewports de poca altura el botón de
  confirmar puede quedar por debajo del pliegue.

- **M6 — En mobile el carrito queda debajo de todo el catálogo.**
  `lg:grid-cols-3` (`sales-terminal.tsx:421`) apila el carrito al final; el
  `sticky` solo aplica en `lg` (`sales-cart.tsx:44`). No hay resumen visible
  del total mientras se scrollea el catálogo.

- **M7 — "Editar" solo aparece en compound con opcionales y es ambiguo.**
  (`sales-cart.tsx:119-133`). No sugiere que edita la personalización; no hay
  equivalente visual para líneas simples.

- **M8 — Chequeo de disponibilidad con estados intermedios confusos.**
  `setIsCheckingAvailability(true)` se dispara al instante en `addToCart`,
  `removeFromCart`, `updateQuantity` y `confirmEditLine`
  (`sales-terminal.tsx:198,220,230,269`), pero el request sale recién a los
  300 ms de debounce (`sales-terminal.tsx:122-165`): el botón dice
  "Calculando disponibilidad..." aunque todavía no se consultó nada. El
  `catch` traga errores (líneas 155-156) y re-habilita el botón con datos
  potencialmente viejos. Además se hace un request extra cuando el carrito
  queda vacío.

- **M9 — Atajos de teclado ocultos y filtrado de input inconsistente.**
  `Enter` completa con el otro método y `Escape` vuelve a "todo efectivo"
  (`payment-parts-input.tsx:162-198`) sin estar documentados en la UI.
  `inputMode="numeric"` no refleja que el `pattern` admite `.,`; pegar texto
  inválido se descarta en silencio (`updatePayment` retorna sin feedback
  cuando `parsePaymentAmount` devuelve `null`, línea 75).

### Bajo

- **L1 — `updateQuantity` permite sobre-asignar por línea con líneas
  duplicadas del mismo producto.** `max = item.quantity + additional` usa la
  disponibilidad a nivel producto (`sales-terminal.tsx:234-241`), así que dos
  líneas del mismo producto pueden superar transitoriamente el tope real; el
  backend es el backstop.
- **L2 — Sin `aria-live`** para total, estado de pago, vuelto ni errores.
- **L3 — `isCheckingAvailability` arranca en true al cargar productos**
  (`sales-terminal.tsx:100`): el botón muestra "Calculando..." con el carrito
  vacío.
- **L4 — Riesgo compartido:** `PaymentPartsInput` también alimenta el cobro
  de pedidos (`pedido-actions.tsx:85`); los cambios deben verificarse en
  ambas pantallas (y es una oportunidad: las mejoras aplican a los dos).
- **L5 — `useCart` no interviene en el terminal:** el carrito de ventas es
  `useState` local en `SalesTerminal`; `useCart` pertenece a `/pedido`
  público. No hay duplicación que consolidar en esta iteración.

## 2. Propuesta de rediseño del carrito

Objetivo: flujo "básico, funcional y eficaz" — ver qué se vende, cuánto se
cobra y por qué no se puede confirmar, todo dentro de la tarjeta.

### Estructura propuesta de `SalesCart`

```
Card "Venta actual" (data-tour="sales-cart", lg:sticky)
├─ Header: título + badge "N ítems" + botón ghost "Vaciar" (ConfirmDialog)
├─ Aviso inline si la caja está cerrada:
│   "La caja está cerrada. Abrila desde el panel de arriba para vender."
├─ Lista de líneas (ul)
│   └─ por línea:
│      nombre + detalle de receta (CartItemRecipeDetails)
│      "$ 1.500 c/u" + subtotal "$ 3.000" (multiplyMoney)
│      [−] cantidad [+] [Personalizar] [Quitar (X)]
│      aviso inline si hay shortage: "Falta Pan (disp. 0 / req. 2)"
├─ Total siempre visible (borde superior)
├─ Sección "Cobro" separada visualmente (título propio o sub-card;
│   conserva data-tour="payment-parts-input")
│   ├─ [Todo efectivo] [Todo transferencia]
│   ├─ Efectivo [$ 12.500]   Transferencia [$     ]
│   │   (inputs con formato es-AR en vivo)
│   ├─ denominaciones por método + billetes → "Recibido"
│   ├─ "Recibido en efectivo: $ 20.000 → Vuelto: $ 7.500" (línea propia)
│   ├─ badges: Mixto / Faltan-Sobran-Pago completo
│   └─ hint de atajos: "Enter: completa el resto · Esc: limpia el pago"
├─ Errores de confirmación inline (arriba del botón)
├─ [Confirmar venta]  (label fijo; "Procesando…" con spinner al enviar)
└─ Texto de ayuda con la razón de bloqueo (aria-live):
   caja cerrada → carrito vacío → faltan insumos → verificando → pago
   incompleto (muestra el monto exacto)
```

### Reglas de interacción propuestas

- **Quitar ítem**: botón ícono (`Trash2`/`X`) con `aria-label="Quitar X"` y
  `data-testid="cart-item-remove"` por línea; el stepper `−` sigue bajando
  hasta 0 (remueve) como hoy.
- **Vaciar carrito**: `ConfirmDialog` existente (`ui/confirm-dialog.tsx`);
  limpia ítems y pagos.
- **Inputs de monto**: display formateado con `formatNumber` (es-AR) y una
  regla de parseo única y documentada (ver decisiones abiertas). Estado de
  texto local mientras se edita para no pelear con el formato.
- **Reparto explícito**: editar un método solo modifica ese método (clamp al
  total menos el otro). El complemento se hace con "Completar resto",
  "Completar con {otro}" o `Enter`. Sin cambios automáticos en el otro campo.
- **"Recibido" separado del cobro**: campo visible `cashReceived` cuando hay
  pago en efectivo; los billetes lo alimentan; el vuelto se calcula
  `recibido − efectivo cobrado` y se muestra siempre que haya recibido.
  Fix de B1: resetearlo cuando el padre limpia los pagos o cambia el total.
- **Disponibilidad por línea**: pasar `cartShortage` a `SalesCart` y mostrar
  el faltante bajo la línea afectada; se puede eliminar el banner global o
  dejarlo colapsado a un resumen.
- **Errores**: banner de error dentro del carrito y `setError(null)` cuando
  el operador corrige la condición (pago completo, carrito cambiado).
- **Botón confirmar**: label estable; motivo de bloqueo en texto pequeño con
  `data-testid="confirm-sale-blocker"` (permite actualizar
  `ventas-disponibilidad.spec.ts` que hoy busca el texto
  "Calculando disponibilidad..." en el botón).
- **Terminología**: "Pedido" → "Venta actual"; `N en pedido` → `N en venta`;
  `En este pedido: N más` → `Podés sumar: N más`; `Agregar al pedido` →
  `Agregar a la venta` (vía `confirmLabel` del `PromoOptionsDialog`, que se
  comparte con `/pedido` público); actualizar textos del tour y los tests
  que los assertan.
- **Mobile (opcional)**: barra resumen sticky inferior en `<lg` con
  "N ítems · $ total · Ver venta" que ancla al carrito.

### Decisiones tomadas

1. Regla de parseo de montos: **es-AR estricto** — `.` = miles, `,` =
   decimal, redondeo a pesos enteros (`payment-helpers.ts`).
2. Alcance del rediseño de `PaymentPartsInput`: **ambas pantallas** (ventas y
   cobro de pedidos comparten el componente).
3. Renombres "pedido"→"venta" y barra resumen mobile: **implementados**.

## 3. Plan de implementación sugerido (incremental)

1. **Quick wins del carrito** (sin tocar inputs de pago): título, quitar
   ítem, vaciar con confirmación, subtotal por línea, aviso de caja cerrada,
   shortage por línea, errores inline, razón de bloqueo del botón.
2. **Rediseño de inputs de pago**: formato es-AR, regla de parseo única,
   "Recibido" separado, reparto explícito, fix del vuelto fantasma (B1),
   hint de atajos. Impacta `payment-parts-input.test.tsx` y
   `payment-helpers.test.ts`.
3. **Terminología y mobile**: renombres + actualización coordinada de tour y
   E2E; barra resumen mobile opcional.

## 4. Selectores a preservar o actualizar en conjunto

Preservar (usados por E2E/tour): `data-tour="sales-cart"`,
`data-tour="payment-parts-input"`, `data-tour="sales-products"`,
`data-testid="cart-item"` (+`data-line-id`/`data-product-id`/`data-product-name`),
`empty-cart-message`, `confirm-sale-button`, `toggle-show-out-of-stock`,
`product-card` (+`data-product-name`/`data-out-of-stock`),
`product-card-cart-quantity-{id}`, `payment-{cash,transfer}-{full,input}`,
`payment-{method}-denom-{n}`, `payment-cash-bill-{n}`,
`payment-{method}-complete-{rest,other}`, `payment-clear`,
`payment-{mixed,remaining,change}-badge`, `confirm-dialog-confirm`.

Actualizar si se aprueban los renombres/cambios de texto:
`tour-context.tsx` (títulos de pasos) + `tour.spec.ts`,
`sales-terminal.test.tsx` ("Pedido", "en pedido", "Agregar al pedido",
"Calculando disponibilidad..."), `ventas-disponibilidad.spec.ts`
("Agregar al pedido", "Calculando disponibilidad..."),
`ventas-stock-compartido.spec.ts` ("En este pedido: 1 más"),
`payment-helpers.test.ts` (heurística de parseo),
`payment-parts-input.test.tsx` (valores de inputs si cambia el formato).

## 5. Implementado

Cambios aplicados el 2026-09-06 tras la aprobación del alcance completo:

- **`src/lib/payment-helpers.ts`** — `parsePaymentAmount` con regla es-AR
  estricta: `.` = miles, `,` = decimal (máx. una), redondeo a pesos enteros.
  Elimina la ambigüedad "1.5"→2 vs "1.500"→1500.
- **`src/components/pagos/money-amount-input.tsx`** (nuevo) — input de monto
  que muestra `formatNumber` es-AR y conserva el texto crudo mientras está
  enfocado; al perder el foco vuelve al formato agrupado.
- **`src/components/pagos/payment-parts-input.tsx`** — reparto explícito
  entre métodos (editar uno nunca toca el otro; el monto se clampa a lo que
  falta cubrir), campo separado **"Efectivo recibido"** con botones de
  billetes y línea `Recibido: $ X` + badge `Vuelto`/`Falta recibir`; fix del
  vuelto fantasma (B1) reseteando el recibido cuando cambia el total o el
  pago en efectivo cae a 0; hint de atajos visible
  (`Enter` completa el resto con ese medio, `Esc` pasa todo a efectivo).
- **`src/components/ventas/sales-cart.tsx`** — título "Venta actual" con
  badge de ítems y botón **Vaciar** (`ConfirmDialog`), aviso inline de caja
  cerrada, subtotal por línea, botón **Quitar** por ítem, botón
  **Personalizar** con ícono, faltante de insumos por línea
  (`cart-item-shortage`), sección **Cobro** separada, errores inline sobre el
  botón, botón "Confirmar venta" con label fijo + motivo de bloqueo
  (`confirm-sale-blocker`, `aria-live`), y barra resumen fija en mobile
  (`cart-mobile-bar`).
- **`src/components/ventas/sales-terminal.tsx`** — banners de error y de
  faltantes movidos dentro del carrito; `clearCart`; el error se limpia al
  corregir la condición; `confirmLabel="Agregar a la venta"` en el diálogo de
  personalización.
- **Terminología** — `N en venta`, `Podés sumar: N más`, aria-label
  `Agregar X a la venta` (`product-card-base.tsx`,
  `product-card-sales-extra.tsx`); paso del tour renombrado a "Venta actual"
  (`tour-context.tsx`).
- **Tests** — actualizados `payment-helpers.test.ts`,
  `payment-parts-input.test.tsx` (flujo explícito, formato al blur, recibido
  y reset de vuelto), `sales-terminal.test.tsx` (blocker, quitar, vaciar,
  shortage por línea), `product-card-base.test.tsx`, y los E2E
  `ventas-disponibilidad.spec.ts`, `ventas-stock-compartido.spec.ts` y
  `tour.spec.ts`.

Verificaciones: `npx tsc --noEmit`, `npm run lint`, `npm test`
(148 suites / 1448 tests) y `npm run build` en verde; `npm run knip` sin
hallazgos. Pendiente: corrida manual de `npm run dev` y E2E de ventas contra
base descartable.
