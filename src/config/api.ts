export const PRODUCTOS_API = '/api/productos';
export const RECETAS_API = '/api/recetas';
export const STOCK_API = '/api/stock';
export const STOCK_AJUSTAR_API = '/api/stock/ajustar';
export const STOCK_MOVIMIENTOS_API = '/api/stock/movimientos';
export const VENTAS_API = '/api/ventas';
export const VENTAS_DISPONIBILIDAD_API = '/api/ventas/disponibilidad';
export const PUBLIC_CATALOGO_API = '/api/public/catalogo';
export const PUBLIC_DISPONIBILIDAD_API = '/api/public/disponibilidad';
export const PUBLIC_PEDIDO_API = '/api/public/pedido';
export const PUBLIC_PEDIDO_CANCELAR_API = (orderId: number | string) =>
  `/api/public/pedido/${orderId}/cancelar`;
export const PUBLIC_PEDIDO_CHAT_API = (orderId: number | string) =>
  `/api/public/pedido/${orderId}/chat`;
export const PUBLIC_PEDIDO_CHAT_LEIDO_API = (orderId: number | string) =>
  `/api/public/pedido/${orderId}/chat/leido`;
export const PUBLIC_PEDIDO_CHAT_UPLOAD_API = (orderId: number | string) =>
  `/api/public/pedido/${orderId}/chat/upload`;
export const PEDIDOS_API = '/api/pedidos';
export const PEDIDOS_CONFIRMAR_API = (orderId: number | string) =>
  `/api/pedidos/${orderId}/confirmar`;
export const PEDIDOS_CANCELAR_API = (orderId: number | string) =>
  `/api/pedidos/${orderId}/cancelar`;
export const PEDIDOS_CHAT_API = (orderId: number | string) =>
  `/api/pedidos/${orderId}/chat`;
export const PEDIDOS_CHAT_LEIDO_API = (orderId: number | string) =>
  `/api/pedidos/${orderId}/chat/leido`;
export const PEDIDOS_CHAT_UPLOAD_API = (orderId: number | string) =>
  `/api/pedidos/${orderId}/chat/upload`;
export const CAJA_API = '/api/caja';
export const CAJA_HISTORIAL_API = '/api/caja/historial';
export const CAJA_ELIMINADAS_API = '/api/caja/eliminadas';
export const CIERRE_API = '/api/cierre';
export const CIERRE_HISTORIAL_API = '/api/cierre/historial';
