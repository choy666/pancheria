# Prompt: Edición de promos con insumos críticos

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja para una panchería.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui v4
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/README.md>

## Corroboración de viabilidad

Sí es posible implementar esta funcionalidad con el flujo actual del sistema:

- Los productos del tipo `critical_supply` con sus tipos (`bread`, `sausage`, `beverage`) ya se crean en el seed (`src/db/seeds.ts`) y se listan desde `/api/productos` (`src/app/api/productos/route.ts`) usando `productService.listActiveProducts()`.
- El endpoint `/api/recetas` (`src/app/api/recetas/route.ts`) acepta un array de ítems con `supplyId`, `quantity` y `autoDiscount`, y delega a `recipeService.saveRecipe()` (`src/application/services/recipeService.ts`).
- `saveRecipe()` elimina todos los ítems actuales de la receta e inserta los nuevos en una transacción, lo que permite agregar, modificar y eliminar ítems libremente.
- `recipeService.saveRecipe()` ya valida que:
  - al menos un ítem tenga `autoDiscount: true` y sea de tipo `critical_supply`,
  - no haya insumos duplicados,
  - el insumo exista y no esté eliminado,
  - `autoDiscount` solo se permita para insumos críticos.
- `saleService.calculateAvailability()` (`src/application/services/saleService.ts`) usa los ítems de la receta con `autoDiscount` para calcular cuántas unidades de la promo se pueden vender según el stock de cada insumo crítico.
- Por lo tanto, la capa de backend y la lógica de negocio ya soportan recetas con cualquier conjunto de insumos críticos. Lo que falta es adaptar el formulario de promo (`PromoForm`) para que el usuario pueda armar esa lista de insumos de forma explícita.

## Problema reportado

> Al editar una promo se deben poder **agregar, modificar y eliminar la cantidad de insumos críticos únicamente**, que serían las salchichas, panes y bebidas que ya fueron creados anteriormente con sus respectivos stocks. El flujo de edición de la promo debe mantenerse.

Actualmente, `PromoForm` (`src/components/productos/promo-form.tsx`) abstrae la receta en dos campos: "Cantidad de Super Panchos" (que genera automáticamente 1 pan y 2 salchichas por Super Pancho) y un checkbox opcional "Incluye bebida". Esto:

- no permite agregar más de una bebida,
- no permite agregar panes o salchichas adicionales de forma individual,
- no permite eliminar un insumo crítico de la receta,
- dificulta visualizar la receta real de la promo.

## Objetivo

Refactorizar la sección de recetas dentro de `PromoForm` para que el usuario vea y edite una **lista de insumos críticos**, donde cada fila contenga:

- un selector con los productos críticos disponibles (`critical_supply`),
- un campo de cantidad,
- un botón para eliminar la fila,
- y un botón para agregar más insumos críticos.

El flujo de guardado debe seguir siendo:

1. Guardar/actualizar el producto promo vía `/api/productos`.
2. Si es una promo nueva, obtener el `id` generado.
3. Enviar todos los ítems críticos vía `/api/recetas` con `autoDiscount: true`.

## Requisitos funcionales

1. **Selector de insumos críticos únicamente**: el selector solo debe mostrar productos activos (`isActive: true`, no eliminados) con `type === 'critical_supply'`. Debe distinguir si el insumo es Pan, Salchicha o Bebida usando `criticalSupplyType` y no hardcodear nombres de producto.
2. **Cantidad por insumo**: cada fila debe tener un input numérico entero, mínimo 1.
3. **Agregar**: un botón "Agregar insumo crítico" debe agregar una fila vacía (sin insumo seleccionado, cantidad 1).
4. **Modificar**: el usuario debe poder cambiar el insumo seleccionado y/o la cantidad de cualquier fila.
5. **Eliminar**: cada fila debe tener un botón "Quitar" para removerla de la receta.
6. **Validaciones frontend**:
   - La promo debe tener al menos un insumo crítico.
   - Todas las filas deben tener un insumo seleccionado.
   - Todas las cantidades deben ser enteros mayores o iguales a 1.
   - No puede haber insumos duplicados.
7. **Mapeo al guardar**: enviar `items` con el formato `{ supplyId, quantity, autoDiscount: true }` para cada fila.
8. **Carga inicial para edición**: si el producto promo ya tiene receta, se deben precargar las filas a partir de `GET /api/recetas?productId={id}`.
9. **Flujo de guardado**: se mantiene igual que ahora:
   - Si la promo es nueva, `POST /api/productos` para crearla, luego `POST /api/recetas`.
   - Si la promo existe, `PUT /api/productos/{id}` para actualizarla, luego `POST /api/recetas`.
10. **Actualizar la ayuda de la promo**: modificar `ProductHelpCard` (`src/components/productos/product-help-card.tsx`) para reflejar que ahora la promo se arma con una lista de insumos críticos y sus cantidades, eliminando la explicación de "Super Pancho" si se retira ese concepto.
11. **Solo insumos críticos**: no se deben permitir agregar insumos manuales ni servicios a la receta de una promo.

## Archivos y áreas a modificar

### Formulario de promo

- `src/components/productos/promo-form.tsx`
  - Reemplazar los estados y campos `superPanchos`, `includesBeverage`, `beverageProductId` y `beverageQuantity` por un arreglo `recipeItems: { supplyId: number; quantity: number }[]`.
  - Cargar los productos críticos desde `PRODUCTOS_API` (`src/config/api.ts`) y filtrar por `type === 'critical_supply'`.
  - Si se está editando, cargar la receta desde `RECETAS_API` e inicializar `recipeItems`.
  - Renderizar la lista de ítems con `Select`, `Input` y botón de eliminar.
  - Validar el arreglo antes de enviar.
  - Enviar `items` al `RECETAS_API` usando `autoDiscount: true`.
  - Mantener el guardado del producto (nombre, precio, activo) exactamente como está.

### Componente de ayuda

- `src/components/productos/product-help-card.tsx`
  - Actualizar el texto de la variante `promo` si se retira el concepto de Super Pancho.

### Tipos y mapeos

- `src/domain/types.ts`
  - `ProductType = 'critical_supply' | 'compound' | 'manual_supply' | 'service'`
  - `CriticalSupplyType = 'bread' | 'sausage' | 'beverage'`
- Si es necesario, definir un mapeo local de `criticalSupplyType` a etiquetas (Pan, Salchicha, Bebida) o reutilizar uno existente. No hardcodear nombres de productos concretos.

### Backend (conocimiento, no modificación obligatoria)

- `src/application/services/recipeService.ts` ya soporta el guardado de recetas con múltiples insumos críticos.
- `src/lib/zod-schemas.ts` (`recipeSchema` y `recipeItemSchema`) ya validan el formato.
- `src/app/api/recetas/route.ts` expone `GET` y `POST`.
- `src/app/api/productos/route.ts` expone `GET` para listar productos activos.

## Implementación detallada sugerida

### 1. Estado del formulario

Simplificar `PromoFormData` a:

```ts
interface PromoFormData {
  name: string;
  price: number;
  isActive: boolean;
}

interface PromoRecipeItem {
  supplyId: number;
  quantity: number;
}
```

```ts
const [form, setForm] = useState<PromoFormData>({
  name: '',
  price: 0,
  isActive: true,
});

const [recipeItems, setRecipeItems] = useState<PromoRecipeItem[]>([]);
const [criticalSupplies, setCriticalSupplies] = useState<ProductRow[]>([]);
```

### 2. Carga de insumos críticos

Al montar el componente:

```ts
const all = (await (await fetch(PRODUCTOS_API)).json()) as ProductRow[];
const critical = all.filter((p) => p.type === 'critical_supply');
setCriticalSupplies(critical);
```

### 3. Carga de receta existente

Si se está editando (`product` está definido):

```ts
const recipeRes = await fetch(`${RECETAS_API}?productId=${product.id}`);
if (recipeRes.ok) {
  const recipe = await recipeRes.json();
  setRecipeItems(recipe.map((r: RecipeItem) => ({
    supplyId: r.supplyId,
    quantity: r.quantity,
  })));
}
```

### 4. Funciones de la lista

```ts
function addRecipeItem() {
  setRecipeItems([...recipeItems, { supplyId: 0, quantity: 1 }]);
}

function removeRecipeItem(index: number) {
  setRecipeItems(recipeItems.filter((_, i) => i !== index));
}

function updateRecipeItem(index: number, updates: Partial<PromoRecipeItem>) {
  const next = [...recipeItems];
  next[index] = { ...next[index], ...updates };
  setRecipeItems(next);
}
```

### 5. Validación antes de enviar

Reemplazar las validaciones de `superPanchos` y bebida por:

```ts
if (recipeItems.length === 0) {
  setError('La promo debe tener al menos un insumo crítico.');
  return;
}

if (recipeItems.some((item) => !item.supplyId)) {
  setError('Todos los ítems deben tener un insumo seleccionado.');
  return;
}

if (recipeItems.some((item) => item.quantity < 1)) {
  setError('Las cantidades deben ser al menos 1.');
  return;
}

const uniqueIds = new Set(recipeItems.map((item) => item.supplyId));
if (uniqueIds.size !== recipeItems.length) {
  setError('No puede haber insumos críticos duplicados.');
  return;
}
```

### 6. Envío de la receta

Una vez obtenido o confirmado `productId`:

```ts
const recipeRes = await fetch(RECETAS_API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    compoundProductId: productId,
    items: recipeItems.map((item) => ({
      supplyId: item.supplyId,
      quantity: item.quantity,
      autoDiscount: true,
    })),
  }),
});
```

### 7. Renderizado de filas

Cada fila puede tener una estructura similar a `src/components/productos/recipe-editor.tsx`, pero:

- el selector de insumos debe estar limitado a `criticalSupplies`,
- cada opción debe mostrar `nombre (unidad) — Pan|Salchicha|Bebida`,
- el campo de cantidad debe ser un `Input` tipo `number`,
- incluir un botón `Quitar`,
- no es necesario mostrar el checkbox de `autoDiscount` porque todos los ítems críticos usarán `true`.

## Checklist de implementación

### Formulario de promo

- [ ] Simplificar `PromoFormData` y agregar `recipeItems`.
- [ ] Cargar todos los productos críticos activos desde `PRODUCTOS_API`.
- [ ] Cargar la receta existente desde `RECETAS_API` en modo edición.
- [ ] Renderizar la lista de insumos críticos con `Select`, `Input` y botón `Quitar`.
- [ ] Implementar botón `Agregar insumo crítico`.
- [ ] Validar que haya al menos un ítem, sin duplicados, con cantidad >= 1.
- [ ] Mantener el envío del producto (`POST` o `PUT` a `/api/productos`).
- [ ] Enviar la receta al `RECETAS_API` con `autoDiscount: true` para todos los ítems.
- [ ] Eliminar o reemplazar los campos `superPanchos`, `includesBeverage`, `beverageProductId` y `beverageQuantity`.
- [ ] Actualizar el resumen de stock para que itere los ítems críticos y muestre las cantidades reales.

### Ayuda y textos

- [ ] Actualizar `ProductHelpCard` variante `promo` para reflejar el nuevo comportamiento.
- [ ] No hardcodear nombres de productos; usar `name`, `unit` y `criticalSupplyType` de la base de datos.

### Tests y verificación

- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npm test`.
- [ ] Actualizar `tests/e2e/productos-y-recetas.spec.ts` si el test de creación de promo por UI depende de los campos `superPanchos` o `includesBeverage`.
- [ ] Ejecutar `npx playwright test tests/e2e/productos-y-recetas.spec.ts` en una base de datos de prueba (recordar la advertencia de `AGENTS.md`: `global-setup.ts` trunca tablas y re-seedea).
- [ ] Verificar visualmente en `http://localhost:3000/productos/nuevo?tab=promo` y en la edición de una promo existente que se pueda agregar, modificar y eliminar insumos críticos.

### Reglas del proyecto

- [ ] No hardcodear URLs de API; usar `PRODUCTOS_API` y `RECETAS_API` de `src/config/api.ts`.
- [ ] No hardcodear IDs ni nombres de productos.
- [ ] Mantener los mensajes de error en español.
- [ ] Seguir el estilo visual existente (tarjetas oscuras, bordes `border-white/8`, componentes de shadcn/ui).
- [ ] No agregar comentarios innecesarios.

## Notas

- El cálculo de cuántas unidades de promo se pueden vender sigue siendo responsabilidad de `saleService.calculateAvailability()`; con `autoDiscount: true` en todos los ítems críticos, seguirá usando el insumo con menor disponibilidad como cuello de botella.
- Si más adelante se desea permitir insumos no críticos en una receta, se deberá revisar `recipeService.saveRecipe()` y `saleService.calculateAvailability()`. Para este prompt, el alcance se limita a insumos críticos.
- La validación de duplicados y de insumos críticos también ocurre en el backend; el frontend debe replicarla para dar feedback inmediato.
