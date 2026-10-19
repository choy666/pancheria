import { buildPantallaPlaylist } from './pantalla-playlist';
import type {
  PantallaPlaylistItem,
  PantallaSettings,
  PantallaSnapshot,
  PantallaVideo,
} from './pantalla-playlist';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { Branch } from '@/domain/types';

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

function makeSettings(
  overrides: Partial<PantallaSettings> = {}
): PantallaSettings {
  return {
    playlistMode: 'auto',
    productoMs: 6000,
    sucursalMs: 8000,
    qrMs: 12000,
    videoMaxMs: 120000,
    maxProductos: 15,
    showBranchScene: true,
    showQrScene: true,
    ...overrides,
  };
}

function makeSnapshot({
  products = [],
  videos = [],
  items = [],
  settings = {},
}: {
  products?: PublicCatalogProduct[];
  videos?: PantallaVideo[];
  items?: PantallaPlaylistItem[];
  settings?: Partial<PantallaSettings>;
}): PantallaSnapshot {
  return {
    branch: { id: 1, name: 'Sucursal' } as Branch,
    isOpen: true,
    currentOpening: 'Hoy de 12:00 a 23:00',
    nextOpening: 'Mañana de 12:00 a 23:00',
    message: 'Sucursal abierta.',
    products,
    videos,
    items,
    settings: makeSettings(settings),
  };
}

describe('buildPantallaPlaylist (modo auto)', () => {
  test('intercala videos y productos empezando por video', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        videos: [makeVideo(1), makeVideo(2)],
        products: [makeProduct(10), makeProduct(11), makeProduct(12)],
      })
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
      makeSnapshot({
        products: [makeProduct(1, { availability: 0 }), makeProduct(2)],
      })
    );

    expect(scenes.map((s) => s.key)).toEqual(['product:2', 'branch', 'qr']);
  });

  test('los servicios entran aunque no tengan stock', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        products: [
          makeProduct(1, {
            type: 'service',
            availability: Number.MAX_SAFE_INTEGER,
          }),
        ],
      })
    );

    expect(scenes.map((s) => s.key)).toEqual(['product:1', 'branch', 'qr']);
  });

  test('ordena promos antes que bebidas y extras', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        products: [
          makeProduct(1, { type: 'service' }),
          makeProduct(2, {
            type: 'critical_supply',
            criticalSupplyType: 'beverage',
          }),
          makeProduct(3, { type: 'compound' }),
        ],
      })
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
      makeSnapshot({
        products: [makeProduct(1), makeProduct(2), makeProduct(3)],
        settings: { maxProductos: 2 },
      })
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'product:1',
      'product:2',
      'branch',
      'qr',
    ]);
  });

  test('sin videos rota solo escenas de catálogo, sucursal y QR', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({ products: [makeProduct(1)] })
    );

    expect(scenes.map((s) => s.kind)).toEqual(['product', 'branch', 'qr']);
  });

  test('catálogo vacío y sin videos devuelve sucursal + QR', () => {
    const scenes = buildPantallaPlaylist(makeSnapshot({}));

    expect(scenes.map((s) => s.key)).toEqual(['branch', 'qr']);
  });
});

describe('buildPantallaPlaylist (modo custom)', () => {
  const custom = { playlistMode: 'custom' as const };

  test('emite los ítems en el orden elegido, sin intercalar', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        videos: [makeVideo(1), makeVideo(2)],
        products: [makeProduct(10), makeProduct(11)],
        items: [
          { kind: 'product', refId: 11 },
          { kind: 'video', refId: 2 },
          { kind: 'video', refId: 1 },
          { kind: 'product', refId: 10 },
        ],
        settings: custom,
      })
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'product:11',
      'video:2',
      'video:1',
      'product:10',
      'branch',
      'qr',
    ]);
  });

  test('omite referencias que ya no son mostrables', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        products: [makeProduct(10, { availability: 0 }), makeProduct(11)],
        videos: [makeVideo(3)],
        items: [
          // Producto sin stock: la pantalla no anuncia lo que no se vende.
          { kind: 'product', refId: 10 },
          // Referencias inexistentes (borradas o de otra sucursal).
          { kind: 'product', refId: 999 },
          { kind: 'video', refId: 999 },
          // El video 4 existe pero inactivo → no viaja en el snapshot.
          { kind: 'video', refId: 4 },
          { kind: 'video', refId: 3 },
          { kind: 'product', refId: 11 },
        ],
        settings: custom,
      })
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'video:3',
      'product:11',
      'branch',
      'qr',
    ]);
  });

  test('ignora maxProductos: la lista explícita manda', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        products: [makeProduct(1), makeProduct(2), makeProduct(3)],
        items: [
          { kind: 'product', refId: 3 },
          { kind: 'product', refId: 2 },
          { kind: 'product', refId: 1 },
        ],
        settings: { ...custom, maxProductos: 1 },
      })
    );

    expect(scenes.map((s) => s.key)).toEqual([
      'product:3',
      'product:2',
      'product:1',
      'branch',
      'qr',
    ]);
  });
});

describe('buildPantallaPlaylist (escenas fijas y playlist vacía)', () => {
  test('se pueden ocultar las escenas de sucursal y QR', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        products: [makeProduct(1)],
        settings: { showBranchScene: false, showQrScene: false },
      })
    );

    expect(scenes.map((s) => s.key)).toEqual(['product:1']);
  });

  test('permite ocultar solo una de las fijas', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({ settings: { showQrScene: false } })
    );

    expect(scenes.map((s) => s.key)).toEqual(['branch']);
  });

  test('nunca queda vacía: todo oculto fuerza la escena de sucursal', () => {
    const scenes = buildPantallaPlaylist(
      makeSnapshot({
        items: [{ kind: 'product', refId: 999 }],
        settings: {
          playlistMode: 'custom',
          showBranchScene: false,
          showQrScene: false,
        },
      })
    );

    expect(scenes.map((s) => s.key)).toEqual(['branch']);
  });
});
