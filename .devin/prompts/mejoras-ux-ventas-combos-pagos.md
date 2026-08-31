# Prompt: mejorar la UX de combos y pagos en el módulo de ventas (`/ventas`)

> **Estado:** activo — a implementar.  
> Este prompt consolida dos mejoras de UX en el terminal de ventas: mostrar los servicios/extras del combo de forma clara y facilitar el ingreso de montos en efectivo/transferencia adaptado al peso argentino.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

Código relevante:

- Diálogo de opciones de promo: <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />
- Input de pagos mixtos: <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" />
- Terminal de ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
- Tarjeta de producto en ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-product-card.tsx" />
- Carrito de ventas: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-cart.tsx" />
- Helpers de ventas: <ref_file file="C:/developer/paginas/pancheria/src/lib/ventas-helpers.ts" />
- Utilidad de moneda: <ref_file file="C:/developer/paginas/pancheria/src/lib/money.ts" />
- Formulario de promos: <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />
- Tests de pagos: <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.test.tsx" />
- Tests del terminal: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.test.tsx" />

## Estado actual relevante

- El diálogo de opciones de promo (`PromoOptionsDialog`) muestra los insumos críticos bajo "Siempre incluye" y todos los insumos opcionales bajo "Quitá lo que no querás" (<ref_snippet file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" lines="41-48" />). Esto mezcla los insumos manuales y los servicios/extras, dificultando distinguir, por ejemplo, el "vaso de gaseosa" como servicio incluido.
- El input de pagos (`PaymentPartsInput`) usa `type="number" step="0.01"` (<ref_snippet file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" lines="112-119" />), mostrando siempre centavos. En el contexto argentino, los montos son altos (miles de pesos) y los centavos no son operativamente relevantes; además, los controles de subir/bajar del navegador permiten incrementos decimales, lo que es incómodo para el operador.
- El terminal de ventas y el carrito muestran totales con `toFixed(2)` y no aplican formato de miles (p. ej. `$15000.00` en lugar de `$15.000`).

## Objetivo

Mejorar la experiencia del operador/administrador en la sección de ventas para que:

1. Al seleccionar un combo, el diálogo muestre claramente los **servicios / extras** incluidos (por ejemplo, vaso de gaseosa) en una sección separada de los insumos críticos y manuales.
2. El ingreso de montos en efectivo y transferencia esté adaptado a la operativa en pesos argentinos: sin centavos, con formato de miles, con botones de denominación rápida y con una forma ágil de completar el resto del pago.
3. Los cambios sean accesibles, no rompan el flujo de pagos mixtos ni el resumen de caja, y pasen las verificaciones del proyecto.

## Reglas de negocio

1. En una receta, los insumos críticos son obligatorios; los insumos manuales y los servicios son opcionales (<ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" lines="38-41" />).
2. Los servicios (`service`) no tienen stock y no modifican el precio de la promo; se muestran como "extras" incluidos.
3. El precio de la promo es fijo; quitar o incluir servicios/insumos manuales no lo altera.
4. Los pagos mixtos deben seguir sumando exactamente el total de la venta.
5. Los montos ingresados por el operador se redondean a pesos enteros (sin centavos) antes de guardarse; el almacenamiento interno mantiene compatibilidad con `numeric(10, 2)`.
6. No hardcodear URLs de API, credenciales, denominaciones fijas ni textos; las denominaciones pueden vivir en una configuración (`src/config/payments.ts`) con valores por defecto.

## Implementación detallada

### 1. Diálogo de opciones de promo

En <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />:

- Reemplazar la agrupación binaria `criticalItems` / `optionalItems` por tres agrupaciones por `supplyType`:
  - **Siempre incluye**: insumos críticos (`critical_supply`) con `isOptional = false` (no se pueden quitar).
  - **Complementos opcionales**: insumos manuales (`manual_supply`) con `isOptional = true`.
  - **Servicios / extras**: servicios (`service`) con `isOptional = true`.
- Mostrar cada grupo solo si tiene ítems, en ese orden, con encabezados claros.
- Mantener la lógica de selección: los opcionales se preseleccionan según `selectedByDefault`; el operador puede marcar/desmarcar.
- Agregar un resumen visible del combo antes de confirmar: producto, precio formateado y una línea compacta con los ítems seleccionados.
- Preservar accesibilidad: `aria-label` en cada checkbox y botones.

### 2. Ingreso de pagos adaptado a pesos argentinos

En <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.tsx" />:

- Cambiar los inputs de monto a valores enteros:
  - Usar `inputMode="numeric"`, `pattern="[0-9]*"` o `type="number" step="1"`.
  - Al parsear, convertir a entero (`Math.round` / `parseInt`) y descartar centavos.
  - Si el usuario ingresa `1000.50`, redondear a `1001` o truncar a `1000` según se decida; documentar la decisión en el código.
- Mostrar los valores con formato de moneda argentina (`es-AR`):
  - Usar `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` o un helper reutilizable en `src/lib/money.ts`.
  - Mostrar centavos solo si son distintos de cero.
  - Opcional: agregar el símbolo `$` como parte del input o como adorno.
- Agregar botones de denominación rápida (ej. `$1000`, `$2000`, `$5000`, `$10000`, `$20000`) que completen el monto del método activo.
- Agregar un botón "Completar resto" junto a cada input, que rellene ese método con el monto faltante para cubrir el total.
- Evitar que los controles de subir/bajar del input permitan incrementos decimales; con `step={1}` el navegador salta de a 1 peso.
- Mantener los botones "Todo efectivo" / "Todo transferencia" y el badge "Mixto" actuales.
- Asegurar que el `onChange` emita `PaymentPart[]` con montos enteros.

### 3. Configuración de denominaciones

Crear o extender <ref_file file="C:/developer/paginas/pancheria/src/config/payments.ts" /> (si no existe, crearlo):

```ts
export const DEFAULT_DENOMINATIONS = [1000, 2000, 5000, 10000, 20000];
```

Importar esta constante en `PaymentPartsInput`. No hardcodear las cifras en el componente.

### 4. Formateo de montos en el resto de la UI (opcional pero recomendado)

- Revisar <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-cart.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-product-card.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-history.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/caja/cash-register-summary.tsx" />.
- Reemplazar `.toFixed(2)` por un helper de formato de moneda local cuando sea pertinente, especialmente para montos altos (miles de pesos).

### 5. Tests

- Actualizar <ref_file file="C:/developer/paginas/pancheria/src/components/pagos/payment-parts-input.test.tsx" /> para reflejar:
  - entradas enteras,
  - botones de denominación,
  - formato con separador de miles,
  - redondeo/truncado de decimales,
  - "Completar resto".
- Actualizar <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.test.tsx" /> si cambian selectores o valores.
- Agregar tests para `PromoOptionsDialog` si no existen:
  - los servicios se renderizan en una sección separada,
  - los insumos críticos no se pueden desmarcar,
  - los insumos manuales y servicios se preseleccionan según `selectedByDefault`.
- Verificar tests E2E relacionados (`tests/e2e/ventas*.spec.ts`).

### 6. Validaciones y consistencia

- Revisar <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />: la validación `Math.abs(paid - total) >= 0.005` sigue siendo válida, pero con montos enteros el pago debe coincidir con el total. Considerar usar `Math.round(paid) === Math.round(total)` o mantener la tolerancia para compatibilidad futura.
- Revisar que `saleService` y la base de datos sigan aceptando montos con dos decimales; no es necesario cambiar el esquema.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API, secretos ni parámetros sensibles.
- No modificar el esquema de base de datos; la mejora es puramente de UX en el cliente.
- Ejecutar tests E2E solo en una base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`), siguiendo <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />.
- No commitear `.env.local`, `.env.e2e` ni archivos de entorno.
- Si se crea un helper de formato, ubicarlo en `src/lib/money.ts` o `src/lib/format-currency.ts` y no duplicar lógica.

## Verificaciones

Ejecutar en orden:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. `npm run knip`
6. `npm run test:e2e` (solo en base descartable, con `.env.e2e` configurado)

Si alguna verificación falla, corregir antes de continuar. Documentar decisiones no triviales en `.devin/informes/lecciones-aprendidas.md` si aplica.
