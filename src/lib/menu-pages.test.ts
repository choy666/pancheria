import { buildMenuPages, MENU_GRID_COLS } from './menu-pages';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { ProductType } from '@/domain/types';

let nextId = 1;

function makeProduct(
  type: ProductType,
  availability = 5,
  name?: string,
  price = 1000
): PublicCatalogProduct {
  return {
    id: nextId++,
    name: name ?? `Producto ${nextId}`,
    description: null,
    type,
    criticalSupplyType: type === 'critical_supply' ? 'beverage' : null,
    price,
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
    const pages = buildMenuPages([], { filasPagina: 4 });

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toEqual([]);
  });

  test('pocos productos de una categoría entran en una sola página', () => {
    const pages = buildMenuPages(makeProducts('compound', 4), {
      filasPagina: 4,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toHaveLength(1);
    expect(pages[0].groups[0].items).toHaveLength(4);
  });

  test('productos agotados no se muestran', () => {
    const products = [
      ...makeProducts('compound', 2),
      makeProduct('compound', 0, 'Agotado'),
    ];

    const pages = buildMenuPages(products, { filasPagina: 4 });

    const names = pages[0].groups[0].items.map((item) => item.name);
    expect(names).not.toContain('Agotado');
  });

  test('si todo está agotado queda una página vacía', () => {
    const pages = buildMenuPages(makeProducts('compound', 3, 0), {
      filasPagina: 4,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toEqual([]);
  });

  test('varias categorías que entran juntas comparten página', () => {
    const products = [
      ...makeProducts('compound', 4), // 1 cabezal + 1 fila = 2 líneas
      ...makeProducts('critical_supply', 4), // 2 líneas
    ];

    const pages = buildMenuPages(products, { filasPagina: 4 });

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

    const pages = buildMenuPages(products, { filasPagina: 4 });

    expect(pages).toHaveLength(2);
    expect(pages[0].groups.map((group) => group.type)).toEqual(['compound']);
    expect(pages[0].groups[0].items).toHaveLength(8);
    expect(pages[1].groups.map((group) => group.type)).toEqual([
      'critical_supply',
    ]);
  });

  test('una categoría que supera el presupuesto se parte con cabezal repetido', () => {
    // 16 ítems de una categoría: con maxFilas 4 son (4-1)*4 = 12 por página.
    const pages = buildMenuPages(makeProducts('compound', 16), {
      filasPagina: 4,
    });

    expect(pages).toHaveLength(2);
    expect(pages[0].groups[0].items).toHaveLength(12);
    expect(pages[0].groups[0].type).toBe('compound');
    expect(pages[1].groups[0].items).toHaveLength(4);
    expect(pages[1].groups[0].type).toBe('compound');
  });

  test('con menos columnas entran menos tarjetas por página', () => {
    // 10 ítems con filasPagina 4: a 4 columnas son 1+ceil(10/4)=4 líneas y
    // entran; a 3 son 1+ceil(10/3)=5 y la categoría se parte en (4-1)*3=9+1.
    const products = makeProducts('compound', 10);

    expect(
      buildMenuPages(products, { filasPagina: 4 })
    ).toHaveLength(1);

    const con3 = buildMenuPages(products, { filasPagina: 4, columnas: 3 });
    expect(con3).toHaveLength(2);
    expect(con3[0].groups[0].items).toHaveLength(9);
    expect(con3[1].groups[0].items).toHaveLength(1);
  });

  test('con más columnas entran más tarjetas por página', () => {
    // 15 ítems con filasPagina 4: a 4 columnas son 1+4=5 líneas y se parte;
    // a 5 son 1+3=4 y entran completos en una página.
    const products = makeProducts('compound', 15);

    const con5 = buildMenuPages(products, { filasPagina: 4, columnas: 5 });
    expect(con5).toHaveLength(1);
    expect(con5[0].groups[0].items).toHaveLength(15);
  });

  test('respeta el orden público de grupos aunque la entrada venga mezclada', () => {
    const products = [
      ...makeProducts('service', 2),
      ...makeProducts('compound', 2),
      ...makeProducts('critical_supply', 2),
    ];

    const pages = buildMenuPages(products, { filasPagina: 8 });

    expect(pages[0].groups.map((group) => group.type)).toEqual([
      'compound',
      'critical_supply',
      'service',
    ]);
  });

  test('el orden de catálogo conserva el orden alfabético dentro del grupo', () => {
    const products = [
      makeProduct('compound', 5, 'Zanahoria'),
      makeProduct('compound', 5, 'Ananá'),
      makeProduct('compound', 5, 'Mandioca'),
    ];

    const pages = buildMenuPages(products, { filasPagina: 4 });

    expect(pages[0].groups[0].items.map((item) => item.name)).toEqual([
      'Ananá',
      'Mandioca',
      'Zanahoria',
    ]);
  });

  test('con orden por precio ascendente reordena dentro de cada categoría', () => {
    const products = [
      makeProduct('compound', 5, 'Caro', 3000),
      makeProduct('compound', 5, 'Barato', 1000),
      makeProduct('compound', 5, 'Medio', 2000),
    ];

    const pages = buildMenuPages(products, {
      filasPagina: 4,
      orden: 'price_asc',
    });

    expect(pages[0].groups[0].items.map((item) => item.name)).toEqual([
      'Barato',
      'Medio',
      'Caro',
    ]);
  });

  test('con orden por precio descendente reordena dentro de cada categoría', () => {
    const products = [
      makeProduct('compound', 5, 'Barato', 1000),
      makeProduct('compound', 5, 'Caro', 3000),
      makeProduct('compound', 5, 'Medio', 2000),
    ];

    const pages = buildMenuPages(products, {
      filasPagina: 4,
      orden: 'price_desc',
    });

    expect(pages[0].groups[0].items.map((item) => item.name)).toEqual([
      'Caro',
      'Medio',
      'Barato',
    ]);
  });

  test('los productos ocultos de la sucursal no se muestran', () => {
    const [visible, oculto] = [
      makeProduct('compound', 5, 'Visible'),
      makeProduct('compound', 5, 'Oculto en panel'),
    ];

    const pages = buildMenuPages([visible, oculto], {
      filasPagina: 4,
      ocultos: new Set([oculto.id]),
    });

    const names = pages[0].groups[0].items.map((item) => item.name);
    expect(names).toContain('Visible');
    expect(names).not.toContain('Oculto en panel');
  });

  test('ocultar toda una categoría elimina el grupo de la página', () => {
    const bebidas = makeProducts('critical_supply', 3);
    const products = [...makeProducts('compound', 2), ...bebidas];

    const pages = buildMenuPages(products, {
      filasPagina: 4,
      ocultos: new Set(bebidas.map((product) => product.id)),
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].groups.map((group) => group.type)).toEqual(['compound']);
  });

  test('si todo queda oculto o agotado queda una página vacía', () => {
    const products = makeProducts('compound', 2);

    const pages = buildMenuPages(products, {
      filasPagina: 4,
      ocultos: new Set(products.map((product) => product.id)),
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].groups).toEqual([]);
  });

  test('los destacados encabezan su categoría conservando el orden de catálogo', () => {
    const products = makeProducts('compound', 4);
    const destacado = products[2];

    const pages = buildMenuPages(products, {
      filasPagina: 4,
      destacados: new Set([destacado.id]),
    });

    const items = pages[0].groups[0].items;
    expect(items[0].id).toBe(destacado.id);
    // El resto conserva el orden alfabético del agrupamiento.
    expect(items.slice(1).map((item) => item.name)).toEqual([
      'compound 1',
      'compound 2',
      'compound 4',
    ]);
  });

  test('con orden por precio los destacados también se ordenan por precio entre sí', () => {
    const a = makeProduct('compound', 5, 'A', 3000);
    const b = makeProduct('compound', 5, 'B', 1000);
    const c = makeProduct('compound', 5, 'C', 2000);

    const pages = buildMenuPages([a, b, c], {
      filasPagina: 4,
      orden: 'price_asc',
      destacados: new Set([a.id, b.id]),
    });

    // Destacados primero (B antes que A por precio), después el resto.
    expect(pages[0].groups[0].items.map((item) => item.id)).toEqual([
      b.id,
      a.id,
      c.id,
    ]);
  });

  test('un producto oculto y destacado a la vez queda oculto', () => {
    const products = makeProducts('compound', 3);
    const id = products[0].id;

    const pages = buildMenuPages(products, {
      filasPagina: 4,
      ocultos: new Set([id]),
      destacados: new Set([id]),
    });

    expect(pages[0].groups[0].items.map((item) => item.id)).not.toContain(id);
  });

  test('con maxFilas mínimo no entra en loop y reparte en páginas', () => {
    const pages = buildMenuPages(makeProducts('compound', 6), {
      filasPagina: 1,
    });

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
