# Prompt: Implementar mejoras en productos — unidad editable, stock en promos y vaciado de papelera

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

## Estado actual relevante

- El formulario `ProductForm` asigna automáticamente la unidad según el tipo y no permite editarla <ref_snippet file="C:/developer/paginas/pancheria/src/components/productos/product-form.tsx" lines="27-35" />.
- Los `manual_supply` no descuentan stock automáticamente; el operador los ajusta manualmente desde `/stock` <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="222-225" />.
- La papelera de productos (`/productos/eliminados`) permite eliminar de a uno, pero no tiene acción masiva <ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/productos/eliminados/page.tsx" lines="27-91" />.
- El `PromoForm` muestra el resumen de descuentos de receta, pero no el stock actual de los insumos seleccionados <ref_snippet file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" lines="602-662" />.

## Objetivo

1. Permitir editar la unidad de medida (`unit`) en el formulario de creación/edición de productos.
2. Mostrar el stock actual de los insumos seleccionados en el formulario de promos, preferentemente al final del resumen de stock.
3. Agregar un botón “Vaciar papelera” masivo en `/productos/eliminados`, con validaciones de referencias históricas.
4. Reutilizar código existente, evitar duplicaciones y no introducir inconsistencias ni errores lógicos.

## Reglas de negocio

1. `manual_supply` no puede tener precio (`price = 0`).
2. `critical_supply` debe tener un `criticalSupplyType` (`bread`, `sausage`, `beverage`).
3. La unidad es un `varchar(50)` libre; debe ser editable para permitir `porción`, `envase`, `litro`, `kg`, etc.
4. Los insumos críticos con `autoDiscount` determinan la disponibilidad de una promo; los manuales y servicios no afectan disponibilidad.
5. No se puede hard-deletear un producto con referencias históricas (`sale_items`, `order_items`, `stock_movements`, `recipes`, etc.).
6. El vaciado masivo debe omitir productos con referencias, reportarlos y continuar con el resto.

## Implementación detallada

### 1. Unidad editable en productos

- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-form.tsx" />
  - Agregar un campo `Input` para `unit` editable.
  - Mantener `defaultUnit(type, criticalSupplyType)` como sugerencia inicial, pero permitir edición.
  - No sobrescribir manualmente la unidad cuando el usuario ya la cambió, salvo que cambie a un tipo incompatible y se requiera reasignar.
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-help-card.tsx" />
  - Actualizar el texto para reflejar que la unidad es editable y dar ejemplos (`porción`, `envase`, `litro`).
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
  - Validar `unit` con `z.string().min(1).max(50)` (ya está; confirmar).

### 2. Stock de insumos en `PromoForm`

- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" />
  - Asegurar que el `PRODUCTOS_API` devuelva `stock` y que `supplies` lo conserve. Extender el tipo `Supply` o crear `SupplyWithStock`.
  - Al final del card “Resumen de stock” (o en un card nuevo inmediatamente posterior), mostrar:
    - Lista de insumos seleccionados con su `stock` actual y `unit`.
    - Cantidad que consume la promo (`quantity`).
    - Disponibilidad estimada de la promo: cuántas unidades se pueden armar con el stock crítico.
  - **Reutilizar** `calculateCompoundAvailability` de <ref_file file="C:/developer/paginas/pancheria/src/application/services/summaryService.ts" />. Construir un adaptador desde `recipeItems` y `supplies`, con `autoDiscount = supply.type === 'critical_supply'` y `supply.stock`.
  - No mostrar disponibilidad de manuales/servicios como limitantes (son opcionales y no afectan stock automático).
- <ref_file file="C:/developer/paginas/pancheria/src/components/productos/supply-searchable-select.tsx" />
  - Extender la interfaz `Supply` para incluir `stock?: number` si se decide conservar stock allí, o crear un tipo separado en `promo-form.tsx` para no modificar el select.

### 3. Vaciado masivo de papelera

- <ref_file file="C:/developer/paginas/pancheria/src/repositories/productRepository.ts" />
  - Agregar `findDeletedInRange(branchId, start, end, pagination?)`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />
  - Agregar `emptyTrash(branchId, start, end)`.
  - Iterar productos eliminados en rango e intentar `permanentlyDeleteProduct` por cada uno.
  - Capturar `ValidationError` de referencias, omitir ese producto y continuar.
  - Retornar `{ deleted: number, skipped: Array<{ id, name }> }`.
- <ref_file file="C:/developer/paginas/pancheria/src/config/api.ts" />
  - Agregar `PRODUCTOS_ELIMINADAS_API`.
- Crear `src/app/api/productos/eliminadas/route.ts`
  - `GET`: listar productos eliminados en rango.
  - `DELETE`: requerir `admin`, normalizar fechas con `startOfDayUTC`/`endOfDayUTC`, llamar `productService.emptyTrash`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/productos/eliminados/page.tsx" />
  - Agregar componente cliente (o extender) con botón “Vaciar papelera”, confirmación y rango de fechas.
  - Mostrar resultado: cuántos eliminó y cuáles omitió por tener historial.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs ni secretos.
- Las rutas API y server actions deben requerir rol `admin`.
- El hard delete masivo debe respetar el aislamiento por `branchId`.
- No exponer `.env.local` ni secretos.
- `npm run test:e2e` y `npx tsx src/db/seeds.ts` solo con confirmación explícita y en base de prueba.

## Tests

- Tests unitarios y de componente para `ProductForm` (crear/editar producto con unidad `porción`).
- Tests para `PromoForm`: mostrar stock de insumos y disponibilidad estimada.
- `productService.test.ts`: `emptyTrash` elimina productos sin referencias y omite los que tienen historial.
- Crear `src/app/api/productos/eliminadas/route.test.ts` para `GET` y `DELETE` con rango.
- E2E: flujo de papelera masiva y edición de promo con stock visible.

## Verificaciones

| Comando | Propósito |
|---|---|
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto |
| `npm run test:e2e` | Tests E2E en base de prueba |
