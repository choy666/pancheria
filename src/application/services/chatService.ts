import { executeInTransaction } from '@/application/transactionService';
import * as orderRepository from '@/repositories/orderRepository';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as branchService from '@/application/services/branchService';
import { orderMessages } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import { getOrderExpirationMs } from '@/config/orders';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { isValidLocationUrl, tryBuildLocationUrl } from '@/lib/maps';
import {
  getChatMaxTextLength,
  getChatImageMaxSizeBytes,
  getChatAllowedImageMimeTypes,
  getChatPageSize,
} from '@/config/chat';
import type {
  BranchPhone,
  BranchSocialLink,
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

export interface FindMessagesOptions {
  limit?: number;
  before?: number;
  after?: number;
}

export interface ChatContext {
  orderNumber: string;
  branchName: string | null;
  status: OrderWithItems['status'];
  customerName: string;
  deliveryType: OrderWithItems['deliveryType'];
  branchLocation: string | null;
  /** Contactos públicos de la sucursal para mostrar en el encabezado del chat. */
  branchPhones: BranchPhone[];
  branchSocialLinks: BranchSocialLink[];
  messages: OrderMessage[];
  total: number;
  hasMore: boolean;
  expiresAt: string;
  isExpired: boolean;
}

export interface ChatMessagesResult {
  messages: OrderMessage[];
  status: OrderStatus;
  deliveryType: OrderWithItems['deliveryType'];
  branchLocation: string | null;
  total: number;
  hasMore: boolean;
  expiresAt: string;
  isExpired: boolean;
}

export interface ChatStatusResult {
  status: OrderStatus;
  expiresAt: string;
  isExpired: boolean;
}

function getOrderExpiresAt(order: { createdAt: Date }): string {
  return new Date(order.createdAt.getTime() + getOrderExpirationMs()).toISOString();
}

function isOrderExpired(order: { createdAt: Date }): boolean {
  return order.createdAt.getTime() + getOrderExpirationMs() < Date.now();
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
  token: string,
  options: FindMessagesOptions = {}
): Promise<ChatContext> {
  const order = await orderRepository.findByIdWithToken(orderId, token);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  const branch = await branchService.getBranchById(order.branchId);
  const [messages, total] = await Promise.all([
    orderMessageRepository.findByOrderId(orderId, {
      limit: options.limit ?? getChatPageSize(),
      after: options.after,
      before: options.before,
    }),
    orderMessageRepository.countByOrderId(orderId),
  ]);

  return {
    orderNumber: order.orderNumber,
    branchName: branch?.name ?? null,
    status: order.status,
    customerName: order.customerName,
    deliveryType: order.deliveryType,
    branchLocation: branch?.location ?? null,
    branchPhones: branch?.phones ?? [],
    branchSocialLinks: branch?.socialLinks ?? [],
    messages,
    total,
    hasMore: messages.length < total,
    expiresAt: getOrderExpiresAt(order),
    isExpired: isOrderExpired(order),
  };
}

async function listMessages(
  orderId: number,
  options: FindMessagesOptions = {}
): Promise<{
  rows: OrderMessage[];
  hasMore: boolean;
}> {
  const pageSize = options.limit ?? getChatPageSize();

  if (options.before !== undefined) {
    const rows = await orderMessageRepository.findByOrderId(orderId, {
      before: options.before,
      limit: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    return { rows: rows.slice(rows.length > pageSize ? 1 : 0), hasMore };
  }

  const rows = await orderMessageRepository.findByOrderId(orderId, {
    after: options.after,
    limit: pageSize,
  });

  return { rows, hasMore: options.after !== undefined ? rows.length === pageSize : false };
}

async function markMessagesAsDelivered(
  orderId: number,
  senderType: OrderMessageSenderType,
  messages: OrderMessage[]
): Promise<OrderMessage[]> {
  const hasUndelivered = messages.some(
    (message) => message.senderType === senderType && !message.deliveredAt
  );

  if (!hasUndelivered) {
    return messages;
  }

  await orderMessageRepository.markAllAsDeliveredByOrderAndSender(
    orderId,
    senderType
  );

  const now = nowUTC();
  return messages.map((message) =>
    message.senderType === senderType && !message.deliveredAt
      ? { ...message, deliveredAt: now }
      : message
  );
}

export async function listClientMessages(
  orderId: number,
  token: string,
  options: FindMessagesOptions = {}
): Promise<ChatMessagesResult> {
  const order = await orderRepository.findByIdWithToken(orderId, token);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  const [branch, { rows: messages, hasMore }, total] = await Promise.all([
    branchService.getBranchById(order.branchId),
    listMessages(orderId, options),
    orderMessageRepository.countByOrderId(orderId),
  ]);

  const updatedMessages = await markMessagesAsDelivered(
    orderId,
    'operator',
    messages
  );

  return {
    messages: updatedMessages,
    status: order.status,
    deliveryType: order.deliveryType,
    branchLocation: branch?.location ?? null,
    total,
    hasMore,
    expiresAt: getOrderExpiresAt(order),
    isExpired: isOrderExpired(order),
  };
}

export async function listOperatorMessages(
  orderId: number,
  branchId: number,
  options: FindMessagesOptions = {}
): Promise<ChatMessagesResult> {
  const order = await orderRepository.findById(branchId, orderId);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  const [{ rows: messages, hasMore }, total] = await Promise.all([
    listMessages(orderId, options),
    orderMessageRepository.countByOrderId(orderId),
  ]);

  const updatedMessages = await markMessagesAsDelivered(
    orderId,
    'client',
    messages
  );

  return {
    messages: updatedMessages,
    status: order.status,
    deliveryType: order.deliveryType,
    branchLocation: order.branch?.location ?? null,
    total,
    hasMore,
    expiresAt: getOrderExpiresAt(order),
    isExpired: isOrderExpired(order),
  };
}

export interface ChatStreamState {
  status: OrderStatus;
  deliveryType: OrderWithItems['deliveryType'];
  branchLocation: string | null;
  isExpired: boolean;
  expiresAt: string;
}

export interface ChatStreamTick {
  messages: OrderMessage[];
  status: OrderStatus;
  isExpired: boolean;
}

/**
 * Estado inicial del stream SSE de chat. Devuelve `null` si el pedido no
 * existe o no pertenece al scope (`branchId` del operador o `token` del
 * cliente). Incluye `branchLocation`, que es estático por pedido.
 */
export async function getChatStreamState(
  orderId: number,
  scope: { branchId: number } | { token: string }
): Promise<ChatStreamState | null> {
  const order = await orderRepository.findChatStreamState(orderId, scope);

  if (!order) {
    return null;
  }

  const branch = await branchService.getBranchById(order.branchId);

  return {
    status: order.status,
    deliveryType: order.deliveryType,
    branchLocation: branch?.location ?? null,
    isExpired: isOrderExpired(order),
    expiresAt: getOrderExpiresAt(order),
  };
}

/**
 * Tick del poll interno del stream SSE: una query ligera de estado + la query
 * indexada de mensajes nuevos (`after` = cursor). Solo escribe en la base
 * cuando llegan mensajes del otro emisor aún sin `deliveredAt` — a diferencia
 * del polling REST, que escribe en cada poll aunque no haya novedades.
 * Devuelve `null` si el pedido dejó de pertenecer al scope (p. ej. borrado):
 * la ruta debe cerrar el stream.
 */
export async function pollChatStreamTick(
  orderId: number,
  scope: { branchId: number } | { token: string },
  deliveredSender: OrderMessageSenderType,
  cursor: number
): Promise<ChatStreamTick | null> {
  const [order, messages] = await Promise.all([
    orderRepository.findChatStreamState(orderId, scope),
    orderMessageRepository.findByOrderId(orderId, {
      after: cursor,
      limit: getChatPageSize(),
    }),
  ]);

  if (!order) {
    return null;
  }

  const updatedMessages = await markMessagesAsDelivered(
    orderId,
    deliveredSender,
    messages
  );

  return {
    messages: updatedMessages,
    status: order.status,
    isExpired: isOrderExpired(order),
  };
}

export async function getOrderChatStatus(
  orderId: number,
  token: string
): Promise<ChatStatusResult> {
  const order = await orderRepository.findByIdWithToken(orderId, token);

  if (!order) {
    throw new NotFoundError('Pedido', orderId);
  }

  return {
    status: order.status,
    expiresAt: getOrderExpiresAt(order),
    isExpired: isOrderExpired(order),
  };
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

    if (order.status === 'finished' || order.status === 'cancelled') {
      throw new ValidationError(
        'El pedido está finalizado o cancelado, no se pueden enviar mensajes.'
      );
    }

    if (isOrderExpired(order)) {
      throw new ValidationError('El pedido expiró, no se pueden enviar mensajes.');
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

    if (order.status === 'finished' || order.status === 'cancelled') {
      throw new ValidationError(
        'El pedido está finalizado o cancelado, no se pueden enviar mensajes.'
      );
    }

    if (isOrderExpired(order)) {
      throw new ValidationError('El pedido expiró, no se pueden enviar mensajes.');
    }

    const values = normalizeMessageValues(orderId, 'operator', input);
    return orderMessageRepository.insertMessage(tx, values);
  });
}

export async function sendBranchLocationMessage(
  orderId: number,
  branchId: number,
  senderName?: string | null
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

    if (order.status === 'finished' || order.status === 'cancelled') {
      throw new ValidationError(
        'El pedido está finalizado o cancelado, no se pueden enviar mensajes.'
      );
    }

    if (isOrderExpired(order)) {
      throw new ValidationError('El pedido expiró, no se pueden enviar mensajes.');
    }

    if (order.deliveryType !== 'pickup') {
      throw new ValidationError(
        'La ubicación de la sucursal solo puede compartirse en pedidos de retiro.'
      );
    }

    const branch = await branchService.getBranchById(order.branchId);
    const rawLocation = branch?.location?.trim();

    if (!rawLocation) {
      throw new ValidationError('La sucursal no tiene ubicación configurada.');
    }

    const locationUrl = tryBuildLocationUrl(rawLocation);

    if (!locationUrl || !isValidLocationUrl(locationUrl)) {
      throw new ValidationError(
        'La ubicación de la sucursal no es una URL ni coordenadas válidas.'
      );
    }

    const values = normalizeMessageValues(orderId, 'operator', {
      content: locationUrl,
      senderName,
    });
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
