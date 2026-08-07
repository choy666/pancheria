import * as dailyClosureRepository from './dailyClosureRepository';

/* eslint-disable no-var */

var mockFindFirst: jest.Mock;
var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;

jest.mock('@/db', () => {
  mockFindFirst = jest.fn();
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));

  return {
    db: {
      query: {
        dailyClosures: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
    },
  };
});

describe('dailyClosureRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByDate', () => {
    test('devuelve el cierre diario de una fecha', async () => {
      const date = new Date('2026-08-01T00:00:00.000Z');
      const expected = { id: 1, date };
      mockFindFirst.mockResolvedValue(expected);

      const result = await dailyClosureRepository.findByDate(date);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve undefined si no hay cierre para la fecha', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await dailyClosureRepository.findByDate(new Date());

      expect(result).toBeUndefined();
    });
  });

  describe('findByDateRange', () => {
    test('devuelve los cierres diarios en un rango', async () => {
      const start = new Date('2026-08-01T00:00:00.000Z');
      const end = new Date('2026-08-07T23:59:59.000Z');
      const expected = [{ id: 1 }, { id: 2 }];
      mockFindMany.mockResolvedValue(expected);

      const result = await dailyClosureRepository.findByDateRange(start, end);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          orderBy: expect.anything(),
        })
      );
    });

    test('devuelve un array vacío si no hay cierres en el rango', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await dailyClosureRepository.findByDateRange(
        new Date(),
        new Date()
      );

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    test('crea un cierre diario y devuelve el registro', async () => {
      const data = {
        date: new Date('2026-08-01T00:00:00.000Z'),
        total: 10000,
        cashTotal: 7000,
        transferTotal: 3000,
        totalSales: 25,
        productsSummary: '{}',
        criticalSuppliesSummary: '{}',
      };
      const expected = { id: 1, ...data };
      mockReturning.mockResolvedValue([expected]);

      const result = await dailyClosureRepository.create(data);

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(data);
    });

    test('devuelve undefined si la inserción no devuelve filas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await dailyClosureRepository.create({
        date: new Date(),
        total: 0,
        cashTotal: 0,
        transferTotal: 0,
        totalSales: 0,
        productsSummary: '{}',
        criticalSuppliesSummary: '{}',
      });

      expect(result).toBeUndefined();
    });
  });
});
