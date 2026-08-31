# Prompt: mejorar la UX de combos y pagos en el módulo de ventas (`/ventas`)

> **Estado:** implementado.  
> Este prompt consolida dos mejoras de UX en el terminal de ventas: mostrar los servicios/extras del combo de forma clara y facilitar el ingreso de montos en efectivo/transferencia adaptado al peso argentino.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

Código relevante:

- Diálogo de opciones de promo: <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />
- Input de pagos mixtos: <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" />
- Validación de pagos: <ref_file file="C:/developer/paginas/pancheria/src/lib/payment-helpers.ts" />
- Terminal de ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
- Tarjeta de producto en ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-product-card.tsx" />
- Tarjeta de producto en pedidos públicos (también usa `PromoOptionsDialog`): <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />
- Carrito de ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-cart.tsx" />
- Historial de ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-history.tsx" />
- Resumen de caja: <ref_file file="C:/developer/paginas/pancheria/src/components/caja/cash-register-summary.tsx" />
- Helpers de ventas: <ref_file file="C:/developer/paginas/pancheria/src/lib/ventas-helpers.ts" />
- Utilidad de moneda: <ref_file file="C:/developer/paginas/pancheria/src/lib/money.ts" />
- Formulario de promos: <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />
- Tests de pagos: <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.test.tsx" />
- Tests del terminal: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.test.tsx" />

## Estado actual relevante

- El diálogo de opciones de promo (`PromoOptionsDialog`) muestra los insumos críticos bajo "Siempre incluye" y todos los insumos opcionales bajo "Quitá lo que no querás" (<ref_snippet file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" lines="41-48" />). Esto mezcla los insumos manuales y los servicios/extras, dificultando distinguir, por ejemplo, el "vaso de gaseosa" como servicio incluido.
- El input de pagos (`PaymentPartsInput`) usa `type="number" step="0.01"` (<ref_snippet file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" lines="112-119" />), mostrando siempre centavos. En el contexto argentino, los montos son altos (miles de pesos) y los centavos no son operativamente relevantes; además, los controles de subir/bajar del navegador permiten incrementos decimales, lo que es incómodo para el operador.
- El terminal de ventas, el carrito, el historial de ventas y el resumen de caja muestran totales con `toFixed(2)` y no aplican formato de miles (p. ej. `$15000.00` en lugar de `$15.000`).

## Objetivo

Mejorar la experiencia del operador/administrador en la sección de ventas para que:

1. Al seleccionar un combo, el diálogo muestre claramente los **servicios / extras** incluidos (por ejemplo, vaso de gaseosa) en una sección separada de los insumos críticos y manuales.
2. El ingreso de montos en efectivo y transferencia esté adaptado a la operativa en pesos argentinos: sin centavos, con formato de miles, con botones de denominación rápida y con una forma ágil de completar el resto del pago.
3. Los cambios sean accesibles, no rompan el flujo de pagos mixtos ni el resumen de caja, y pasen las verificaciones del proyecto.

## Alcance

Aplicar cambios en:

- `src/components/promo/promo-options-dialog.tsx`.
- `src/components/pagos/payment-parts-input.tsx`.
- `src/lib/payment-helpers.ts` (solo si cambia la validación o el redondeo de pagos).
- `src/components/ventas/sales-terminal.tsx`.
- `src/components/ventas/sales-product-card.tsx`.
- `src/components/ventas/sales-cart.tsx`.
- `src/components/pedido/product-card.tsx` (si el diálogo modificado requiere ajustes de integración).
- `src/lib/money.ts` (extender con helper de formato, no duplicar).
- `src/config/payments.ts` (crear si no existe).
- Tests unitarios y E2E relacionados.

No modificar:

- Esquema de base de datos ni migraciones.
- Flujo de pedidos públicos más allá del impacto directo de `PromoOptionsDialog`.
- Métodos de pago (`cash` / `transfer`).
- Lógica de caja, anulación, cierre diario ni stock, salvo ajustes de presentación.

## Criterios de aceptación

- [x] `PromoOptionsDialog` muestra los insumos críticos en "Siempre incluye" y los opcionales en "Complementos opcionales", subdivididos entre insumos manuales y servicios/extras.
- [x] Los insumos manuales y servicios configurados como obligatorios (`isOptional = false`) se muestran en "Siempre incluye" junto con los críticos.
- [x] `PaymentPartsInput` solo acepta montos enteros, sin centavos.
- [x] Los botones de denominación rápida suman su valor al monto del método activo, sin superar el total.
- [x] El botón "Completar resto" rellena el método activo con el monto exacto que falta para cubrir el total.
- [x] Los totales y montos en el módulo de ventas muestran formato de pesos argentino con separador de miles y sin centavos.
- [x] Los pagos mixtos continúan sumando exactamente el total de la venta.
- [x] El flujo de pedidos públicos (`/pedido`) sigue funcionando con el diálogo de opciones.
- [x] No se rompen los tests unitarios existentes; se agregan tests nuevos para el diálogo y los pagos.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` pasan.

## Reglas de negocio

1. En una receta, los insumos críticos son obligatorios; los insumos manuales y los servicios son opcionales por defecto (<ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" lines="38-41" />).
2. Un `manual_supply` o `service` puede configurarse como obligatorio (`isOptional = false`) o opcional (`isOptional = true`). El criterio para mostrarlo en "Siempre incluye" o "Complementos opcionales" es `isOptional`, no solo `supplyType`.
3. Los servicios (`service`) no tienen stock y no modifican el precio de la promo; se muestran como "extras" incluidos.
4. El precio de la promo es fijo; quitar o incluir servicios/insumos manuales no lo altera.
5. Los pagos mixtos deben seguir sumando exactamente el total de la venta.
6. La operativa argentina maneja pesos enteros. Los montos ingresados por el operador se redondean al entero más cercano y se descartan los centavos en la UI. El almacenamiento interno mantiene compatibilidad con `numeric(10, 2)`.
7. No hardcodear URLs de API, credenciales, denominaciones fijas ni textos; las denominaciones se obtienen desde `src/config/payments.ts` y pueden sobrescribirse con `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`.

## Implementación detallada

### 1. Diálogo de opciones de promo

En <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />:

- Reemplazar la agrupación binaria `criticalItems` / `optionalItems` por dos grupos principales basados en `isOptional`:
  - **Siempre incluye**: ítems con `isOptional = false` (incluye `critical_supply` y cualquier `manual_supply` o `service` configurado como obligatorio).
  - **Complementos opcionales**: ítems con `isOptional = true`, subdivididos en dos secciones visuales:
    - **Insumos opcionales**: `manual_supply`.
    - **Servicios / extras**: `service`.
- Mostrar cada grupo y subgrupo solo si tiene ítems, en ese orden, con encabezados claros.
- Mantener la lógica de selección: los opcionales se preseleccionan según `selectedByDefault`; el operador puede marcar/desmarcar.
- Agregar un resumen visible del combo antes de confirmar: producto, precio formateado y una línea compacta con los ítems seleccionados.
- Preservar accesibilidad: `aria-label` en cada checkbox y botones.
- Verificar que el componente siga funcionando en el flujo de pedidos públicos (`src/components/pedido/product-card.tsx`).

### 2. Ingreso de pagos adaptado a pesos argentinos

En <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" />:

- Cambiar los inputs de monto a valores enteros:
  - Usar `type="number" inputMode="numeric" pattern="[0-9]*" step="1" min="0"`.
  - Al parsear, redondear al entero más cercano (`Math.round`) y descartar centavos.
  - Evitar que los controles de subir/bajar del navegador permitan incrementos decimales; con `step={1}` el navegador salta de a 1 peso.
- Mostrar los valores con formato de moneda argentina sin centavos:
  - Extender `src/lib/money.ts` con un helper reutilizable (por ejemplo, `formatMoney(amount: number): string`) que use `Intl.NumberFormat('es-AR', { ... })` o similar, manteniendo `dinero.js` como motor de cálculo interno.
  - No duplicar la lógica de formato en componentes.
  - Opcional: agregar el símbolo `$` como parte del input o como adorno.
- Agregar botones de denominación rápida (valores leídos desde `src/config/payments.ts`) que **sumen** su valor al monto actual del método activo, sin superar el total de la venta.
- Agregar un botón "Completar resto" junto a cada input, que rellene ese método con el monto faltante para cubrir el total.
- Mantener los botones "Todo efectivo" / "Todo transferencia" y el badge "Mixto" actuales.
- Asegurar que el `onChange` emita `PaymentPart[]` con montos enteros.

### 3. Configuración de denominaciones

Crear o extender <ref_file file="C:/developer/paginas/pancheria/src/config/payments.ts" /> (si no existe, crearlo):

```ts
const envDenominations = process.env.NEXT_PUBLIC_PAYMENT_DENOMINATIONS;

export const DEFAULT_DENOMINATIONS = envDenominations
  ? envDenominations
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
  : [1000, 2000, 5000, 10000, 20000];
```

Importar `DEFAULT_DENOMINATIONS` en `PaymentPartsInput`. No hardcodear las cifras en el componente.

> **Nota:** si se expone `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`, documentarla en `AGENTS.md` y en `.env.example`.

### 4. Formateo de montos en la UI

- Extender `src/lib/money.ts` con un helper de formato de moneda argentina sin centavos y con separador de miles.
- Reemplazar `.toFixed(2)` por el helper en los componentes del módulo de ventas y pagos, priorizando:
  - `src/components/ventas/sales-cart.tsx`
  - `src/components/ventas/sales-product-card.tsx`
  - `src/components/ventas/sales-terminal.tsx`
  - `src/components/ventas/sales-history.tsx`
  - `src/components/pagos/payment-parts-input.tsx`
  - `src/components/caja/cash-register-summary.tsx`
  - `src/components/pedido/product-card.tsx` (precio y totales)
- Si el helper se extiende a todo el proyecto, hacerlo como tarea aparte para no distraer el foco de esta mejora.

### 5. Tests

- Actualizar <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.test.tsx" /> para reflejar:
  - entradas enteras,
  - botones de denominación (suman al monto actual),
  - formato con separador de miles,
  - redondeo de decimales,
  - "Completar resto".
- Actualizar <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.test.tsx" /> si cambian selectores o valores.
- Crear `src/components/promo/promo-options-dialog.test.tsx` con casos:
  - los críticos se renderizan en "Siempre incluye" y no se pueden desmarcar,
  - los insumos manuales y servicios opcionales se renderizan en secciones separadas,
  - los ítems opcionales se preseleccionan según `selectedByDefault`,
  - un `manual_supply`/`service` con `isOptional = false` aparece en "Siempre incluye".
- Verificar tests E2E relacionados (`tests/e2e/ventas*.spec.ts`, `tests/e2e/pedido*.spec.ts`, `tests/e2e/paso4*.spec.ts`).

### 6. Validaciones y consistencia

- Revisar <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />: la validación `Math.abs(paid - total) >= 0.005` sigue siendo válida, pero con montos enteros el pago debe coincidir con el total. Considerar redondear el total a entero para el cálculo del resto y validar con `Math.round(paid) === Math.round(total)`, o mantener la tolerancia para compatibilidad futura.
- Revisar <ref_file file="C:/developer/paginas/pancheria/src/lib/payment-helpers.ts" /> y `validatePaymentParts`: si el redondeo de pagos cambia, actualizar los mensajes de error y la comparación.
- Revisar que `saleService` y la base de datos sigan aceptando montos con dos decimales; no es necesario cambiar el esquema.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API, secretos ni parámetros sensibles.
- No modificar el esquema de base de datos; la mejara es puramente de UX en el cliente.
- Ejecutar tests E2E solo en una base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`), siguiendo <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />.
- No commitear `.env.local`, `.env.e2e` ni archivos de entorno.
- Si se crea un helper de formato, ubicarlo en `src/lib/money.ts` y no duplicar lógica.
- Si se expone `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`, actualizar `AGENTS.md`, `.env.example` y `.devin/environment.yaml`.

## Verificaciones

Ejecutar en orden:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. `npm run knip`
6. `npm run test:e2e` (solo en base descartable, con `.env.e2e` configurado)

Si alguna verificación falla, corregir antes de continuar. Documentar decisiones no triviales en `.devin/informes/lecciones-aprendidas.md` si aplica.
