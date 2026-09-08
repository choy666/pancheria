/**
 * Mensajes de error para el flujo público de pedidos (`/pedido`).
 *
 * El API puede devolver textos con jerga interna de gestión de stock
 * (por ejemplo `Stock insuficiente para X (insumo: Y). Disponible: N,
 * solicitado: M.`). El cliente nunca debe ver nombres de insumos ni
 * cantidades internas, así que estos mensajes se reescriben antes de
 * mostrarlos en la UI pública.
 */

const PUBLIC_SHORTAGE_MESSAGE =
  'No hay suficiente {producto} por el momento. Probá bajar la cantidad o elegí otra opción.';

const PUBLIC_GENERIC_ERROR =
  'No pudimos procesar tu pedido. Revisá los productos y probá de nuevo.';

/**
 * Extrae el nombre del producto de un mensaje de stock insuficiente con el
 * formato `Stock insuficiente para {producto} (insumo: ...). Disponible: ...`.
 */
const INSUFFICIENT_STOCK_PATTERN =
  /^Stock insuficiente para\s+(.+?)(?:\s*\(insumo:|\.\s*Disponible:|$)/i;

/** Términos internos que no deben mostrarse al cliente. */
const INTERNAL_TERMS_PATTERN =
  /insumo|stock|receta|operador|supply|disponible:|solicitado|requerido/i;

export function publicShortageMessage(productName?: string | null): string {
  return PUBLIC_SHORTAGE_MESSAGE.replace(
    '{producto}',
    productName?.trim() || 'ese producto'
  );
}

/**
 * Convierte un error del backend en un texto amigable y sin datos internos
 * para el cliente. Acepta un `Error` (para leer `code`/`productName` cuando
 * la ruta devuelve un error estructurado) o un mensaje plano como fallback.
 * Si el mensaje ya es seguro, se devuelve igual.
 */
export function toPublicErrorMessage(error: string | Error): string {
  const message = typeof error === 'string' ? error : error.message;
  const code =
    typeof error === 'object' && 'code' in error
      ? (error as { code?: string }).code
      : undefined;
  const productName =
    typeof error === 'object' && 'productName' in error
      ? (error as { productName?: string }).productName
      : undefined;

  if (code === 'INSUFFICIENT_STOCK') {
    return publicShortageMessage(productName);
  }

  const stockMatch = message.match(INSUFFICIENT_STOCK_PATTERN);
  if (stockMatch) {
    return publicShortageMessage(stockMatch[1]);
  }

  if (INTERNAL_TERMS_PATTERN.test(message)) {
    return PUBLIC_GENERIC_ERROR;
  }

  return message;
}
