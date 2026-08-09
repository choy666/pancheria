# Prompt: Ordenar la tabla de productos y promos por prioridad de tipo

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

- <file:///C%3A/developer/paginas/pancheria/.devin/informes/auditoria-conexion-db.md>
- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/README.md>

## Problema reportado

> La tabla "Productos y promos" en `http://localhost:3000/productos` debe mostrar sus filas ordenadas por tipo de producto con la siguiente prioridad:
> 1. Promo (`compound`)
> 2. Insumo crítico (`critical_supply`)
> 3. Insumo manual (`manual_supply`)
> 4. Servicio / extra (`service`)
>
> El motivo es que el stock no es relevante para los servicios / extras, por lo que deben aparecer al final. Dentro de cada grupo, se debe mantener el orden alfabético por nombre para facilitar la búsqueda visual.

## Objetivos

1. Modificar la página `src/app/(panel)/productos/page.tsx` para que las filas de la tabla se ordenen según la prioridad de tipo especificada.
2. Mantener el orden alfabético por nombre dentro de cada categoría de tipo.
3. No alterar el comportamiento de otros consumidores de `productService.listProducts` (por ejemplo, terminal de ventas o endpoints de disponibilidad) a menos que se indique explícitamente.
4. Respetar las reglas del proyecto: no hardcodear credenciales, seguir convenciones de estilo y no agregar comentarios innecesarios.
5. Verificar que `npm run lint`, `npm run build` y `npm test` continúen pasando.

## Archivos y áreas a modificar

### Página de productos

- `src/app/(panel)/productos/page.tsx`
  - Actualmente obtiene la lista con `productService.listProducts()` y la itera directamente.
  - Se debe ordenar el array de productos antes de renderizar la tabla.

### Tipos del dominio

- `src/domain/types.ts`
  - `ProductType = 'critical_supply' | 'compound' | 'manual_supply' | 'service'`
  - El orden de prioridad es: `compound` → `critical_supply` → `manual_supply` → `service`.

### Repositorio (conocimiento, no modificación obligatoria)

- `src/repositories/productRepository.ts`
  - `findAll` ordena por `products.name` ascendente.
  - Si se opta por cambiar el orden a nivel de base de datos, se debe evaluar el impacto en `listActiveProducts` y `listActiveProductsWithAvailability`, que se usan en ventas y disponibilidad.

## Criterios de ordenamiento

Definir un mapa de prioridad de tipos:

```ts
const typePriority: Record<ProductType, number> = {
  compound: 1,        // Promo
  critical_supply: 2, // Insumo crítico
  manual_supply: 3,   // Insumo manual
  service: 4,         // Servicio / extra
};
```

Ordenar con:

```ts
[...products].sort((a, b) => {
  const priorityDiff = typePriority[a.type] - typePriority[b.type];
  if (priorityDiff !== 0) return priorityDiff;
  return a.name.localeCompare(b.name);
});
```

## Checklist de implementación

### 1. Orden en la tabla

- [ ] Definir `typePriority` en `src/app/(panel)/productos/page.tsx` usando el tipo `ProductType` si es posible.
- [ ] Aplicar el ordenamiento antes de calcular disponibilidad o renderizar la tabla.
- [ ] Asegurarse de no mutar el array original devuelto por `productService.listProducts()`.

### 2. Consistencia de la UI

- [ ] Los badges de tipo (`Promo`, `Insumo crítico`, `Insumo manual`, `Servicio / extra`) deben seguir mostrándose correctamente.
- [ ] Las columnas de stock, precio, vendible y acciones deben conservar su contenido y comportamiento.
- [ ] Los productos inactivos deben seguir apareciendo en la tabla si así lo hacían antes.

### 3. Tests y verificación

- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npm test`.
- [ ] Ejecutar `npx playwright test tests/e2e/productos-y-recetas.spec.ts` en una base de datos de prueba (ver advertencia en `AGENTS.md`: `tests/e2e/global-setup.ts` trunca tablas y re-seedea).
- [ ] Verificar visualmente en `http://localhost:3000/productos` que el orden sea: promos primero, luego insumos críticos, luego manuales y finalmente servicios / extras.

### 4. Documentación

- [ ] Si el cambio es significativo, considerar actualizar `AGENTS.md` o el `README.md` solo si el orden de productos es una regla de negocio relevante para futuros desarrolladores.
- [ ] No modificar la documentación si el cambio es puramente de presentación.

## Notas

- El ordenamiento es una regla de presentación específica de la página `/productos`; por eso se recomienda aplicarlo en el componente de la página y no en `productRepository.findAll` ni en `productService.listProducts`, a menos que se decida que el mismo orden debe usarse en otras pantallas.
- No agregar emojis ni comentarios explicativos innecesarios.
- Respetar las reglas de idioma del proyecto: todo el código y los mensajes de error deben estar en español.
