import {
  sendClientMessage,
  sendOperatorMessage,
  listClientMessages,
  listOperatorMessages,
  markClientMessagesAsRead,
  markOperatorMessagesAsRead,
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
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  } as OrderMessage;
}

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendClientMessage', () => {
    test('envía un mensaje del cliente cuando el pedido está pendiente', async () => {
      mockedOrderRepository.findByIdWithTokenForUpdate.mockResolvedValue(buildOrder());
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
  });

  describe('listClientMessages', () => {
    test('devuelve mensajes y estado del cliente autenticado', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(buildOrder());
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([buildMessage()]);

      const result = await listClientMessages(ORDER_ID, TOKEN);

      expect(result.messages).toHaveLength(1);
      expect(result.status).toBe('pending');
      expect(mockedOrderRepository.findByIdWithToken).toHaveBeenCalledWith(
        ORDER_ID,
        TOKEN
      );
      expect(mockedOrderMessageRepository.findByOrderId).toHaveBeenCalledWith(
        ORDER_ID
      );
    });

    test('rechaza un token inválido', async () => {
      mockedOrderRepository.findByIdWithToken.mockResolvedValue(undefined);

      await expect(
        listClientMessages(ORDER_ID, 'wrong-token')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listOperatorMessages', () => {
    test('devuelve mensajes y estado del operador autenticado', async () => {
      mockedOrderRepository.findById.mockResolvedValue(buildOrder() as any);
      mockedOrderMessageRepository.findByOrderId.mockResolvedValue([buildMessage()]);

      const result = await listOperatorMessages(ORDER_ID, BRANCH_ID);

      expect(result.messages).toHaveLength(1);
      expect(result.status).toBe('pending');
      expect(mockedOrderRepository.findById).toHaveBeenCalledWith(
        BRANCH_ID,
        ORDER_ID
      );
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
});
