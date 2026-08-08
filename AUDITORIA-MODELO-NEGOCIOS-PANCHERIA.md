# Auditoría del modelo de negocio — Panchería

## 1. Resumen ejecutivo

El dominio actual (`critical_supply`, `compound`, `manual_supply`) cubre gran parte del modelo de negocio: permite representar insumos, bebidas y promos con descuento automático de stock. Sin embargo, **existen dos bloqueos principales** que impiden que el modelo de negocio compartido funcione hoy:

1. **No existe un tipo de producto vendible que no descuente stock** (`service`/`extra`). Esto impide vender "Agregado de toppings" y "Vaso de gaseosa" como pide el modelo.
2. **No se modelan las presentaciones de bebida** que aparecen en las promos (Pritty 500cc, Doble Cola 2,25L, Juguito Tutti 200cc). La lista de insumos solo tiene nombres genéricos.

Además, el `seeds.ts` actual contiene datos de ejemplo que no representan el catálogo real y la terminal de ventas no está preparada para una cantidad grande de productos.

La recomendación prioritaria es:

1. Agregar el tipo `service` al schema, servicios, validaciones y UI.
2. Definir las bebidas con sus presentaciones exactas.
3. Reescribir el seed con el catálogo real.
4. Modelar cada promo como `compound` con su receta exacta.

Con esos cambios el sistema es suficiente para operar el modelo de negocio y escalable a futuro.

---

## 2. Mapeo de productos / insumos

A continuación el inventario recomendado con el tipo, subtipo crítico, unidad y stock inicial sugerido.

| # | Producto | Tipo | `criticalSupplyType` | Unidad | Stock inicial |
| -: | ---------------- | ---------------- | -------------------- | -------------- | ----: |
| 1 | Pan | `critical_supply` | `bread` | unidad | 32 |
| 2 | Salchichas | `critical_supply` | `sausage` | unidad | 10 |
| 3 | Gas | `manual_supply` | — | unidad | 2 |
| 4 | Caja chica | `manual_supply` | — | caja | 4 |
| 5 | Porta super | `manual_supply` | — | unidad | 2 |
| 6 | Sorbetes | `manual_supply` | — | unidad | 4 |
| 7 | Folex | `manual_supply` | — | rollo | 4 |
| 8 | Bolsas camisetas | `manual_supply` | — | paquete | 4 |
| 9 | Mayonesa | `manual_supply` | — | envase | 0 |
| 10 | Ketchup | `manual_supply` | — | envase | 2 |
| 11 | Mostaza | `manual_supply` | — | envase | 5 |
| 12 | Salsa golf | `manual_supply` | — | envase | 1 |
| 13 | Cheddar | `manual_supply` | — | porción | 2 |
| 14 | Parmesano | `manual_supply` | — | porción | 7 |
| 15 | Fugazeta | `manual_supply` | — | porción | 3 |
| 16 | Aceituna | `manual_supply` | — | porción | 1 |
| 17 | Salame | `manual_supply` | — | porción | 6 |
| 18 | Roquefort | `manual_supply` | — | porción | 2 |
| 19 | Barbacoa | `manual_supply` | — | envase | 6 |
| 20 | Chimichurri | `manual_supply` | — | envase | 3 |
| 21 | Picante | `manual_supply` | — | envase | 2 |
| 22 | Choclo grano | `manual_supply` | — | porción | 7 |
| 23 | Choclo crema | `manual_supply` | — | porción | 0 |
| 24 | Choclo arveja | `manual_supply` | — | porción | 0 |
| 25 | Huevos | `manual_supply` | — | unidad | 4 |
| 26 | Tomates | `manual_supply` | — | unidad | 4 |
| 27 | Morrones | `manual_supply` | — | unidad | 2 |
| 28 | Cebollas | `manual_supply` | — | unidad | 2 |
| 29 | Provenzal | `manual_supply` | — | porción | 4 |
| 30 | Ajo | `manual_supply` | — | unidad | 4 |
| 31 | Papas pay | `manual_supply` | — | porción | 0 |
| 32 | Coca de 1L | `critical_supply` | `beverage` | botella | 10 |
| 33 | Coca de 1,5L | `critical_supply` | `beverage` | botella | 8 |
| 34 | Coca de 350cc | `critical_supply` | `beverage` | botella | 0 |
| 35 | Pritty 500cc | `critical_supply` | `beverage` | botella | 0 |
| 36 | Doble Cola 2,25L | `critical_supply` | `beverage` | botella | 0 |
| 37 | Juguito Tutti 200cc | `critical_supply` | `beverage` | botella | 0 |
| 38 | Cerveza grande | `critical_supply` | `beverage` | botella | 0 |
| 39 | Cerveza chica | `critical_supply` | `beverage` | botella | 4 |
| 40 | Rollo de cocina | `manual_supply` | — | rollo | 7 |
| 41 | Aceite | `manual_supply` | — | litro | 4 |
| 42 | Vinagre | `manual_supply` | — | litro | 4 |
| 43 | Detergente | `manual_supply` | — | litro | 3 |
| 44 | Lavandina | `manual_supply` | — | litro | 2 |
| 45 | Líquido piso | `manual_supply` | — | litro | 0 |
| 46 | Sal gruesa | `manual_supply` | — | kg | 4 |
| 47 | Vasos | `manual_supply` | — | unidad | 9 |
| 48 | Cinta | `manual_supply` | — | unidad | 4 |
| 49 | Tartarina | `manual_supply` | — | unidad | 11 |
| 50 | Caldo | `manual_supply` | — | unidad | 2 |

**Nota importante:** la fuente original mencionaba "Pritty", "Doble cola" y "Jugos Tutti" sin presentación. Para que las promos funcionen correctamente se proponen los productos específicos `Pritty 500cc`, `Doble Cola 2,25L` y `Juguito Tutti 200cc`.

---

## 3. Catálogo de promos / combos

Cada promo se modela como un producto `compound` con precio fijo y una receta. La disponibilidad se calcula sobre el mínimo de unidades disponibles de los insumos con `autoDiscount = true`.

En el modelo, los aderezos/salsas no descontarán stock, por lo que no es necesario incluirlos en la receta para calcular disponibilidad. Si en el futuro se quiere trazarlos, se pueden agregar como `manual_supply` con `autoDiscount = false`.

| Promo | Descripción | Precio | Receta (`autoDiscount = true`) |
| ----- | ----------- | ------: | ------------------------------ |
| Promo 1 | Super Pancho + 5 aderezos | $1.000 | Pan: 1, Salchichas: 2 |
| Promo 2 | Super Pancho + 5 aderezos + vaso de gaseosa | $1.500 | Pan: 1, Salchichas: 2 |
| Promo 3 | Super Pancho completo (aderezos y salsas) + vaso de gaseosa | $2.000 | Pan: 1, Salchichas: 2 |
| Promo Amigos 1 | 2 Super Panchos + aderezos + 2 vasos de gaseosa | $2.500 | Pan: 2, Salchichas: 4 |
| Promo Amigos 2 | 2 Super Panchos completos + 2 vasos de gaseosa | $3.500 | Pan: 2, Salchichas: 4 |
| Promo Pritty 1 | Super Pancho + aderezos + Pritty 500cc | $2.000 | Pan: 1, Salchichas: 2, Pritty 500cc: 1 |
| Promo Pritty 2 | Super Pancho completo + Pritty 500cc | $2.500 | Pan: 1, Salchichas: 2, Pritty 500cc: 1 |
| Promo Popular | 5 Super Panchos completos + Doble Cola 2,25L | $10.000 | Pan: 5, Salchichas: 10, Doble Cola 2,25L: 1 |
| Promo Familiar | 9 Super Panchos + aderezos + Doble Cola 2,25L | $11.000 | Pan: 9, Salchichas: 18, Doble Cola 2,25L: 1 |
| Promo Familiar 2 | 9 Super Panchos completos + Doble Cola 2,25L | $16.000 | Pan: 9, Salchichas: 18, Doble Cola 2,25L: 1 |
| Promo Kids | Super Pancho completo + Juguito Tutti 200cc | $2.000 | Pan: 1, Salchichas: 2, Juguito Tutti 200cc: 1 |

**Observaciones:**

- "Vaso de gaseosa" no descontaría stock, por eso no aparece en las recetas de las promos 2 y 3.
- La Promo 1 y la Promo 2 tienen el mismo descuento de stock (solo pan y salchicha). La diferencia es el precio y la inclusión del vaso de gaseosa como servicio.
- "5 aderezos" y "completo" son conceptos de producto/servicio no trazados en stock. Si se desea trazabilidad, se debe agregar un mecanismo de aderezos variables en el futuro.

---

## 4. Extras y bebidas

### 4.1 Extras que no descontarán stock

| Item | Descripción | Precio | Tipo propuesto |
| ---- | ----------- | ------: | -------------- |
| Extras o agregados | Agregado de toppings | $200 c/u | `service` (nuevo tipo) |
| Vaso de gaseosa | Vaso de gaseosa sola | $500 | `service` (nuevo tipo) |

**Razón:** el dominio actual no permite vender productos que no desconten stock. `manual_supply` no se vende en la terminal, `compound` exige al menos un insumo crítico con `autoDiscount = true`, y `critical_supply` siempre descuenta stock. El tipo `service` cubre exactamente este caso.

### 4.2 Bebidas que sí descontarán stock

Las bebidas son `critical_supply` con `criticalSupplyType = 'beverage'`. Se venden individualmente y se descuenta stock propio. También pueden formar parte de una receta de promo.

| Bebida | Presentación | Tipo |
| ------ | ------------ | ---- |
| Coca de 1L | 1 litro | `critical_supply` / `beverage` |
| Coca de 1,5L | 1,5 litros | `critical_supply` / `beverage` |
| Coca de 350cc | 350 cc | `critical_supply` / `beverage` |
| Pritty 500cc | 500 cc | `critical_supply` / `beverage` |
| Doble Cola 2,25L | 2,25 litros | `critical_supply` / `beverage` |
| Juguito Tutti 200cc | 200 cc | `critical_supply` / `beverage` |
| Cerveza grande | grande | `critical_supply` / `beverage` |
| Cerveza chica | chica | `critical_supply` / `beverage` |

---

## 5. Cambios técnicos propuestos

### 5.1 Schema (`src/db/schema.ts`)

Agregar el tipo `service` al enum de productos:

```typescript
export const productTypeEnum = pgEnum('product_type', [
  'critical_supply',
  'compound',
  'manual_supply',
  'service',
]);
```

**Migración SQL asociada:**

```sql
ALTER TYPE product_type ADD VALUE 'service';
```

### 5.2 Tipos de dominio (`src/domain/types.ts`)

```typescript
export type ProductType = 'critical_supply' | 'compound' | 'manual_supply' | 'service';
```

### 5.3 Esquemas Zod (`src/lib/zod-schemas.ts`)

```typescript
export const productTypeSchema = z.enum([
  'critical_supply',
  'compound',
  'manual_supply',
  'service',
]);
```

### 5.4 `productService.ts`

- Aceptar `service` sin `criticalSupplyType`.
- Permitir cambiar desde/hacia `service` respetando la integridad de recetas.

### 5.5 `recipeService.ts`

- No requerir receta para productos de tipo `service`.
- Mantener la validación actual para `compound`.

### 5.6 `saleService.ts`

- `calculateAvailability`:
  - `service`: retornar un valor alto o `Infinity` (no limitado por stock).
  - `compound`: mantener cálculo actual.
  - `critical_supply` / `beverage`: mantener `stock`.
- `confirmSale`:
  - Permitir vender `service` sin verificar stock ni generar movimiento de stock.
  - Mantener descuento de `compound` y bebidas.
- `cancelSale`:
  - Para `service`, no reintegrar stock.
- `updateCashRegisterSummary`: sumar `service` a `productsSummary`.

### 5.7 `sales-terminal.tsx`

- Filtro de productos vendibles:

```typescript
const sellable = allProducts.filter(
  (p) =>
    p.type === 'compound' ||
    p.type === 'service' ||
    p.criticalSupplyType === 'beverage'
);
```

- Para productos `service`, mostrar disponibilidad como ilimitada o "sin límite".
- Agrupar productos: Promos / Bebidas / Extras.

### 5.8 `product-form.tsx`

- Agregar opción "Servicio / extra" al selector de tipo.
- Cuando el tipo es `service`, ocultar o deshabilitar los campos de stock / mínimo.

### 5.9 `stock-list.tsx`

- Opcionalmente excluir productos de tipo `service` del listado de stock, o marcarlos como "no aplica".

### 5.10 `seeds.ts`

Reescribir el seed para cargar el catálogo completo:

1. Insumos base (Pan, Salchichas, aderezos, salsas, insumos de limpieza, etc.).
2. Bebidas con presentaciones.
3. Extras como `service`.
4. Promos como `compound` con sus recetas.

Ejemplo de estructura del seed:

```typescript
const supplies = [
  { name: 'Pan', type: 'critical_supply', criticalSupplyType: 'bread', unit: 'unidad', stock: 32, minStock: 5, price: 0 },
  { name: 'Salchichas', type: 'critical_supply', criticalSupplyType: 'sausage', unit: 'unidad', stock: 10, minStock: 5, price: 0 },
  // ... resto de insumos
];

const beverages = [
  { name: 'Pritty 500cc', type: 'critical_supply', criticalSupplyType: 'beverage', unit: 'botella', stock: 0, minStock: 2, price: 0 },
  // ...
];

const services = [
  { name: 'Agregado de toppings', type: 'service', unit: 'unidad', stock: 0, minStock: 0, price: 200 },
  { name: 'Vaso de gaseosa', type: 'service', unit: 'unidad', stock: 0, minStock: 0, price: 500 },
];

const promos = [
  { name: 'Promo 1', type: 'compound', unit: 'unidad', stock: 0, minStock: 0, price: 1000, recipe: [
    { supplyName: 'Pan', quantity: 1, autoDiscount: true },
    { supplyName: 'Salchichas', quantity: 2, autoDiscount: true },
  ]},
  // ...
];
```

### 5.11 Tests

- `productService.test.ts`: crear y actualizar productos `service`.
- `recipeService.test.ts`: `service` no requiere receta; recetas con `manual_supply` y `autoDiscount = false`.
- `saleService.test.ts`:
  - venta de `service`;
  - venta de combo con bebida;
  - disponibilidad compartida de insumos entre promos;
  - cancelación con reintegro correcto.
- Considerar tests E2E con Playwright para el flujo completo de apertura de caja, venta de promo y cierre.

---

## 6. Plan de implementación priorizado

Ordenado por impacto en el negocio y esfuerzo técnico.

| # | Tarea | Prioridad | Esfuerzo | Impacto | Razón |
| -: | ----- | --------- | -------- | ------- | ----- |
| 1 | Agregar tipo `service` al schema, domain, Zod y enums | Crítica | Medio | Alto | Sin esto no se pueden vender extras como "Agregado de toppings" ni "Vaso de gaseosa". |
| 2 | Adaptar `saleService` para vender `service` sin stock | Crítica | Medio | Alto | Necesario para que los extras generen ventas y resumen de caja. |
| 3 | Actualizar `sales-terminal` para mostrar y vender `service` | Crítica | Medio | Alto | Es el punto de venta; sin esto el operador no puede cobrar extras. |
| 4 | Definir bebidas con presentaciones exactas (Pritty 500cc, Doble Cola 2,25L, Juguito Tutti 200cc) | Crítica | Bajo | Alto | Las promos con bebida no pueden armarse correctamente sin las presentaciones. |
| 5 | Reescribir `seeds.ts` con el catálogo real | Crítica | Medio-Alto | Alto | Permite arrancar el sistema con datos limpios y consistentes. |
| 6 | Modelar las 11 promos como `compound` con recetas exactas | Alta | Medio | Alto | Es el núcleo del modelo de ventas. |
| 7 | Agregar y actualizar tests unitarios para `service`, combos con bebidas y cancelaciones | Alta | Medio | Medio-Alto | Garantiza que el dominio no se rompa con el nuevo tipo y los combos. |
| 8 | Validar `recipe-editor` permita `manual_supply` con `autoDiscount = false` | Media | Bajo | Medio | Permite trazar aderezos en promos sin descuentar stock. |
| 9 | Mejorar `sales-terminal`: agrupar promos, bebidas y extras; buscador; indicadores de stock | Media | Medio | Medio | Con 20+ productos la usabilidad decae rápidamente. |
| 10 | Mejorar `product-form` y `recipe-editor` para flujo rápido de alta | Media | Medio | Medio | Reduce el tiempo de carga inicial y mantenimiento. |
| 11 | Diseñar modelo de variantes/opciones para combos variables | Futura | Alto | Alto | Prepara el terreno para elegir bebida/tamaño dentro de una promo. |

---

## 7. Riesgos y gaps detectados

| # | Riesgo / Gap | Severidad | Detalle |
| -: | ------------ | --------- | ------- |
| 1 | No se pueden vender extras sin descuento de stock | Crítica | El dominio actual no tiene tipo `service`. `manual_supply` no es vendible y `compound` exige receta con crítico. |
| 2 | Bebidas en promos no tienen presentación definida | Crítica | Las promos hablan de Pritty 500cc, Doble Cola 2,25L y Juguito Tutti 200cc, pero el catálogo de insumos no las define. |
| 3 | `sales-terminal` no agrupa ni busca productos | Media | Con muchas promos y bebidas la pantalla será difícil de usar. |
| 4 | `stock-list` marca stock bajo con `stock <= minStock` | Media | Un producto agotado con `minStock = 0` aparece como "OK" (0 <= 0 es `true`). Debería distinguir `stock === 0`. |
| 5 | El enum `product_type` es rígido | Media | Cualquier nuevo tipo requiere migración de base de datos. |
| 6 | `recipeService` exige al menos un `critical_supply` con `autoDiscount = true` | Baja-Media | Correcto para promos actuales, pero impide combos que solo sean "kits" de insumos manuales. |
| 7 | `seeds.ts` actual tiene datos de ejemplo no representativos | Media | Si se ejecuta en una base limpia, carga un catálogo distinto al modelo de negocio. |
| 8 | No hay mecanismo para combos variables | Baja | Hoy no se puede elegir bebida/tamaño dentro de una promo; se requiere un producto por presentación. |

---

## 8. Consejos de escalabilidad

1. **Categorías de producto:** agregar una columna/category opcional para agrupar en la terminal (Promos, Bebidas, Extras, Insumos). No requiere cambios en el cálculo de stock.
2. **Presentaciones con variantes:** si la cantidad de bebidas crece, considerar una tabla `product_variants` que apunte a un producto padre y tenga su propio stock. Esto evita duplicar lógica de recetas.
3. **Combos variables:** evaluar agregar `product_options` con reglas de stock (por ejemplo, "elegir bebida: Pritty 500cc o Coca 350cc"). Requiere rediseño parcial de `recipes`/`saleService`.
4. **Precios de insumos:** el `price` de un `critical_supply` o `manual_supply` puede quedar en 0 si no se venden solos. Mantener `price` solo en productos vendibles (`compound`, `service`, `beverage`).
5. **Historial de stock:** `stockMovements` ya registra todo movimiento. Asegurar que los `service` no generen movimientos falsos.
6. **Soft delete:** `products` tiene `deletedAt`, lo cual es correcto. Revisar que los productos eliminados no aparezcan en recetas activas ni en disponibilidad.

---

## 9. Conclusión

El sistema tiene una base sólida para insumos críticos, bebidas, promos con descuento automático y control de stock. Los dos cambios imprescindibles para que el modelo de negocio opere son **agregar el tipo `service`** y **definir las presentaciones de bebida**. Con esos ajustes, las 11 promos, los extras y las bebidas individuales pueden crearse, venderse y controlarse correctamente.

Una vez resueltos los bloqueos, la siguiente prioridad es la **experiencia de usuario en la terminal de ventas** (agrupación, búsqueda, indicadores) y un **seed realista** que permita arrancar el sistema de forma limpia.
