import {
  PRODUCTOS,
  buildCatalogPlan,
  type CatalogProductDef,
  type CatalogRecipeDef,
} from './data/catalogo-pancheria-popular';
import type { ProductRow } from '@/domain/types';

let nextId = 1;
function makeProduct(partial: Partial<ProductRow> & { name: string }): ProductRow {
  return {
    id: nextId++,
    branchId: 1,
    description: null,
    type: 'manual_supply',
    criticalSupplyType: null,
    price: 0,
    unit: 'unidad',
    stock: 0,
    minStock: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  };
}

describe('buildCatalogPlan', () => {
  test('en una sucursal vacía crea los 76 productos y las 11 recetas', () => {
    const plan = buildCatalogPlan([]);

    expect(plan.errors).toEqual([]);
    expect(plan.creates).toHaveLength(76);
    expect(plan.skips).toHaveLength(0);
    expect(plan.recipes).toHaveLength(11);
    // Bebidas sueltas y postres nacen activos con precio estimado (ver
    // encabezado del archivo de datos): el dueño los corrige en /productos.
    const inactivos = plan.creates.filter((d) => d.isActive === false);
    expect(inactivos).toHaveLength(0);
    // Todo producto público (compound/service/bebida) sale con precio > 0.
    expect(
      plan.creates.every(
        (d) =>
          d.price > 0 ||
          (d.type === 'critical_supply' && d.criticalSupplyType !== 'beverage') ||
          d.type === 'manual_supply'
      )
    ).toBe(true);
    // Ninguna receta queda sin resolver: todas las referencias existen.
    expect(
      plan.recipes.every((r) => r.compoundExisted === false)
    ).toBe(true);
  });

  test('omite productos existentes por nombre (case-insensitive) y reporta diffs', () => {
    const existentes = PRODUCTOS.map((def) =>
      makeProduct({
        name: def.name,
        type: def.type,
        criticalSupplyType: def.criticalSupplyType ?? null,
        price: def.price,
        unit: def.unit,
        isActive: def.isActive ?? true,
        maxOptionalSelections: def.maxOptionalSelections ?? null,
      })
    );

    const plan = buildCatalogPlan(existentes);

    expect(plan.errors).toEqual([]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.skips).toHaveLength(76);
    expect(plan.skips.every((s) => s.diffs.length === 0)).toBe(true);
    // Las recetas se reescriben igual (idempotencia por delete+insert).
    expect(plan.recipes).toHaveLength(11);
    expect(plan.recipes.every((r) => r.compoundExisted)).toBe(true);
    expect(plan.stockActions).toEqual([]);
  });

  test('reporta la diferencia de precio/tope en un producto existente sin sobrescribir', () => {
    const existentes = [
      makeProduct({
        name: 'Súper Pancho',
        type: 'compound',
        price: 900,
        maxOptionalSelections: 4,
      }),
      ...PRODUCTOS.filter((d) => d.name !== 'Súper Pancho').map((def) =>
        makeProduct({
          name: def.name,
          type: def.type,
          criticalSupplyType: def.criticalSupplyType ?? null,
          price: def.price,
          unit: def.unit,
          isActive: def.isActive ?? true,
          maxOptionalSelections: def.maxOptionalSelections ?? null,
        })
      ),
    ];

    const plan = buildCatalogPlan(existentes);

    const skip = plan.skips.find((s) => s.def.name === 'Súper Pancho')!;
    expect(skip.diffs).toEqual(['precio 900 → 1000']);
  });

  test('detecta nombre duplicado en el archivo de datos', () => {
    const productos: CatalogProductDef[] = [
      { name: 'Ketchup', type: 'manual_supply', price: 0, unit: 'sachet' },
      { name: ' ketchup ', type: 'manual_supply', price: 0, unit: 'sachet' },
    ];

    const plan = buildCatalogPlan([], productos, []);
    expect(plan.creates).toHaveLength(1);
    expect(plan.errors).toEqual([
      'Producto duplicado en el archivo de datos: " ketchup ".',
    ]);
  });

  test('detecta insumos de receta inexistentes y compuesto no compound', () => {
    const recetas: CatalogRecipeDef[] = [
      {
        compound: 'Promo rota',
        criticals: [{ supply: 'Pan super pancho', quantity: 1 }],
        optionals: [
          { supply: 'Insumo fantasma', quantity: 1, selectedByDefault: false },
        ],
      },
      {
        compound: 'Mayonesa',
        criticals: [{ supply: 'Pan super pancho', quantity: 1 }],
        optionals: [],
      },
    ];

    const plan = buildCatalogPlan([], PRODUCTOS, recetas);

    expect(plan.recipes).toHaveLength(0);
    expect(plan.errors).toContain(
      'La receta "Promo rota" no tiene producto compuesto (ni existe ni está en el archivo de datos).'
    );
    expect(
      plan.errors.some((e) =>
        e.startsWith('"Mayonesa" tiene receta pero su producto no es compound')
      )
    ).toBe(true);
  });

  test('rechaza una receta con más preseleccionados que el tope del compuesto', () => {
    const recetas: CatalogRecipeDef[] = [
      {
        compound: 'Súper Pancho',
        criticals: [{ supply: 'Pan super pancho', quantity: 1 }],
        optionals: [
          { supply: 'Mayonesa', quantity: 1, selectedByDefault: true },
          { supply: 'Ketchup', quantity: 1, selectedByDefault: true },
          { supply: 'Salsa Golf', quantity: 1, selectedByDefault: true },
          { supply: 'Mostaza', quantity: 1, selectedByDefault: true },
          { supply: 'Cheddar', quantity: 1, selectedByDefault: true },
        ],
      },
    ];

    const plan = buildCatalogPlan([], PRODUCTOS, recetas);
    expect(plan.recipes).toHaveLength(0);
    expect(plan.errors).toEqual([
      'La receta "Súper Pancho" tiene 5 opcionales preseleccionados pero el producto permite elegir hasta 4.',
    ]);
  });

  test('los componentes fijos no cuentan para el tope de opcionales', () => {
    const recetas: CatalogRecipeDef[] = [
      {
        compound: 'Súper Pancho',
        criticals: [{ supply: 'Pan super pancho', quantity: 1 }],
        fixeds: [{ supply: 'Vaso de gaseosa', quantity: 1 }],
        optionals: [
          { supply: 'Mayonesa', quantity: 1, selectedByDefault: true },
          { supply: 'Ketchup', quantity: 1, selectedByDefault: true },
          { supply: 'Salsa Golf', quantity: 1, selectedByDefault: true },
          { supply: 'Mostaza', quantity: 1, selectedByDefault: true },
        ],
      },
    ];

    const plan = buildCatalogPlan([], PRODUCTOS, recetas);
    expect(plan.errors).toEqual([]);
    expect(plan.recipes).toHaveLength(1);
  });

  test('detecta insumos que no resuelven cuando el compuesto sí existe', () => {
    const recetas: CatalogRecipeDef[] = [
      {
        compound: 'Súper Pancho',
        criticals: [{ supply: 'Pan super pancho', quantity: 1 }],
        optionals: [
          { supply: 'Aderezo inexistente', quantity: 1, selectedByDefault: false },
        ],
      },
    ];

    const plan = buildCatalogPlan([], PRODUCTOS, recetas);
    expect(plan.errors).toEqual([
      'La receta "Súper Pancho" referencia insumos inexistentes: Aderezo inexistente.',
    ]);
  });

  test('el stock inicial solo se agenda para productos nuevos', () => {
    const productos: CatalogProductDef[] = [
      {
        name: 'Pan super pancho',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        price: 0,
        unit: 'unidad',
        initialStock: 50,
      },
      {
        name: 'Salchichas',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        price: 0,
        unit: 'unidad',
        initialStock: 30,
      },
    ];
    const existentes = [
      makeProduct({
        name: 'Salchichas',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
      }),
    ];

    const plan = buildCatalogPlan(existentes, productos, []);
    expect(plan.stockActions).toEqual([
      { productName: 'Pan super pancho', quantity: 50 },
    ]);
  });

  test('avisa si la sucursal ya tiene dos productos con el mismo nombre', () => {
    const existentes = [
      makeProduct({ name: 'Ketchup', type: 'manual_supply' }),
      makeProduct({ name: 'Ketchup', type: 'manual_supply' }),
    ];

    const plan = buildCatalogPlan(existentes);
    expect(
      plan.warnings.some((w) => w.includes('Nombre duplicado'))
    ).toBe(true);
  });
});
