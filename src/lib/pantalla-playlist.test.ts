import { buildPantallaPlaylist } from './pantalla-playlist';
import type { PantallaVideo } from './pantalla-playlist';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

function makeProduct(
  id: number,
  overrides: Partial<PublicCatalogProduct> = {}
): PublicCatalogProduct {
  return {
    id,
    branchId: 1,
    name: `Producto ${id}`,
    description: null,
    type: 'compound',
    criticalSupplyType: null,
    price: 1000,
    unit: 'unidad',
    imageUrl: null,
    maxOptionalSelections: null,
    availability: 5,
    ...overrides,
  } as PublicCatalogProduct;
}

function makeVideo(id: number): PantallaVideo {
  return {
    id,
    title: `Video ${id}`,
    fileUrl: `https://example.com/v${id}.mp4`,
    mimeType: 'video/mp4',
  };
}

describe('buildPantallaPlaylist', () => {
  test('intercala videos y productos empezando por video', () => {
    const scenes = buildPantallaPlaylist(
      [makeVideo(1), makeVideo(2)],
      [makeProduct(10), makeProduct(11), makeProduct(12)],
      { maxProductos: 15 }
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'video:1',
      'product:10',
      'video:2',
      'product:11',
      'product:12',
      'branch',
      'qr',
    ]);
  });

  test('omite productos sin disponibilidad', () => {
    const scenes = buildPantallaPlaylist(
      [],
      [makeProduct(1, { availability: 0 }), makeProduct(2)],
      { maxProductos: 15 }
    );

    expect(scenes.map((s) => s.key)).toEqual(['product:2', 'branch', 'qr']);
  });

  test('los servicios entran aunque no tengan stock', () => {
    const scenes = buildPantallaPlaylist(
      [],
      [
        makeProduct(1, {
          type: 'service',
          availability: Number.MAX_SAFE_INTEGER,
        }),
      ],
      { maxProductos: 15 }
    );

    expect(scenes.map((s) => s.key)).toEqual(['product:1', 'branch', 'qr']);
  });

  test('ordena promos antes que bebidas y extras', () => {
    const scenes = buildPantallaPlaylist(
      [],
      [
        makeProduct(1, { type: 'service' }),
        makeProduct(2, {
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
        }),
        makeProduct(3, { type: 'compound' }),
      ],
      { maxProductos: 15 }
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'product:3',
      'product:2',
      'product:1',
      'branch',
      'qr',
    ]);
  });

  test('recorta la cantidad de productos por ciclo', () => {
    const scenes = buildPantallaPlaylist(
      [],
      [makeProduct(1), makeProduct(2), makeProduct(3)],
      { maxProductos: 2 }
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'product:1',
      'product:2',
      'branch',
      'qr',
    ]);
  });

  test('sin videos rota solo escenas de catálogo, sucursal y QR', () => {
    const scenes = buildPantallaPlaylist([], [makeProduct(1)], {
      maxProductos: 15,
    });

    expect(scenes.map((s) => s.kind)).toEqual(['product', 'branch', 'qr']);
  });

  test('catálogo vacío y sin videos devuelve sucursal + QR', () => {
    const scenes = buildPantallaPlaylist([], [], { maxProductos: 15 });

    expect(scenes.map((s) => s.key)).toEqual(['branch', 'qr']);
  });
});
