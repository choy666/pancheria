# Prompt: Pendientes de pedidos con múltiples líneas personalizadas

## Contexto

Se implementó la funcionalidad de múltiples líneas del mismo producto personalizado en `pancheria`. Las verificaciones principales pasan:

- `npx tsc --noEmit` OK
- `npm run lint` OK
- `npm test` 125 suites / 1203 tests OK
- `npm run build` OK
- `npm run knip` OK
- `npm run test:e2e` 103 tests OK

Sin embargo, la auditoría final detectó pendientes de calidad, cobertura, documentación y robustez que deben resolverse para considerar la feature terminada y lista para producción.

## Pendientes identificados

### 1. Warning de React: keys duplicadas

Durante los tests E2E de múltiples líneas apareció:

```text
Encountered two children with the same key, `152`.
```

No hace fallar los tests, pero indica que alguna lista renderiza dos hijos con el mismo `key`. Los candidatos principales son:

- `src/components/pedido/pedido-catalog-section.tsx` (`key={product.id}` dentro de `group.items`).
- `src/components/ventas/sales-terminal.tsx` (`key={product.id}` en el grid de productos).
- `src/components/promo/promo-options-dialog.tsx` (`key={item.supplyId}` en `renderSection`).

Objetivo:
- Reproducir la advertencia con `npx playwright test tests/e2e/pedido.spec.ts`.
- Revisar el trace de Playwright o inspeccionar el DOM para identificar el componente exacto.
- Corregir la fuente de duplicación (no solo silenciar el warning con índices).
- Si el problema es `PromoOptionsDialog`, verificar que `recipe` no tenga insumos repetidos; si es el catálogo, verificar que `groupedProducts` no contenga productos duplicados.

### 2. Test E2E flaky: pedido en sucursal no default

`tests/e2e/pedido.spec.ts` -> `crea un pedido en una sucursal no default y abre el chat` falló en una corrida aislada y pasó en la completa.

Posibles causas:
- Rate limit de pedidos públicos con la IP asignada.
- El producto creado vía API no se copia/visualiza en la segunda sucursal.
- Timing: el formulario se envía antes de que el carrito refleje el producto.

Objetivo:
- Reproducir el fallo varias veces.
- Determinar si es rate limit, catálogo o timeout.
- Aplicar la corrección mínima (espera extra, copia de catálogo, ajuste de IP, etc.).

### 3. Cobertura E2E faltante del plan

El plan original pide (Fase 6):

- Verificar en el panel del operador que el pedido muestra ambas líneas con sus recetas.
- Verificar en el chat que el mensaje de preparación refleja ambas configuraciones.

Objetivo:
- Extender `tests/e2e/pedido.spec.ts` con un test que, tras crear un pedido con dos variantes:
  - Navegue a `/pedidos`.
  - Acceda al detalle del pedido.
  - Verifique dos líneas con resumen de recetas distintas.
- Extender el mismo flujo para verificar el chat del pedido:
  - El mensaje de preparación del sistema mencione ambas configuraciones.

### 4. Test de `validateCartAvailability` en `product-helpers.test.ts`

El plan pide probar `validateCartAvailability` con dos líneas del mismo producto y selecciones distintas en `product-helpers.test.ts`. El test ya existe en `saleService.test.ts`, pero falta en `product-helpers.test.ts`.

Objetivo:
- Agregar un test análogo en `src/lib/product-helpers.test.ts` (o el archivo correspondiente) que llame directamente a `validateCartAvailability` con dos entradas del mismo `productId` y `selectedRecipeItemIds` distintos.
- Verificar `consumedBySupply`, `availabilityByProduct` y `shortageByProduct`.

### 5. Duplicación leve de tarjetas de producto

`ProductCard` (`src/components/pedido/product-card.tsx`) y `SalesProductCard` (`src/components/ventas/sales-product-card.tsx`) comparten estructura, estilos y comportamiento similar (tarjeta con imagen, nombre, precio, badge de cantidad, disponibilidad, botón).

Objetivo:
- Evaluar si conviene extraer un componente base `BaseProductCard` con las partes comunes (imagen, título, badge, precio, disponibilidad) y especializar las variantes.
- Si la unificación no aporta claridad, documentar la decisión de mantenerlos separados.
- No generar abstracción por encima de la utilidad; priorizar legibilidad.

### 6. Sincronización completa del plan

`.devin/prompts/plan-pedidos-personalizados-multiples-lineas.md` ya refleja los `data-testid` implementados, pero la Fase 6 y otras secciones no están actualizadas con:

- Tests E2E agregados de múltiples líneas.
- Corrección de `PromoOptionsDialog` con `dialogKey`.
- Componente `CartItemRecipeDetails` extraído.
- Tests de `validateCartAvailability` duplicados.

Objetivo:
- Revisar todo el plan y dejarlo alineado con el estado final del código.
- Eliminar bloques obsoletos o que ya no aplican.
- Agregar sección de "Pendientes resueltos" o similares para trazabilidad.

## Reglas de negocio a mantener

1. Cada línea de carrito se identifica por `lineId`.
2. Dos líneas del mismo producto con distintas `selectedRecipeItemIds` deben permanecer separadas.
3. Si una edición deja dos líneas idénticas, deben fusionarse.
4. El backend procesa arrays de ítems sin agrupar por `productId`.
5. Los `data-testid` del carrito son estables (`cart-item`, `checkout-item`) y los selectores dinámicos usan `data-line-id` / `data-product-id` / `data-product-name`.
6. Los E2E corren en una base descartable (`neondb_e2e`) y con `ADMIN_USERNAME` / `ADMIN_PASSWORD` consistentes con el seed.

## Consideraciones técnicas

- No usar `setState` dentro de `useEffect` (regla de lint).
- No hardcodear IDs, credenciales ni URLs.
- Mantener compatibilidad backward con `pancheria-cart-v1`.
- Si se cambia `key` de listas, preferir soluciones semánticas (eliminar duplicados) sobre índices arbitrarios.
- Los tests E2E deben usar selectores por `data-testid`, `data-product-id`, `data-line-id` y `data-product-name`.
- Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run knip` y `npm run test:e2e` al finalizar cada fase.

## Flujo sugerido de implementación

1. **Investigación del warning**
   - Correr `npx playwright test tests/e2e/pedido.spec.ts` con `--reporter=line`.
   - Revisar `test-results/.../trace.zip`.
   - Identificar componente y corregir.

2. **Flaky test de sucursal**
   - Correr el test aislado varias veces.
   - Aplicar corrección.

3. **Cobertura E2E panel/chat**
   - Agregar tests en `tests/e2e/pedido.spec.ts` o en un archivo nuevo.
   - Reutilizar helpers existentes (`loginAs`, `ensureCashRegisterOpen`, `createProductViaApi`, `restockProductViaApi`).

4. **Test `validateCartAvailability` en `product-helpers.test.ts`**
   - Revisar estructura de `src/lib/product-helpers.test.ts`.
   - Agregar test con mocks consistentes.

5. **Refactor de tarjetas (opcional)**
   - Analizar similitudes y decidir si extraer `BaseProductCard`.

6. **Sincronización del plan**
   - Actualizar `.devin/prompts/plan-pedidos-personalizados-multiples-lineas.md`.
   - Actualizar este prompt marcando lo resuelto.

## Verificaciones finales

Antes de dar por terminado:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run knip
npm run test:e2e
```

## Nota de seguridad

- No commitear `.env.e2e`.
- No exponer URLs de base de datos, contraseñas ni `NEXTAUTH_SECRET` en commits ni en prompts.
- Usar solo la base `neondb_e2e` (o similar con sufijo descartable) para E2E.
