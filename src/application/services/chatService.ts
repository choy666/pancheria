import { executeInTransaction } from '@/application/transactionService';
import * as orderRepository from '@/repositories/orderRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as branchService from '@/application/services/branchService';
import { orderMessages } from '@/db/schema';
import { NotFoundError, ValidationError } from '@/domain/errors';
import {
  getChatMaxTextLength,
  getChatImageMaxSizeBytes,
  getChatAllowedImageMimeTypes,
} from '@/config/chat';
import type {
  OrderMessage,
  OrderMessageSenderType,
  OrderStatus,
  OrderWithItems,
} from '@/domain/types';

interface ChatAttachmentInput {
  url: string;
  key?: string | null;
  mimeType: string;
  size: number;
  name: string;
}

interface SendMessageInput {
  content?: string | null;
  attachment?: ChatAttachmentInput | null;
  senderName?: string | null;
}

export interface ChatContext {
  orderNumber: string;
  branchName: string | null;
  status: OrderWithItems['status'];
  customerName: string;
  messages: OrderMessage[];
}

function sanitizeContent(content: unknown): string | null {
  if (content === undefined || content === null) return null;
  const text = String(content).trim();
  if (!text) return null;
  const maxLength = getChatMaxTextLength();
  return text.slice(0, maxLength);
}

function validateAttachment(attachment: ChatAttachmentInput): void {
  if (!getChatAllowedImageMimeTypes().includes(attachment.mimeType)) {
    throw new ValidationError('El tipo de archivo no está permitido.');
  }

  if (attachment.size > getChatImageMaxSizeBytes()) {
    throw new ValidationError('El archivo excede el tamaño máximo permitido.');
  }

  if (!attachment.url.trim()) {
    throw new ValidationError('La URL del adjunto no es válida.');
  }
}

function normalizeMessageValues(
  orderId: number,
  senderType: OrderMessageSenderType,
  input: SendMessageInput
): typeof orderMessages.$inferInsert {
  const content = sanitizeContent(input.content);
  const attachment = input.attachment ?? null;

  if (!content && !attachment) {
    throw new ValidationError('El mensaje no puede estar vacío.');
  }

  if (attachment) {
    validateAttachment(attachment);
  }

  return {
    orderId,
    senderType,
    senderName: input.senderName?.trim() || null,
    content,
    attachmentUrl: attachment?.url ?? null,
    attachmentKey: attachment?.key ?? null,
    attachmentMimeType: attachment?.mimeType ?? null,
    attachmentSize: attachment?.size ?? null,
    attachmentName: attachment?.name ?? null,
  };
}

export async function getChatContext(
  orderId: number,
  token: string
): Promise<ChatContext> {
  const order = await orderRepository.findByIdWithToken(orderId, token);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  const branch = await branchService.getBranchById(order.branchId);
  const messages = await orderMessageRepository.findByOrderId(orderId);

  return {
    orderNumber: order.orderNumber,
    branchName: branch?.name ?? null,
    status: order.status,
    customerName: order.customerName,
    messages,
  };
}

export interface ChatMessagesResult {
  messages: OrderMessage[];
  status: OrderStatus;
}

export async function listClientMessages(
  orderId: number,
  token: string
): Promise<ChatMessagesResult> {
  const order = await orderRepository.findByIdWithToken(orderId, token);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  const messages = await orderMessageRepository.findByOrderId(orderId);

  return { messages, status: order.status };
}

export async function listOperatorMessages(
  orderId: number,
  branchId: number
): Promise<ChatMessagesResult> {
  const order = await orderRepository.findById(branchId, orderId);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  const messages = await orderMessageRepository.findByOrderId(orderId);

  return { messages, status: order.status };
}

export async function sendClientMessage(
  orderId: number,
  token: string,
  input: SendMessageInput
): Promise<OrderMessage> {
  return executeInTransaction(async (tx) => {
    const order = await orderRepository.findByIdWithTokenForUpdate(
      tx,
      orderId,
      token
    );

    if (!order) {
      throw new NotFoundError('Pedido', orderId);
    }

    if (order.status !== 'pending') {
      throw new ValidationError(
        'El pedido no está pendiente, no se pueden enviar mensajes.'
      );
    }

    const values = normalizeMessageValues(orderId, 'client', input);
    return orderMessageRepository.insertMessage(tx, values);
  });
}

export async function sendOperatorMessage(
  orderId: number,
  branchId: number,
  input: SendMessageInput
): Promise<OrderMessage> {
  return executeInTransaction(async (tx) => {
    const order = await orderRepository.findByIdForUpdate(
      tx,
      branchId,
      orderId
    );

    if (!order) {
      throw new NotFoundError('Pedido', orderId);
    }

    if (order.status !== 'pending') {
      throw new ValidationError(
        'El pedido no está pendiente, no se pueden enviar mensajes.'
      );
    }

    const values = normalizeMessageValues(orderId, 'operator', input);
    return orderMessageRepository.insertMessage(tx, values);
  });
}

export async function markClientMessagesAsRead(
  orderId: number,
  token: string
): Promise<number> {
  const order = await orderRepository.findByIdWithToken(orderId, token);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  return orderMessageRepository.markAllAsReadByOrderAndSender(
    orderId,
    'operator'
  );
}

export async function markOperatorMessagesAsRead(
  orderId: number,
  branchId: number
): Promise<number> {
  const order = await orderRepository.findById(branchId, orderId);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  return orderMessageRepository.markAllAsReadByOrderAndSender(orderId, 'client');
}
