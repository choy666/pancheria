import * as orderMessageRepository from './orderMessageRepository';
import { orderMessages } from '@/db/schema';


var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockWhereReturning: jest.Mock;
var mockSet: jest.Mock;
var mockUpdate: jest.Mock;
var mockWhere: jest.Mock;
var mockFrom: jest.Mock;
var mockSelect: jest.Mock;

jest.mock('@/db', () => {
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockWhereReturning = jest.fn(() => ({ returning: mockReturning }));
  mockSet = jest.fn(() => ({ where: mockWhereReturning }));
  mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockWhere = jest.fn().mockResolvedValue([{ count: 5 }]);
  mockFrom = jest.fn(() => ({ where: mockWhere }));
  mockSelect = jest.fn(() => ({ from: mockFrom }));

  return {
    db: {
      query: {
        orderMessages: { findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
    },
  };
});

const ORDER_ID = 10;

function buildMessage(
  overrides: Partial<typeof orderMessages.$inferSelect> = {}
): typeof orderMessages.$inferSelect {
  return {
    id: 1,
    orderId: ORDER_ID,
    senderType: 'client',
    senderName: null,
    content: 'Hola',
    deliveredAt: null,
    readAt: null,
    createdAt: new Date(),
    attachmentUrl: null,
    attachmentMimeType: null,
    attachmentSize: null,
    attachmentName: null,
    ...overrides,
  } as typeof orderMessages.$inferSelect;
}

describe('orderMessageRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findByOrderId', () => {
    test('devuelve mensajes ordenados con limit y offset por defecto', async () => {
      mockFindMany.mockResolvedValue([buildMessage()]);

      const result = await orderMessageRepository.findByOrderId(ORDER_ID);

      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 0,
        })
      );
    });

    test('respeta limit y offset personalizados', async () => {
      mockFindMany.mockResolvedValue([]);

      await orderMessageRepository.findByOrderId(ORDER_ID, { limit: 20, offset: 40 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 40,
        })
      );
    });

    test('ordena ascendente por id cuando se consulta after', async () => {
      mockFindMany.mockResolvedValue([buildMessage({ id: 5 })]);

      const result = await orderMessageRepository.findByOrderId(ORDER_ID, {
        after: 3,
        limit: 10,
      });

      expect(result[0].id).toBe(5);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    test('invierte el resultado cuando se consulta before', async () => {
      mockFindMany.mockResolvedValue([buildMessage({ id: 2 }), buildMessage({ id: 1 })]);

      const result = await orderMessageRepository.findByOrderId(ORDER_ID, {
        before: 5,
        limit: 10,
      });

      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });
  });

  describe('countByOrderId', () => {
    test('devuelve la cantidad de mensajes del pedido', async () => {
      const result = await orderMessageRepository.countByOrderId(ORDER_ID);

      expect(result).toBe(5);
      expect(mockSelect).toHaveBeenCalledWith(expect.any(Object));
      expect(mockFrom).toHaveBeenCalledWith(orderMessages);
    });
  });

  describe('insertMessage', () => {
    test('inserta un mensaje y devuelve el registro', async () => {
      const message = buildMessage();
      mockReturning.mockResolvedValue([message]);

      const tx: any = { insert: mockInsert };
      const result = await orderMessageRepository.insertMessage(tx, {
        orderId: ORDER_ID,
        senderType: 'client',
        content: 'Hola',
      });

      expect(result).toEqual(message);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: ORDER_ID,
          senderType: 'client',
          content: 'Hola',
        })
      );
    });

    test('lanza error si no se pudo crear el mensaje', async () => {
      mockReturning.mockResolvedValue([]);

      const tx: any = { insert: mockInsert };
      await expect(
        orderMessageRepository.insertMessage(tx, {
          orderId: ORDER_ID,
          senderType: 'client',
          content: 'Hola',
        })
      ).rejects.toThrow('No se pudo crear el mensaje.');
    });
  });

  describe('markAllAsReadByOrderAndSender', () => {
    test('marca mensajes como leídos y devuelve la cantidad', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await orderMessageRepository.markAllAsReadByOrderAndSender(
        ORDER_ID,
        'client'
      );

      expect(result).toBe(2);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ readAt: expect.any(Date) }));
    });
  });

  describe('markAllAsDeliveredByOrderAndSender', () => {
    test('marca mensajes como entregados y devuelve la cantidad', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      const result =
        await orderMessageRepository.markAllAsDeliveredByOrderAndSender(
          ORDER_ID,
          'operator'
        );

      expect(result).toBe(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ deliveredAt: expect.any(Date) })
      );
    });
  });
});
