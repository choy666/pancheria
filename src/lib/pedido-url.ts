import { routes } from '@/config/routes';

/**
 * URL pública de `/pedido` pineada a una sucursal: la que codifican los QR
 * de las pantallas kiosk (`/pantalla`, `/menu`). Usa `NEXT_PUBLIC_APP_URL`
 * cuando está configurada (dominio público alcanzable por teléfonos) y cae
 * al origen que sirve la propia pantalla.
 */
export function getPedidoUrl(branchId: number): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${baseUrl}${routes.pedido}?branchId=${branchId}`;
}
