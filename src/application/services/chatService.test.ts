import {
  sendClientMessage,
  sendOperatorMessage,
  listClientMessages,
  listOperatorMessages,
  markClientMessagesAsRead,
  markOperatorMessagesAsRead,
  getOrderChatStatus,
} from './chatService';
import { executeInTransaction } from '@/application/transactionService';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as orderRepository from '@/repositories/orderRepository';
import * as branchService from './branchService';
import { NotFoundError, ValidationError } from '@/domain/errors';
import type { OrderMessage, Order } from '@/domain/types';

jest.mock('@/repositories/orderMessageRepository');
jest.mock('@/repositories/orderRepository');
jest.mock('./branchService');
jest.mock('@/application/transactionService', () => ({
  executeInTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
}));

const mockedExecuteInTransaction =
  executeInTransaction as jest.MockedFunction<typeof executeInTransaction>;
const mockedOrderMessageRepository =
  orderMessageRepository as jest.Mocked<typeof orderMessageRepository>;
const mockedOrderRepository =
  orderRepository as jest.Mocked<typeof orderRepository>;
const mockedBranchService =
  branchService as jest.Mocked<typeof branchService>;

const BRANCH_ID = 1;
const ORDER_ID = 10;
const TOKEN = 'valid-token';

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    branchId: BRANCH_ID,
    orderNumber: 'PED-1-TEST',
    status: 'pending',
    customerName: 'Juan',
    customerPhone: '3415555555',
    deliveryType: 'pickup',
    address: null,
    notes: null,
    total: 1200,
    idempotencyKey: null,
    cancellationToken: TOKEN,
    cancellationReason: null,
    cancelledAt: null,
    convertedSaleId: null,
    createdAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Order;
}

function buildMessage(overrides: Partial<OrderMessage> = {}): OrderMessage {
  return {
    id: 1,
    orderId: ORDER_ID,
    senderType: 'client',
    senderName: null,
    content: 'Hola',
    deliveredAt: null,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  } as OrderMessage;
}

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedOrderMessageRepository.countByOrderId.mockResolvedValue(1);
  });

  describe('sendClientMessage', () => {
    test('envía un mensaje del cliente cuando el pedido está pendiente', async () => {
      mockedOrderRepository.findByIdWithTokenForUpdate.mockResolvedValue(
        buildOrder()
      );
      mockedOrderMessageRepository.insertMessage.mockResolvedValue(buildMessage());

      const result = await sendClientMessage(ORDER_ID, TOKEN, { content: 'Hola' });

      expect(result.content).toBe('Hola');
      expect(mockedOrderRepository.findByIdWithTokenForUpdate).toHaveBeenCalledWith(
        expect.anything(),
        ORDER_ID,
        TOKEN
      );
      expect(mockedOrderMessageRepository.insertMessage).toHaveBeenCalled();
    });

    test('rechaza un pedido no pendiente', async () => {
      mockedOrderRepository.findByIdWithTokenForUpdate.mockResolvedValue(
        buildOrder({ status: 'cancelled' })
      );

      await expect(
        sendClientMessage(ORDER_ID, TOKEN, { content: 'Hola' })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza un token inválido', async () => {
      mockedOrderRepository.findByIdWithTokenForUpdate.mockResolvedValue(undefined);

      await expect(
        sendClientMessage(ORDER_ID, 'wrong-token', { content: 'Hola' })
      ).rejects.toThrow(NotFoundError);
    });

    test('rechaza contenido vacío', async () => {
      mockedOrderRepository.findByIdWithTokenForUpdate.mockResolvedValue(buildOrder());

      await expect(
        sendClientMessage(ORDER_ID, TOKEN, { content: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza un pedido vencido', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
      mockedOrderRepository.findByIdWithTokenForUpdate.mockResolvedValue(
        buildOrder({ createdAt: twoHoursAgo })
      );

      await expect(
        sendClientMessage(ORDER_ID, TOKEN, { content: 'Hola' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('sendOperatorMessage', () => {
    test('envía un mensaje del operador cuando el pedido está pendiente', async () => {
      mockedOrderRepository.findByIdForUpdate.mockResolvedValue(buildOrder());
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal A',
      } as any);
      mockedOrderMessageRepository.insertMessage.mockResolvedValue(
        buildMessage({ senderType: 'operator', senderName: 'Juan' })
      );

      const result = await sendOperatorMessage(ORDER_ID, BRANCH_ID, {
        content: 'Confirmado',
        senderName: 'Juan',
      });

      expect(result.senderType).toBe('operator');
      expect(result.senderName).toBe('Juan');
      expect(mockedOrderRepository.findByIdForUpdate).toHaveBeenCalledWith(
        expect.anything(),
        BRANCH_ID,
        ORDER_ID
      );
    });

    test('rechaza un pedido de otra sucursal', async () => {
      mockedOrderRepository.findByIdForUpdate.mockResolvedValue(undefined);

      await expect(
        sendOperatorMessage(ORDER_ID, BRANCH_ID, { content: 'Hola' })
      ).rejects.toThrow(NotFoundError);
    });

    test('rechaza un pedido vencido', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
      mockedOrderRepository.findByIdForUpdate.mockResolvedValue(
        buildOrder({ createdAt: twoHoursAgo })
      );

      await expect(
        sendOperatorMessage(ORDER_ID, BRANCH_ID, { content: 'Hola' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listClientMessages', () => {
    beforeEach(() => {
      mockedOrderMessageRepository.markAllAsDeliveredByOrderAndSender.mockResolvedValue(0);
    });

    test('devuelve mensajes, estado, total, hasMore y expiresAt del cliente autenticado', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(buildOrder());
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([buildMessage()]);

      const result = await listClientMessages(ORDER_ID, TOKEN);

      expect(result.messages).toHaveLength(1);
      expect(result.status).toBe('pending');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.expiresAt).toBeDefined();
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(result.isExpired).toBe(false);
      expect(mockedOrderRepository.findByIdWithToken).toHaveBeenCalledWith(
        ORDER_ID,
        TOKEN
      );
      expect(mockedOrderMessageRepository.findByOrderId).toHaveBeenCalledWith(
        ORDER_ID,
        expect.any(Object)
      );
      expect(mockedOrderMessageRepository.countByOrderId).toHaveBeenCalledWith(
        ORDER_ID
      );
    });

    test('rechaza un token inválido', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(undefined);

      await expect(
        listClientMessages(ORDER_ID, 'wrong-token')
      ).rejects.toThrow(NotFoundError);
    });

    test('pasa opciones de paginación al repositorio', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(buildOrder());
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([buildMessage()]);

      await listClientMessages(ORDER_ID, TOKEN, { before: 5, limit: 20 });

      expect(mockedOrderMessageRepository.findByOrderId).toHaveBeenCalledWith(
        ORDER_ID,
        expect.objectContaining({ before: 5, limit: 21 })
      );
    });

    test('marca como entregados los mensajes del operador no entregados', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(buildOrder());
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([
        buildMessage({ id: 1, senderType: 'operator', deliveredAt: null }),
      ]);

      const result = await listClientMessages(ORDER_ID, TOKEN);

      expect(result.messages[0].deliveredAt).not.toBeNull();
      expect(
        mockedOrderMessageRepository.markAllAsDeliveredByOrderAndSender
      ).toHaveBeenCalledWith(ORDER_ID, 'operator');
    });

    test('no marca como entregados los mensajes propios del cliente', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(buildOrder());
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([
        buildMessage({ id: 1, senderType: 'client', deliveredAt: null }),
      ]);

      const result = await listClientMessages(ORDER_ID, TOKEN);

      expect(result.messages[0].deliveredAt).toBeNull();
      expect(
        mockedOrderMessageRepository.markAllAsDeliveredByOrderAndSender
      ).not.toHaveBeenCalled();
    });
  });

  describe('listOperatorMessages', () => {
    test('devuelve mensajes, estado, total, hasMore y expiresAt del operador autenticado', async () => {
      mockedOrderRepository.findById.mockResolvedValue(buildOrder() as any);
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([buildMessage()]);

      const result = await listOperatorMessages(ORDER_ID, BRANCH_ID);

      expect(result.messages).toHaveLength(1);
      expect(result.status).toBe('pending');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.expiresAt).toBeDefined();
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(result.isExpired).toBe(false);
      expect(mockedOrderRepository.findById).toHaveBeenCalledWith(
        BRANCH_ID,
        ORDER_ID
      );
    });

    test('marca como entregados los mensajes del cliente no entregados', async () => {
      mockedOrderRepository.findById.mockResolvedValue(buildOrder() as any);
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([
        buildMessage({ id: 1, senderType: 'client', deliveredAt: null }),
      ]);

      const result = await listOperatorMessages(ORDER_ID, BRANCH_ID);

      expect(result.messages[0].deliveredAt).not.toBeNull();
      expect(
        mockedOrderMessageRepository.markAllAsDeliveredByOrderAndSender
      ).toHaveBeenCalledWith(ORDER_ID, 'client');
    });
  });

  describe('markClientMessagesAsRead', () => {
    test('marca mensajes del operador como leídos', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(buildOrder());
      mockedOrderMessageRepository.markAllAsReadByOrderAndSender.mockResolvedValue(1);

      const result = await markClientMessagesAsRead(ORDER_ID, TOKEN);

      expect(result).toBe(1);
      expect(
        mockedOrderMessageRepository.markAllAsReadByOrderAndSender
      ).toHaveBeenCalledWith(ORDER_ID, 'operator');
    });
  });

  describe('markOperatorMessagesAsRead', () => {
    test('marca mensajes del cliente como leídos', async () => {
      mockedOrderRepository.findById.mockResolvedValue(buildOrder() as any);
      mockedOrderMessageRepository.markAllAsReadByOrderAndSender.mockResolvedValue(2);

      const result = await markOperatorMessagesAsRead(ORDER_ID, BRANCH_ID);

      expect(result).toBe(2);
      expect(
        mockedOrderMessageRepository.markAllAsReadByOrderAndSender
      ).toHaveBeenCalledWith(ORDER_ID, 'client');
    });
  });

  describe('getOrderChatStatus', () => {
    test('devuelve el estado, la expiración y si venció del pedido', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(
        buildOrder({ createdAt })
      );

      const result = await getOrderChatStatus(ORDER_ID, TOKEN);

      expect(result.status).toBe('pending');
      expect(result.expiresAt).toContain('2026-01-01T01:00:00');
      expect(result.isExpired).toBe(true);
      expect(mockedOrderRepository.findByIdWithToken).toHaveBeenCalledWith(
        ORDER_ID,
        TOKEN
      );
    });

    test('rechaza un token inválido', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(undefined);

      await expect(getOrderChatStatus(ORDER_ID, 'wrong-token')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
