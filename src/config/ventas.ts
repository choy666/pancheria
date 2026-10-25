/**
 * Configuración del terminal de ventas (`/ventas`). Estos valores se leen de
 * variables de entorno con prefijo NEXT_PUBLIC_* para que estén disponibles
 * en el cliente.
 *
 * No acceder a la base de datos desde este archivo.
 */

const DEFAULT_VENTAS_CATALOG_REFRESH_INTERVAL_MS = 30_000;
const MIN_VENTAS_CATALOG_REFRESH_INTERVAL_MS = 5_000;

/**
 * Cadencia del refresco en vivo de la disponibilidad del catálogo del POS
 * (`NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS`, por defecto 30000 ms). En cada
 * tick el terminal reenvía el carrito actual junto con los `productIds` de
 * todo el catálogo a `POST /api/ventas/disponibilidad` (precheck de solo
 * lectura que contempla ventas de otras terminales y reservas activas de
 * pedidos `in_process`); al reanudar la visibilidad de la pestaña se
 * re-descarga además el catálogo completo.
 *
 * `0` —o cualquier valor no numérico o menor/igual a 0— deshabilita el
 * polling (patrón de `getPedidosRefreshIntervalMs`). Los valores positivos
 * por debajo del mínimo se ajustan a 5000 ms: cada tick ejecuta
 * `validateCartAvailability` con el contexto completo del catálogo y el piso
 * protege la base frente a múltiples terminales abiertas a la vez.
 */
export function getVentasCatalogRefreshIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_VENTAS_REFETCH_INTERVAL_MS;
  if (!raw) return DEFAULT_VENTAS_CATALOG_REFRESH_INTERVAL_MS;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  // Mínimo práctico: valores menores se ajustan al mínimo, no al default.
  if (parsed < MIN_VENTAS_CATALOG_REFRESH_INTERVAL_MS) {
    return MIN_VENTAS_CATALOG_REFRESH_INTERVAL_MS;
  }

  return parsed;
}
