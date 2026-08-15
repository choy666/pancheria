/**
 * Configuración pública del catálogo. Estos valores se leen de variables de
 * entorno con prefijo NEXT_PUBLIC_* para que estén disponibles en el cliente.
 *
 * No acceder a la base de datos desde este archivo.
 */

export function getWhatsAppNumber(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';
  const cleaned = raw.replace(/\s/g, '').replace(/^\+/, '');

  if (!cleaned) {
    throw new Error(
      'NEXT_PUBLIC_WHATSAPP_NUMBER no está configurado. Incluí el número completo con código de país, sin signo + ni espacios.'
    );
  }

  if (!/^\d+$/.test(cleaned)) {
    throw new Error(
      `NEXT_PUBLIC_WHATSAPP_NUMBER contiene caracteres no numéricos: "${raw}".`
    );
  }

  return cleaned;
}

export interface WhatsAppMessageParts {
  greeting: string;
  closing: string;
}

export function getWhatsAppMessageParts(): WhatsAppMessageParts {
  return {
    greeting:
      process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING?.trim() ||
      'Hola, quiero hacer el siguiente pedido:',
    closing:
      process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING?.trim() ||
      'Me confirmás el total y el medio de pago. Gracias.',
  };
}

export function getPedidoRefetchIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS;
  if (!raw) return 30_000;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 1_000) return 30_000;

  return parsed;
}
