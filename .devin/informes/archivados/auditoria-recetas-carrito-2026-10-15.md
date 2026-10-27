# Auditoría — editor de promos, `POST /api/recetas` 400 y carrito de `/pedido`

Fecha: 2026-10-15. Disparador: 400 en `POST /api/recetas` en producción
(referer `/productos/314/editar`, deployment `dpl_82r5vwX7SKPcXwmxGwsX4WdKEzFE`),
botones "Quitar"/"Editar" poco visibles en el carrito público y sensación de que
editar opcionales/preseleccionados "no hace nada".

**Estado:** implementado (archivado 2026-10-27) — fix de código + normalización de filas legacy aplicada en producción (0 inválidas al auditar). Pendiente diferido: endpoint atómico producto+receta (P2), seguimiento en `../reporte-estado.md` §0.

## Causa raíz del 400 (confirmada contra la base)

Cuatro promos tienen `Vaso de gaseosa` (tipo `service`) persistida con
`is_optional=false` — herencia de la migración `0023_chubby_sersi.sql`, que creó
la columna con `DEFAULT false`. `recipeSchema` exige que manuales y servicios
sean siempre opcionales, así que cada guardado de la receta falla con 400.

Agravantes encontrados:

- El error se mostraba en un banner al tope de un formulario muy largo: desde el
  botón "Actualizar promo" no se veía → "no ocurre nada".
- El `PUT` del producto sí se persistía antes del 400 → estado parcial silencioso
  (nombre/precio/tope nuevos, receta vieja).
- El editor ofrecía un checkbox "Opcional" libre para insumos no críticos:
  destildarlo generaba un estado imposible de persistir.
- Filas que apuntan a insumos inactivos/eliminados o a otra promo también
  bloqueaban el guardado con errores genéricos sin indicar la fila.

## Cambios aplicados

### Editor de promos (`src/components/productos/promo-form.tsx`)

- Los flags dejaron de ser editables: `isOptional`, `autoDiscount` y
  `selectedByDefault` se **deriven del tipo del insumo** al cargar y al enviar
  (`critical_supply` → fijo/con descuento; manual/servicio → siempre opcional).
  Esto además sanea filas legacy inconsistentes al re-guardar.
- Para no críticos ya no hay checkbox "Opcional": se muestra el texto
  "Opcional: el cliente puede quitarlo al pedir" + el checkbox "Preseleccionado".
- Validaciones previas al submit con mensaje que nombra la fila:
  insumo inexistente/inactivo, promo como insumo, self-reference, duplicados,
  preseleccionados que exceden el tope.
- Errores por fila con `role="alert"` y `scrollIntoView` al banner general
  (el banner quedaba fuera de vista).
- El selector de insumos excluye `type='compound'` y la propia promo.
- Si el `PUT` del producto se guardó pero la receta falla, el mensaje lo dice
  explícitamente ("Los datos de la promo se guardaron, pero la receta no…")
  en lugar de sugerir que todo falló o todo se guardó.

### Servicio (`src/application/services/recipeService.ts`)

- Re-deriva los flags contra el tipo real del insumo: un cliente no puede
  mentir `supplyType` (el schema solo valida contra el tipo declarado en el
  payload). Ahora un crítico con `isOptional`/`selectedByDefault` o un no
  crítico con `isOptional=false`/`autoDiscount` son 400 explícitos.

### Carrito público (`src/components/pedido/cart-summary.tsx`)

- Cada línea muestra subtotal (`price × qty`) a la derecha del nombre, precio
  unitario debajo y una fila propia de controles: stepper (líneas no
  personalizables), `Editar` con icono `Pencil` y `Trash2` en
  `text-destructive` — mismo patrón que `sales-cart.tsx` del panel.
- Botón "Vaciar" en el header del `CartPanel` con `ConfirmDialog`
  (`pedido-cart-section`/`pedido-client` cablean `clearCart`, que ya existía).
- `ConfirmDialog` acepta `dataTheme` para que el diálogo portaleado herede el
  tema claro del layout público (`data-theme="light"`).

### Sincronización editor ↔ `/pedido`

- `useCart` al restaurar de `localStorage` intersecta `selectedRecipeItemIds`
  con los opcionales **vigentes** de la receta y aplica el tope actual: una
  línea guardada con opcionales que ya no existen ya no produce un 400 en el
  checkout.
- `PromoOptionsDialog` muestra "Incluye: …" con los insumos fijos (pan,
  salchichas, bebidas) para que el cliente vea qué trae la promo antes de
  agregarla, igual que el resumen del carrito.

### Script de normalización (`scripts/normalizar-recetas-opcionales.ts`)

- Dry-run por defecto, `--apply` escribe en una única transacción.
- Dry-run verificado: 4 filas a corregir (las 4 promos con `Vaso de gaseosa`
  `is_optional=false`); se normalizan a `is_optional=true` y
  `selected_by_default=true` para conservar el comportamiento visible previo
  (el insumo estaba incluido siempre).
- No toca snapshots históricas (`sale_item_recipes`/`order_item_recipes`)
  ni recetas válidas.

## Estado del fix en producción

El fix de código evita que se generen nuevas filas inválidas y que el usuario
no se entere del error. Las filas sucias existentes ya fueron normalizadas:

- **Desarrollo**: `npx tsx scripts/normalizar-recetas-opcionales.ts --apply`
  corrigió 4 filas (`Vaso de gaseosa` en Promo 1, Promo 2, Promo Amigos 1 y 2);
  el re-dry-run reporta 243 filas limpias.
- **Producción** (Neon `noisy-paper-53350862`, branch `main`): UPDATE en una
  transacción vía Neon MCP con la misma lógica del script — recetas 113, 129,
  187 y 203 → `is_optional=true`, `selected_by_default=true`,
  `auto_discount=false`. La auditoría posterior devuelve 0 filas inválidas.

## Verificación

- `jest` sobre `promo-form`, `useCart`, `route.ts` de recetas y
  `recipeService`: 63 tests OK (incluye nuevos casos de normalización legacy,
  fila inválida, promo-como-insumo, tope excedido, 400 con guardado parcial y
  selección obsoleta al restaurar).
- `tsc --noEmit` y `eslint` sobre los archivos tocados: limpio.
- Dry-run del script: reporta las 4 filas esperadas.

## Ideas descartadas

- Checkbox "Opcional" editable para no críticos: el dominio lo define como
  siempre opcional; ofrecerlo solo generaba payloads imposibles.
- `ConfirmDialog` al quitar la última unidad desde el stepper "−": fricción
  innecesaria; bajar a cero elimina directo, estándar en food-delivery.
- Endpoint atómico producto+receta (P2, pendiente): hoy son dos requests; el
  mensaje de fallo parcial mitiga la ventana. Unificar en una transacción queda
  como mejora futura.
