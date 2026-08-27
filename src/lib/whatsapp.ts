import { moneyToNumber, parseMoney } from '@/lib/money';
import { getWhatsAppNumber, getWhatsAppMessageParts } from '@/config/catalog';
import { getPublicBaseUrl } from '@/lib/public-url';
import { routes } from '@/config/routes';
import { ValidationError } from '@/domain/errors';

export interface PublicOrderItem {
  productId: number;
  name: string;
  price: number;
  unit: string;
  quantity: number;
}

export interface PublicOrder {
  id?: number;
  cancellationToken?: string;
  items: PublicOrderItem[];
  customerName: string;
  customerPhone?: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string;
  notes?: string;
  total: number;
  orderNumber?: string;
  branchName?: string;
}

export function buildChatPublicUrl(
  orderId: number,
  cancellationToken: string
): string {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}${routes.pedidoChat(orderId, cancellationToken)}`;
}

export function buildWhatsAppMessage(order: PublicOrder): string {
  const lines = order.items.map((item) => {
    const subtotal = moneyToNumber(parseMoney(item.price * item.quantity));
    return `- ${item.quantity}x ${item.name} (${item.unit}) — $${subtotal.toFixed(2)}`;
  });

  const total = moneyToNumber(parseMoney(order.total));

  const deliveryLabel =
    order.deliveryType === 'delivery' ? 'Envío a domicilio' : 'Retiro en sucursal';

  const parts: string[] = [];

  if (order.orderNumber) {
    parts.push(`Pedido #${order.orderNumber}`);
  }

  parts.push(...lines, `Total: $${total.toFixed(2)}`, `Cliente: ${order.customerName}`);

  if (order.customerPhone) {
    parts.push(`Teléfono: ${order.customerPhone.trim().replace(/\s/g, '')}`);
  }

  parts.push(`Entrega: ${deliveryLabel}`);

  if (order.branchName) {
    parts.push(`Sucursal: ${order.branchName}`);
  }

  if (order.deliveryType === 'delivery' && order.address) {
    parts.push(`Dirección: ${order.address}`);
  }

  if (order.notes) {
    parts.push(`Notas: ${order.notes}`);
  }

  if (order.id && order.cancellationToken) {
    const chatUrl = buildChatPublicUrl(order.id, order.cancellationToken);
    parts.push(`Seguí tu pedido y chateá con la sucursal: ${chatUrl}`);
  }

  return parts.join('\n');
}

export function encodeWhatsAppUrl(phone: string, message: string): string {
  const cleanedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
}

export function buildWhatsAppUrl(order: PublicOrder): string {
  try {
    const phone = getWhatsAppNumber();
    const { greeting, closing } = getWhatsAppMessageParts();
    const messageBody = buildWhatsAppMessage(order);
    const fullMessage = `${greeting}\n\n${messageBody}\n\n${closing}`;
    return encodeWhatsAppUrl(phone, fullMessage);
  } catch (error) {
    if (error instanceof Error) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}
