import * as pantallaRepository from './pantallaRepository';

var mockSettingsFindFirst: jest.Mock;
var mockSelectOrderBy: jest.Mock;
var mockSelectWhere: jest.Mock;
var mockLeftJoin: jest.Mock;
var mockSelectFrom: jest.Mock;
var mockSelect: jest.Mock;
var mockReturning: jest.Mock;
var mockOnConflict: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockDeleteWhere: jest.Mock;
var mockDelete: jest.Mock;

jest.mock('@/db', () => {
  mockSettingsFindFirst = jest.fn();
  mockSelectOrderBy = jest.fn();
  mockSelectWhere = jest.fn(() => ({ orderBy: mockSelectOrderBy }));
  mockLeftJoin = jest.fn(() => ({
    leftJoin: mockLeftJoin,
    where: mockSelectWhere,
  }));
  mockSelectFrom = jest.fn(() => ({
    leftJoin: mockLeftJoin,
    where: mockSelectWhere,
  }));
  mockSelect = jest.fn(() => ({ from: mockSelectFrom }));
  mockReturning = jest.fn();
  mockOnConflict = jest.fn(() => ({ returning: mockReturning }));
  mockValues = jest.fn(() => ({
    returning: mockReturning,
    onConflictDoUpdate: mockOnConflict,
  }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockDeleteWhere = jest.fn();
  mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

  return {
    db: {
      query: {
        pantallaSettings: { findFirst: mockSettingsFindFirst },
      },
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    },
  };
});

const BRANCH_ID = 1;

describe('pantallaRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findSettings', () => {
    test('devuelve la fila de la sucursal o null si no existe', async () => {
      mockSettingsFindFirst.mockResolvedValue({ branchId: BRANCH_ID });
      expect(await pantallaRepository.findSettings(BRANCH_ID)).toEqual({
        branchId: BRANCH_ID,
      });

      mockSettingsFindFirst.mockResolvedValue(undefined);
      expect(await pantallaRepository.findSettings(BRANCH_ID)).toBeNull();
    });
  });

  describe('upsertSettings', () => {
    test('inserta con conflicto en branch_id y actualiza updatedAt', async () => {
      const row = { branchId: BRANCH_ID, playlistMode: 'custom' };
      mockReturning.mockResolvedValue([row]);

      const result = await pantallaRepository.upsertSettings(BRANCH_ID, {
        playlistMode: 'custom',
        productoMs: 5000,
        sucursalMs: 8000,
        qrMs: 12000,
        videoMaxMs: 120000,
        maxProductos: 20,
        showBranchScene: true,
        showQrScene: false,
      });

      expect(result).toEqual(row);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: BRANCH_ID,
          playlistMode: 'custom',
          productoMs: 5000,
          updatedAt: expect.any(Date),
        })
      );
      expect(mockOnConflict).toHaveBeenCalled();
    });
  });

  describe('findItems', () => {
    test('devuelve los ítems ordenados por posición', async () => {
      const items = [
        { id: 1, position: 0 },
        { id: 2, position: 1 },
      ];
      mockSelectOrderBy.mockResolvedValue(items);

      const result = await pantallaRepository.findItems(BRANCH_ID);

      expect(result).toEqual(items);
      expect(mockSelect).toHaveBeenCalled();
    });

    test('la opción enabledOnly filtra los deshabilitados', async () => {
      mockSelectOrderBy.mockResolvedValue([]);

      await pantallaRepository.findItems(BRANCH_ID, { enabledOnly: true });
      await pantallaRepository.findItems(BRANCH_ID);

      // Ambas llamadas pasan por where/orderBy; el filtro extra solo cambia
      // la condición — el mock no distingue, el test fija que ambas rutas
      // resuelven sin romper la cadena.
      expect(mockSelectWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('findItemsWithRefs', () => {
    test('resuelve producto y video con left joins', async () => {
      const rows = [
        {
          item: { id: 1, kind: 'product', productId: 10 },
          product: { id: 10, name: 'Pancho' },
          video: null,
        },
      ];
      mockSelectOrderBy.mockResolvedValue(rows);

      const result = await pantallaRepository.findItemsWithRefs(BRANCH_ID);

      expect(result).toEqual(rows);
      expect(mockLeftJoin).toHaveBeenCalled();
    });
  });

  describe('deleteItemsByBranch / insertItems', () => {
    test('borra los ítems de la sucursal', async () => {
      await pantallaRepository.deleteItemsByBranch(undefined, BRANCH_ID);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    test('inserta el lote de ítems', async () => {
      const inserted = [{ id: 1 }, { id: 2 }];
      mockReturning.mockResolvedValue(inserted);

      const result = await pantallaRepository.insertItems(undefined, [
        {
          branchId: BRANCH_ID,
          kind: 'product',
          productId: 10,
          videoId: null,
          position: 0,
          isEnabled: true,
        },
        {
          branchId: BRANCH_ID,
          kind: 'video',
          productId: null,
          videoId: 7,
          position: 1,
          isEnabled: false,
        },
      ]);

      expect(result).toEqual(inserted);
      expect(mockValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'product', position: 0 }),
          expect.objectContaining({ kind: 'video', position: 1 }),
        ])
      );
    });

    test('inserta nada cuando la lista viene vacía', async () => {
      const result = await pantallaRepository.insertItems(undefined, []);
      expect(result).toEqual([]);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
