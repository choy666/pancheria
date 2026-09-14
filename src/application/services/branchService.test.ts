import {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  getBranchDeletionSummary,
  deleteBranch,
} from './branchService';
import { db } from '@/db';
import { NotFoundError, ValidationError } from '@/domain/errors';

jest.mock('@/db', () => ({
  db: {
    query: {
      branches: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

const mockedDb = db as unknown as {
  query: {
    branches: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  select: jest.Mock;
  transaction: jest.Mock;
};

const mockReturning = jest.fn();
const mockUpdateReturning = jest.fn();

describe('branchService', () => {
  beforeEach(() => {
    mockedDb.query.branches.findFirst.mockReset();
    mockedDb.query.branches.findFirst.mockResolvedValue(undefined);
    mockedDb.query.branches.findMany.mockReset();
    mockedDb.query.branches.findMany.mockResolvedValue([]);
    mockedDb.insert.mockReset();
    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({ returning: mockReturning }),
    });
    mockedDb.update.mockReset();
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: mockUpdateReturning,
        }),
      }),
    });
    mockedDb.select.mockReset();
    mockedDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    const mockTx = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
    };

    mockedDb.transaction.mockReset();
    mockedDb.transaction.mockImplementation(async (callback) => {
      await callback(mockTx);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listBranches', () => {
    test('devuelve todas las sucursales ordenadas por createdAt descendente', async () => {
      const expected = [
        { id: 2, name: 'Sucursal B', openingHours: [], createdAt: new Date() },
        { id: 1, name: 'Sucursal A', openingHours: [], createdAt: new Date() },
      ];
      mockedDb.query.branches.findMany.mockResolvedValue(expected);

      const result = await listBranches();

      expect(result).toEqual(expected);
      expect(mockedDb.query.branches.findMany).toHaveBeenCalled();
    });
  });

  describe('getBranchById', () => {
    test('devuelve la sucursal por id', async () => {
      const expected = { id: 1, name: 'Sucursal A', openingHours: [] };
      mockedDb.query.branches.findFirst.mockResolvedValue(expected);

      const result = await getBranchById(1);

      expect(result).toEqual(expected);
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalled();
    });

    test('devuelve undefined si no existe', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const result = await getBranchById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('createBranch', () => {
    test('crea una sucursal nueva', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal Nueva', openingHours: [] }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const result = await createBranch({ name: 'Sucursal Nueva' });

      expect(result).toEqual({ id: 1, name: 'Sucursal Nueva', openingHours: [] });
    });

    test('rechaza un nombre vacío', async () => {
      await expect(createBranch({ name: '   ' })).rejects.toThrow(ValidationError);
      await expect(createBranch({ name: '   ' })).rejects.toThrow(
        'El nombre de la sucursal es obligatorio.'
      );
    });

    test('rechaza un nombre duplicado', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue({
        id: 2,
        name: 'Existente',
        openingHours: [],
      });

      await expect(createBranch({ name: 'Existente' })).rejects.toThrow(ValidationError);
      await expect(createBranch({ name: 'Existente' })).rejects.toThrow(
        'Ya existe una sucursal con ese nombre.'
      );
    });

    test('rechaza una ubicación inválida', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(
        createBranch({ name: 'Sucursal', location: 'javascript:alert(1)' })
      ).rejects.toThrow(ValidationError);
      await expect(
        createBranch({ name: 'Sucursal', location: 'javascript:alert(1)' })
      ).rejects.toThrow('La ubicación no es una URL ni coordenadas válidas.');
    });

    test('rechaza una ubicación con esquema no http/https', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(
        createBranch({ name: 'Sucursal', location: 'ftp://example.com' })
      ).rejects.toThrow(ValidationError);
    });

    test('guarda null cuando la ubicación está vacía o solo tiene espacios', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal', openingHours: [] }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const valuesFn = jest.fn().mockReturnValue({ returning: mockReturning });
      mockedDb.insert.mockReturnValue({ values: valuesFn });

      await createBranch({ name: 'Sucursal', location: '   ' });

      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ location: null })
      );
    });

    test('guarda teléfonos y redes sociales normalizados', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal' }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const valuesFn = jest.fn().mockReturnValue({ returning: mockReturning });
      mockedDb.insert.mockReturnValue({ values: valuesFn });

      await createBranch({
        name: 'Sucursal',
        phones: [{ label: '  Pedidos  ', number: '341 555 5555' }],
        socialLinks: [
          { network: 'instagram', url: 'https://instagram.com/pancheria' },
        ],
      });

      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          phones: [{ label: 'Pedidos', number: '341 555 5555' }],
          socialLinks: [
            { network: 'instagram', url: 'https://instagram.com/pancheria' },
          ],
        })
      );
    });

    test('rechaza un teléfono sin número', async () => {
      await expect(
        createBranch({
          name: 'Sucursal',
          phones: [{ label: 'Pedidos', number: '' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza un teléfono con caracteres inválidos', async () => {
      await expect(
        createBranch({
          name: 'Sucursal',
          phones: [{ label: 'Pedidos', number: 'abc-###' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza una red social con enlace inseguro', async () => {
      await expect(
        createBranch({
          name: 'Sucursal',
          socialLinks: [{ network: 'instagram', url: 'javascript:alert(1)' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza una red social desconocida', async () => {
      await expect(
        createBranch({
          name: 'Sucursal',
          socialLinks: [{ network: 'myspace', url: 'https://example.com' }],
        })
      ).rejects.toThrow(ValidationError);
    });

    test('acepta un handle de red social sin URL', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal' }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const valuesFn = jest.fn().mockReturnValue({ returning: mockReturning });
      mockedDb.insert.mockReturnValue({ values: valuesFn });

      await createBranch({
        name: 'Sucursal',
        socialLinks: [{ network: 'instagram', url: '@pancheria' }],
      });

      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          socialLinks: [{ network: 'instagram', url: '@pancheria' }],
        })
      );
    });

    test('guarda una URL de mapas válida tal cual', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal', openingHours: [] }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const valuesFn = jest.fn().mockReturnValue({ returning: mockReturning });
      mockedDb.insert.mockReturnValue({ values: valuesFn });

      await createBranch({
        name: 'Sucursal',
        location: 'https://maps.ejemplo.com',
      });

      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'https://maps.ejemplo.com' })
      );
    });

    test('convierte coordenadas en URL de mapas', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal', openingHours: [] }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const valuesFn = jest.fn().mockReturnValue({ returning: mockReturning });
      mockedDb.insert.mockReturnValue({ values: valuesFn });

      await createBranch({ name: 'Sucursal', location: '-34.6,-58.3' });

      expect(valuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.stringContaining('openstreetmap.org'),
        })
      );
    });
  });

  describe('updateBranch', () => {
    function mockFindFirstSequence(values: (typeof mockedDb.query.branches.findFirst)[]) {
      let callCount = 0;
      mockedDb.query.branches.findFirst.mockImplementation(() => {
        const value = values[callCount] ?? undefined;
        callCount += 1;
        return value as any;
      });
    }

    test('actualiza una sucursal existente', async () => {
      mockFindFirstSequence([
        { id: 1, name: 'Sucursal A', openingHours: [] } as any,
        undefined,
      ]);
      mockUpdateReturning.mockResolvedValue([{ id: 1, name: 'Sucursal Nueva', openingHours: [] }]);

      const result = await updateBranch(1, { name: 'Sucursal Nueva' });

      expect(result).toEqual({ id: 1, name: 'Sucursal Nueva', openingHours: [] });
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalledTimes(2);
      expect(mockedDb.update).toHaveBeenCalled();
    });

    test('rechaza un nombre vacío', async () => {
      await expect(updateBranch(1, { name: '   ' })).rejects.toThrow(ValidationError);
      await expect(updateBranch(1, { name: '   ' })).rejects.toThrow(
        'El nombre de la sucursal es obligatorio.'
      );
    });

    test('rechaza un nombre duplicado con otra sucursal', async () => {
      mockFindFirstSequence([
        { id: 1, name: 'Sucursal A', openingHours: [] } as any,
        { id: 2, name: 'Sucursal B', openingHours: [] } as any,
      ]);

      await expect(updateBranch(1, { name: 'Sucursal B' })).rejects.toThrow(
        'Ya existe otra sucursal con ese nombre.'
      );
    });

    test('permite guardar el mismo nombre de la sucursal que se está editando', async () => {
      mockFindFirstSequence([
        { id: 1, name: 'Sucursal A', openingHours: [] } as any,
        undefined,
      ]);
      mockUpdateReturning.mockResolvedValue([{ id: 1, name: 'Sucursal A', openingHours: [] }]);

      const result = await updateBranch(1, { name: 'Sucursal A' });

      expect(result).toEqual({ id: 1, name: 'Sucursal A', openingHours: [] });
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalledTimes(2);
    });

    test('lanza NotFoundError para un ID inexistente', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(
        updateBranch(999, { name: 'Sucursal Inexistente' })
      ).rejects.toThrow(NotFoundError);
      await expect(
        updateBranch(999, { name: 'Sucursal Inexistente' })
      ).rejects.toThrow('Sucursal con ID 999 no encontrado.');
    });

    test('rechaza una ubicación inválida', async () => {
      mockFindFirstSequence([
        { id: 1, name: 'Sucursal A', openingHours: [] } as any,
        undefined,
      ]);

      await expect(
        updateBranch(1, { name: 'Sucursal A', location: 'javascript:alert(1)' })
      ).rejects.toThrow('La ubicación no es una URL ni coordenadas válidas.');
    });

    test('convierte coordenadas en URL de mapas', async () => {
      mockFindFirstSequence([
        { id: 1, name: 'Sucursal A', openingHours: [] } as any,
        undefined,
      ]);
      mockUpdateReturning.mockResolvedValue([
        { id: 1, name: 'Sucursal A', openingHours: [] },
      ]);

      const setFn = jest
        .fn()
        .mockReturnValue({ where: jest.fn().mockReturnValue({ returning: mockUpdateReturning }) });
      mockedDb.update.mockReturnValue({ set: setFn });

      await updateBranch(1, {
        name: 'Sucursal A',
        location: '-34.6,-58.3',
      });

      expect(setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.stringContaining('openstreetmap.org'),
        })
      );
    });
  });

  describe('getBranchDeletionSummary', () => {
    test('devuelve el resumen de dependencias de una sucursal', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue({
        id: 1,
        name: 'Sucursal A',
        openingHours: [],
      });

      const result = await getBranchDeletionSummary(1);

      expect(result.branch).toEqual({ id: 1, name: 'Sucursal A', openingHours: [] });
      expect(result.counts).toMatchObject({
        products: 0,
        sales: 0,
        cashRegisters: 0,
        stockMovements: 0,
        users: 0,
        recipes: 0,
        total: 0,
      });
    });

    test('lanza NotFoundError para una sucursal inexistente', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(getBranchDeletionSummary(999)).rejects.toThrow(NotFoundError);
      await expect(getBranchDeletionSummary(999)).rejects.toThrow(
        'Sucursal con ID 999 no encontrado.'
      );
    });
  });

  describe('deleteBranch', () => {
    test('elimina una sucursal y sus datos en cascada', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue({
        id: 1,
        name: 'Sucursal A',
        openingHours: [],
      });

      const result = await deleteBranch(1);

      expect(result).toEqual({ id: 1, name: 'Sucursal A', openingHours: [] });
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
      expect(mockedDb.transaction).toHaveBeenCalled();
    });

    test('lanza NotFoundError para un ID inexistente', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(deleteBranch(999)).rejects.toThrow(NotFoundError);
      await expect(deleteBranch(999)).rejects.toThrow(
        'Sucursal con ID 999 no encontrado.'
      );
    });
  });
});
