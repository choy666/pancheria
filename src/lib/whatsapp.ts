import { moneyToNumber, parseMoney } from '@/lib/money';

export interface PublicOrderItem {
  productId: number;
  name: string;
  price: number;
  unit: string;
  quantity: number;
}

export interface PublicOrder {
  items: PublicOrderItem[];
  customerName: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string;
  notes?: string;
  total: number;
  orderNumber?: string;
  branchName?: string;
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

  parts.push(...lines, `Total: $${total.toFixed(2)}`, `Cliente: ${order.customerName}`, `Entrega: ${deliveryLabel}`);

  if (order.branchName) {
    parts.push(`Sucursal: ${order.branchName}`);
  }

  if (order.deliveryType === 'delivery' && order.address) {
    parts.push(`Dirección: ${order.address}`);
  }

  if (order.notes) {
    parts.push(`Notas: ${order.notes}`);
  }

  return parts.join('\n');
}

export function encodeWhatsAppUrl(phone: string, message: string): string {
  const cleanedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
}
