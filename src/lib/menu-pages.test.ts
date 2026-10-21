import { buildMenuPages, MENU_GRID_COLS } from './menu-pages';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { ProductType } from '@/domain/types';

let nextId = 1;

function makeProduct(
  type: ProductType,
  availability = 5,
  name?: string
): PublicCatalogProduct {
  return {
    id: nextId++,
    name: name ?? `Producto ${nextId}`,
    description: null,
    type,
    criticalSupplyType: type === 'critical_supply' ? 'beverage' : null,
    price: 1000,
    unit: 'unidad',
    imageUrl: null,
    maxOptionalSelections: null,
    availability,
  } as PublicCatalogProduct;
}

function makeProducts(type: ProductType, count: number, availability = 5) {
  return Array.from({ length: count }, (_, i) =>
    makeProduct(type, availability, `${type} ${i + 1}`)
  );
}

describe('buildMenuPages', () => {
  beforeEach(() => {
    nextId = 1;
  });

  test('catálogo vacío devuelve una página sin grupos', () => {
    const pages = buildMenuPages([], 4);

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toEqual([]);
  });

  test('pocos productos de una categoría entran en una sola página', () => {
    const pages = buildMenuPages(makeProducts('compound', 4), 4);

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toHaveLength(1);
    expect(pages[0].groups[0].items).toHaveLength(4);
  });

  test('productos agotados no se muestran', () => {
    const products = [
      ...makeProducts('compound', 2),
      makeProduct('compound', 0, 'Agotado'),
    ];

    const pages = buildMenuPages(products, 4);

    const names = pages[0].groups[0].items.map((item) => item.name);
    expect(names).not.toContain('Agotado');
  });

  test('si todo está agotado queda una página vacía', () => {
    const pages = buildMenuPages(makeProducts('compound', 3, 0), 4);

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toEqual([]);
  });

  test('varias categorías que entran juntas comparten página', () => {
    const products = [
      ...makeProducts('compound', 4), // 1 cabezal + 1 fila = 2 líneas
      ...makeProducts('critical_supply', 4), // 2 líneas
    ];

    const pages = buildMenuPages(products, 4);

    expect(pages).toHaveLength(1);
    expect(pages[0].groups.map((group) => group.type)).toEqual([
      'compound',
      'critical_supply',
    ]);
  });

  test('una categoría que no entra pasa a la página siguiente completa', () => {
    const products = [
      ...makeProducts('compound', 8), // 1 + 2 = 3 líneas
      ...makeProducts('critical_supply', 8), // 3 líneas
    ];

    const pages = buildMenuPages(products, 4);

    expect(pages).toHaveLength(2);
    expect(pages[0].groups.map((group) => group.type)).toEqual(['compound']);
    expect(pages[0].groups[0].items).toHaveLength(8);
    expect(pages[1].groups.map((group) => group.type)).toEqual([
      'critical_supply',
    ]);
  });

  test('una categoría que supera el presupuesto se parte con cabezal repetido', () => {
    // 16 ítems de una categoría: con maxFilas 4 son (4-1)*4 = 12 por página.
    const pages = buildMenuPages(makeProducts('compound', 16), 4);

    expect(pages).toHaveLength(2);
    expect(pages[0].groups[0].items).toHaveLength(12);
    expect(pages[0].groups[0].type).toBe('compound');
    expect(pages[1].groups[0].items).toHaveLength(4);
    expect(pages[1].groups[0].type).toBe('compound');
  });

  test('respeta el orden público de grupos aunque la entrada venga mezclada', () => {
    const products = [
      ...makeProducts('service', 2),
      ...makeProducts('compound', 2),
      ...makeProducts('critical_supply', 2),
    ];

    const pages = buildMenuPages(products, 8);

    expect(pages[0].groups.map((group) => group.type)).toEqual([
      'compound',
      'critical_supply',
      'service',
    ]);
  });

  test('los productos ocultos de la sucursal no se muestran', () => {
    const [visible, oculto] = [
      makeProduct('compound', 5, 'Visible'),
      makeProduct('compound', 5, 'Oculto en panel'),
    ];

    const pages = buildMenuPages(
      [visible, oculto],
      4,
      new Set([oculto.id])
    );

    const names = pages[0].groups[0].items.map((item) => item.name);
    expect(names).toContain('Visible');
    expect(names).not.toContain('Oculto en panel');
  });

  test('ocultar toda una categoría elimina el grupo de la página', () => {
    const bebidas = makeProducts('critical_supply', 3);
    const products = [...makeProducts('compound', 2), ...bebidas];

    const pages = buildMenuPages(
      products,
      4,
      new Set(bebidas.map((product) => product.id))
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].groups.map((group) => group.type)).toEqual(['compound']);
  });

  test('si todo queda oculto o agotado queda una página vacía', () => {
    const products = makeProducts('compound', 2);

    const pages = buildMenuPages(
      products,
      4,
      new Set(products.map((product) => product.id))
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toEqual([]);
  });

  test('con maxFilas mínimo no entra en loop y reparte en páginas', () => {
    const pages = buildMenuPages(makeProducts('compound', 6), 1);

    expect(pages.length).toBeGreaterThanOrEqual(1);
    const total = pages.reduce(
      (acc, page) =>
        acc + page.groups.reduce((sum, group) => sum + group.items.length, 0),
      0
    );
    expect(total).toBe(6);
    for (const page of pages) {
      for (const group of page.groups) {
        expect(group.items.length).toBeLessThanOrEqual(MENU_GRID_COLS);
      }
    }
  });
});
