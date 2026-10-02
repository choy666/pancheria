# Prompt: Rediseño visual de la card de producto y del modal de personalización en `/pedido`

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y pedidos públicos.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:

- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/guia-funcionamiento-pancheria.md`
- `.devin/informes/prueba-promo-imagen-2026-10-01.md` — las imágenes de promo ya se persisten y renderizan en `/pedido` (`resolveProductImage`, `ProductCardImage`).
- `.devin/prompts/archivados/mejoras-ux-pedido-publico.md` — historial de decisiones de UX en el flujo público.
- `.devin/prompts/archivados/plan-pedidos-personalizados-multiples-lineas.md` — modelo de líneas del carrito (`lineId`, una línea por unidad personalizada).

## Estado actual relevante

- La card pública es `ProductCardBase` con `variant="catalog"` (`src/components/productos/product-card-base.tsx`): card oscura con título + badge "Promo" en el header, bloque `aspect-video` con imagen o ícono `ImageOff`, precio azul, disponibilidad cualitativa ("Disponible"), texto `Incluye: … (se puede quitar)` y un botón full-width "Personalizar"/"Agregar".
- El modal es `PromoOptionsDialog` (`src/components/promo/promo-options-dialog.tsx`), **compartido** por `/pedido` (agregar desde catálogo y editar línea con `mode="edit"`) y `/ventas` (`sales-terminal.tsx`, con `confirmLabel="Agregar a la venta"`): secciones "Incluye" / "Podés sacar" / "Extras" con checkboxes nativos, resumen `Incluye: …` y footer Cancelar + "Agregar al pedido".
- La app fuerza tema oscuro en `src/app/layout.tsx` (`className="… dark …"`); la propuesta visual es clara.
- Carrito: `useSellableCart.addItem(product, selectedRecipeItemIds?)` agrega **una** línea por unidad (los personalizables nunca se fusionan); `groupCartItemsForSubmit` compacta líneas idénticas al enviar. El carrito persiste en localStorage con schema `pancheria-cart-v1` (`useCart.ts`).
- No existen aclaraciones por ítem: `orders.notes` existe a nivel pedido, pero `order_items` y `sale_items` no tienen columna de notas.
- La imagen del producto (`product.imageUrl`) ya llega a la card pero **no** se pasa al `PromoOptionsDialog`.

## Objetivo

Implementar el rediseño estilo "food-delivery" propuesto en los mockups de referencia:

### Card (mockup)

- Card clara (fondo blanco), bordes redondeados grandes, dividida en dos zonas:
  - **Hero (~55-60 % de la altura)**: imagen del producto a todo ancho sobre fondo decorativo diagonal rojo→amarillo; pill amarillo "PROMO" arriba a la izquierda.
  - **Cuerpo blanco**: nombre en bold negro grande, descripción corta en lenguaje natural ("Pan con 2 salchichas, cebolla y ajo. Sacale lo que no quieras."), fila inferior con precio rojo grande a la izquierda y, a la derecha, un botón circular ghost con ícono de personalización más un botón pill rojo "Agregar".
- Desaparecen la línea "Disponible" y el texto `Incluye: …` (su rol lo cumple la descripción); el badge "N en tu pedido" se conserva, reubicado sobre el hero.

### Modal (mockup)

- Modal claro; el header es el mismo hero con la imagen del producto y el botón de cerrar (X) en círculo blanco arriba a la derecha.
- Cuerpo: nombre del producto y precio rojo en la misma fila; descripción corta debajo.
- Sección **"A TU GUSTO"**: una fila por insumo opcional con el nombre a la izquierda y un chip-toggle a la derecha — estado activo "✓ Lleva" con borde/texto rojo, estado inactivo "Sin <nombre>" en gris. Reemplaza los checkboxes.
- Sección **"ACLARACIONES"**: input de texto con placeholder "Ej: bien tostado" — **excluida de este plan** (sin persistencia hoy; entra en PR 3).
- Footer: stepper de cantidad `− 1 +` a la izquierda y CTA rojo "Agregar · $1.000" (muestra `precio × cantidad`) ocupando el resto del ancho.

## Decisiones resueltas (con correcciones de la revisión)

1. **Tema**: claro solo en el flujo público (`(public)`); panel y `/ventas` siguen oscuros. **Corrección de la revisión**: en `globals.css` el bloque `:root` ya es la paleta oscura (`.dark` la duplica) — no existe paleta clara, hay que escribirla. Además `Dialog`/`Select` portalean a `document.body`: mover `.dark` de `<html>` al layout de `(panel)` haría que los diálogos del panel escapen del scope y rendericen en claro. Enfoque recomendado: mantener `dark` en `<html>`, definir un scope de tokens `[data-theme='light']` (o `.light`) con la paleta clara, aplicarlo en `(public)/layout.tsx` y pasarlo como `className` a `DialogContent`/`SelectContent`/portales del flujo público. Los `dark:` residuales de `button.tsx`/`badge.tsx` siguen aplicando dentro del área clara — revisión visual puntual.
2. **Aclaraciones por ítem**: NO entran ahora (PR 3 aparte). El campo no se muestra en la UI — no dejar un input que no se guarda.
3. **Hero sin imagen**: fallback con la diagonal rojo/mostaza de marca + logo, en un solo componente reutilizable (no `ImageOff`). **Corrección**: no existe asset de logo en `public/` — crearlo (SVG) o usar monograma de texto.
4. **"Agregar" en promos con opcionales**: agrega directo con `selectedByDefault` (`useSellableCart.addItem` ya lo resuelve) y el botón circular abre el modal. La línea del carrito ya muestra la selección (`formatRecipeSummary` → "Incluye: … Sin: …") y permite editarla (`startEditLine` → `mode="edit"`) — **verificado, ya funciona**.
5. **`/ventas`**: un solo `PromoOptionsDialog` con prop de variante; la variante de ventas no muestra hero. No duplicar el componente.
6. **Extras/servicios**: grupo aparte "SUMALE". **Corrección de la revisión**: los opcionales **no tienen precio propio** (`RecipeItemConfig` no lleva `price`; `unitPrice` siempre es `product.price`). Mostrarlos como extras gratuitos manteniendo el total `precio base × cantidad`; los "+ $500" implican una feature de extras cobrables (catálogo + pricing server-side en pedidos y ventas + snapshots) — decisión de negocio a tratar junto al PR 3, no en este plan.

## Marca (obligatorio)

- Colores como tokens de Tailwind: rojo `#D81F26`, mostaza `#F9B217`, blanco `#FFFFFF`, texto oscuro `#1a1a1a` sobre mostaza. No usar azul en componentes nuevos.
- Fuentes con `next/font`: Anton para títulos y precio (mapear a `--font-heading`, que ya existe en `@theme inline`), Poppins para texto. Con fallback.
- Badge "PROMO": fondo mostaza, texto oscuro.

## Reglas adicionales

- Total del CTA del modal = `precio base × cantidad` con `formatMoney` (los extras no suman — ver corrección de la decisión 6).
- En `mode="edit"` la línea es una sola unidad: ocultar el stepper de cantidad.
- No cambiar el modelo de datos (ids de insumos seleccionados). Lo que el cliente saca se muestra como "Sin <nombre>" — ya lo hace `formatRecipeSummary`.
- Imagen: `aspect-video`, `object-cover`, `next/image` con `sizes`, lazy, skeleton animado mientras carga, `priority` solo en la primera fila (pasar prop desde el grid — la card no conoce su posición).
- Interacción: leve zoom de la imagen en hover; toda la card clickeable sin romper testid (patrón `role="button"` + `onKeyDown` como la variante `sales`; el botón de personalizar hace `stopPropagation`).
- Accesibilidad: filas/botones ≥ 44 px, toggles con `role="switch"` o `aria-pressed` y estado también en texto, foco visible. Correr axe-core en tema claro sobre card y modal.
- Si más adelante se sube la versión del carrito (`pancheria-cart-v1` → v2), migrar los carritos guardados, no borrarlos.
- Mantener `data-testid` `product-card-${id}` y `add-product-${id}` (en el CTA "Agregar"); agregar `customize-product-${id}` para el botón circular de personalización.

## División en PRs

- **PR 1**: tokens de marca y fuentes, scope de tema claro en `(public)`, card nueva, fallback de imagen, skeleton de carga, badge reubicado, quick-add + botón de personalizar.
- **PR 2**: modal rediseñado: hero con imagen, "A TU GUSTO" con toggles, "SUMALE" (extras sin costo), stepper, footer fijo con CTA, restyle de la barra "Ver pedido" existente (`mobile-cart-bar` — no crear otra). Mobile: hoja desde abajo (**no existe Drawer/`vaul` — resolver dependencia o sheet propio**); escritorio: Dialog. Cuerpo con scroll y `max-h` en `dvh`.
- **PR 3** (con aprobación): aclaraciones por ítem con migración, cocina y `/pedidos`. Evaluar ahí también extras cobrables si el negocio los quiere.

## Reglas de negocio

1. El toggle de "A TU GUSTO" equivale al checkbox actual: activo = incluir. Respetar `selectedByDefault` al inicializar y `initialSelectedIds` en `mode="edit"`.
2. Los insumos no opcionales ya no se listan como filas (la descripción los cubre); si existen servicios opcionales mantenerlos como grupo separado.
3. El stepper arranca en 1; el CTA muestra `formatMoney(productPrice × cantidad)`; confirmar agrega N unidades con la misma selección. Para productos personalizables crear N líneas (`lineId` propio cada una) respetando `availability` y el tope que ya impone `useSellableCart`.
4. Preservar `mode="edit"` y `confirmLabel` (los usa `sales-terminal.tsx` y la edición de líneas del carrito en `pedido-client.tsx`).
5. Estado agotado: card atenuada y CTA deshabilitado con "Agotado".
6. Mantener los `data-testid` existentes: `product-card-${id}` y `add-product-${id}` en catálogo (los usan los specs E2E).

## Implementación detallada

### Frontend — tema y marca (PR 1)

- <ref_file file="C:/developer/paginas/pancheria/src/app/globals.css" />
  - Nueva paleta clara bajo scope `[data-theme='light']` (o `.light`): `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`, `--ring`, `--primary` (rojo marca), etc. Los bloques `:root`/`.dark` actuales quedan intactos (ambos son dark hoy).
  - Tokens de marca (`--color-brand-red`, `--color-brand-mustard`, `--color-brand-ink`) en `@theme` para usar `bg-brand-red`/`text-brand-ink` en componentes.
- <ref_file file="C:/developer/paginas/pancheria/src/app/layout.tsx" /> y `src/app/(public)/layout.tsx`
  - Cargar Anton + Poppins con `next/font/google` (variables `--font-anton`/`--font-poppins` o mapear `--font-heading`/`--font-sans` dentro del scope claro). Mantener `dark` en `<html>`; aplicar el scope claro en el wrapper de `(public)` (ver decisión 1).
- Portal de superficies públicas: el `PromoOptionsDialog` (PR 2) debe recibir la clase del scope claro en `DialogContent` — si no, portalea a `body` y sale oscuro.

### Frontend — card (PR 1)

- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-base.tsx" />
  - Reestructurar la rama `isCatalog`: card clickeable (patrón `role="button"` de la variante `sales`), hero con imagen + badge "PROMO" mostaza superpuesto + badge "N en tu pedido" reubicado, cuerpo con nombre en Anton, `product.description`, fila con precio + botón circular de personalizar (`customize-product-${id}`, `stopPropagation`) + CTA "Agregar" (`add-product-${id}`). La variante `sales` queda intacta.
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-image.tsx" />
  - Fallback de marca (diagonal rojo/mostaza + logo/monograma — crear el asset, hoy no existe) y `Skeleton` mientras carga.
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-availability.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-card-recipe-included.tsx" />
  - Dejan de renderizarse en `catalog` (conservar para `sales` si se sigue usando; si quedan sin consumidores, `npm run knip` los marcará).
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />
  - Pasar `priority`/`index` a las cards de la primera fila para `next/image`.

### Frontend — modal (PR 2)

- <ref_file file="C:/developer/paginas/pancheria/src/components/promo/promo-options-dialog.tsx" />
  - Reestructura con variante: hero con `ProductCardImage` solo en la variante pública (recibir `imageUrl`/`description` por props), sección "A TU GUSTO" con filas toggle (`aria-pressed`/`role="switch"`, texto "Lleva"/"Sin <nombre>"), sección "SUMALE" para servicios opcionales (mismo estilo, sin precio), stepper de cantidad (oculto en `mode="edit"`), footer fijo con CTA `Agregar · {formatMoney(precio × qty)}`. Sin campo de aclaraciones (PR 3).
  - Extender `PromoOptionsConfirmPayload` con `quantity`.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />
  - Pasar `imageUrl`/`description` al diálogo (también en `editingLine`); manejar `quantity` en `addItem`/`confirmEditLine` (N líneas para personalizables, respetando `availability` de `useSellableCart`); restyle de `mobile-cart-bar`.
- <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
  - Misma instancia de diálogo, variante ventas (sin hero, tono dark); verificar `confirmLabel`/`mode`.

### Backend

- Sin cambios en este plan (sin aclaraciones, sin extras cobrables). Si finalmente "SUMALE" cobra, es una feature aparte: `RecipeItemConfig` con precio, pricing en `cart-pipeline`/`sale-helpers`/`orderService` y snapshots.

### Tests

- `src/components/productos/product-card-base.test.tsx` y `src/components/promo/promo-options-dialog.test.tsx`: actualizar textos ("Podés sacar" → "A tu gusto", "Agregar al pedido" → CTA con precio) y agregar casos para stepper y toggles.
- E2E: `add-product-${id}` se usa ~40 veces en 8 specs — con quick-add, los specs que abren el modal por ese botón deben pasar a `customize-product-${id}`; el locator `Agregar al pedido` de `pedido.spec.ts` cambia al CTA con precio (usar regex `Agregar ·` o testid). Mantener `waitForHydratedInput` donde aplique.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales ni URLs de API; colores/gradientes como tokens de Tailwind, no valores sueltos repetidos.
- La migración se genera con `npx drizzle-kit generate` y se aplica con `npx drizzle-kit migrate` (no `push`); la base E2E es descartable (ver `AGENTS.md`).
- No correr E2E contra datos reales.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Tipos |
| `npm test` | Tests unitarios |
| `npm run knip` | Componentes que queden sin consumidores |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Suite E2E en base de prueba |

Antes de push: consultar `.devin/informes/checklist-pre-push.md`.

## Modo de trabajo

- Implementar **un PR por vez**: al terminar cada uno, parar y mostrar el resultado (capturas de la card/modal en celular y escritorio) antes de seguir con el siguiente.
- Al terminar cada PR, dejar un informe corto en `.devin/informes/` y actualizar los índices (`.devin/informes/README.md`, `.devin/README.md`).
