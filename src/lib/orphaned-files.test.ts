/**
 * @jest-environment node
 */
import { listLocalKeys, deleteOrphanedKeys } from './orphaned-files';

const mockReaddir = jest.fn();

jest.mock('fs', () => ({
  promises: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
  },
}));

function createDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
  } as any;
}

describe('orphaned-files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listLocalKeys', () => {
    test('modo plano: devuelve solo archivos directos e ignora directorios', async () => {
      mockReaddir.mockResolvedValue([
        createDirent('video1.mp4', false),
        createDirent('video2.webm', false),
        createDirent('chat', true),
      ]);

      const keys = await listLocalKeys('/base', false);

      expect(keys).toEqual(['video1.mp4', 'video2.webm']);
    });

    test('modo anidado: devuelve archivos de un nivel abajo con su subcarpeta', async () => {
      mockReaddir.mockImplementation((dir: string) => {
        const normalized = dir.replace(/\\/g, '/');
        if (normalized === '/base') {
          return Promise.resolve([
            createDirent('10', true),
            createDirent('suelto.jpg', false),
          ]);
        }
        if (normalized.endsWith('/10')) {
          return Promise.resolve([
            createDirent('a.jpg', false),
            createDirent('b.jpg', false),
          ]);
        }
        return Promise.resolve([]);
      });

      const keys = await listLocalKeys('/base', true);

      expect(keys).toEqual(['10/a.jpg', '10/b.jpg', 'suelto.jpg']);
    });

    test('devuelve lista vacía si el directorio no existe', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const keys = await listLocalKeys('/inexistente', true);

      expect(keys).toEqual([]);
    });
  });

  describe('deleteOrphanedKeys', () => {
    test('borra solo las claves que no están vivas', async () => {
      const deleteKey = jest.fn().mockResolvedValue(undefined);

      const result = await deleteOrphanedKeys(
        ['a', 'b', 'c'],
        new Set(['a']),
        deleteKey
      );

      expect(deleteKey).toHaveBeenCalledTimes(2);
      expect(deleteKey).toHaveBeenCalledWith('b');
      expect(deleteKey).toHaveBeenCalledWith('c');
      expect(result).toEqual({ listed: 3, deleted: 2 });
    });

    test('un fallo individual no aborta el resto', async () => {
      const deleteKey = jest
        .fn()
        .mockRejectedValueOnce(new Error('fallo'))
        .mockResolvedValue(undefined);

      const result = await deleteOrphanedKeys(
        ['x', 'y'],
        new Set(),
        deleteKey
      );

      expect(result).toEqual({ listed: 2, deleted: 1 });
    });
  });
});
